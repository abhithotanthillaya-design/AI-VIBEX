"""Authentication, session management, profile updates, and staff provisioning services."""

from dataclasses import dataclass
from datetime import datetime, timedelta
import sqlite3
import uuid

from app.config import Settings
from app.database import db_session, write_transaction
from app.schemas import (
    AuthenticatedUserResponse,
    LoginRequest,
    ProfileUpdateRequest,
    StaffCreateRequest,
    StudentRegisterRequest,
    UserRole,
    normalize_and_validate_email,
    sanitize_text_input,
    validate_password_policy,
)
from app.security import (
    LOGIN_RATE_LIMITER,
    generate_session_and_csrf_tokens,
    hash_password,
    hash_session_token,
    verify_password,
)


class AuthError(Exception):
    """Domain exception for authentication, session, or authorization failures."""

    def __init__(
        self,
        message: str,
        status_code: int = 401,
        code: str = "auth_error",
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


@dataclass(frozen=True)
class SessionContext:
    """Verified server-side session state attached to authenticated requests."""

    user: AuthenticatedUserResponse
    session_id: str
    csrf_token: str
    expires_at: str
    raw_session_token: str


def _row_to_user(row: sqlite3.Row) -> AuthenticatedUserResponse:
    return AuthenticatedUserResponse(
        id=str(row["id"]),
        full_name=str(row["full_name"]),
        email=str(row["email"]),
        student_roll_no=row["student_roll_no"],
        role=str(row["role"]),  # type: ignore[arg-type]
        is_active=bool(row["is_active"]),
        created_at=str(row["created_at"]),
        updated_at=str(row["updated_at"]),
    )


def _create_session_in_tx(
    conn: sqlite3.Connection,
    user_id: str,
    settings: Settings,
    *,
    now_dt: datetime | None = None,
) -> tuple[str, str, str, str]:
    """Create a session row inside an active write transaction.

    Returns `(session_id, raw_session_token, csrf_token, expires_at_iso)`.
    """
    tz = settings.zone_info
    current_dt = (now_dt or datetime.now(tz)).astimezone(tz)
    expires_dt = current_dt + timedelta(hours=max(1, settings.session_ttl_hours))
    now_iso = current_dt.isoformat(timespec="seconds")
    expires_iso = expires_dt.isoformat(timespec="seconds")

    session_id = f"ses_{uuid.uuid4().hex[:14]}"
    raw_session, token_hash, csrf_token = generate_session_and_csrf_tokens()

    conn.execute(
        """
        INSERT INTO sessions (
            id, user_id, session_token_hash, csrf_token, expires_at, created_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL)
        """,
        (session_id, user_id, token_hash, csrf_token, expires_iso, now_iso),
    )
    return session_id, raw_session, csrf_token, expires_iso


def register_student(
    payload: StudentRegisterRequest,
    settings: Settings,
) -> tuple[AuthenticatedUserResponse, str, str, str]:
    """Register a new STUDENT account only, hash password with Argon2id, and open a session."""
    now_iso = datetime.now(settings.zone_info).isoformat(timespec="seconds")
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(payload.password)

    with write_transaction() as conn:
        existing = conn.execute(
            "SELECT 1 FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
            (payload.email,),
        ).fetchone()
        if existing is not None:
            raise AuthError(
                "An account with this email address already exists.",
                status_code=409,
                code="email_already_registered",
            )

        conn.execute(
            """
            INSERT INTO users (
                id, full_name, email, student_roll_no, password_hash,
                role, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'STUDENT', 1, ?, ?)
            """,
            (
                user_id,
                payload.full_name,
                payload.email,
                payload.student_roll_no,
                password_hash,
                now_iso,
                now_iso,
            ),
        )

        row = conn.execute(
            """
            SELECT id, full_name, email, student_roll_no, role, is_active, created_at, updated_at
            FROM users WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        assert row is not None
        user = _row_to_user(row)
        _, raw_session, csrf_token, expires_iso = _create_session_in_tx(
            conn, user_id, settings
        )

    return user, raw_session, csrf_token, expires_iso


def authenticate_user(
    payload: LoginRequest,
    client_ip: str,
    settings: Settings,
) -> tuple[AuthenticatedUserResponse, str, str, str]:
    """Authenticate an email + password login for any role and open a server-managed session."""
    cooldown = LOGIN_RATE_LIMITER.is_blocked(
        client_ip,
        payload.email,
        max_attempts=settings.login_rate_limit_max_attempts,
        window_seconds=settings.login_rate_limit_window_seconds,
    )
    if cooldown > 0:
        raise AuthError(
            f"Too many failed login attempts. Please wait {cooldown} seconds and try again.",
            status_code=429,
            code="rate_limited",
        )

    with db_session() as conn:
        row = conn.execute(
            """
            SELECT id, full_name, email, student_roll_no, password_hash,
                   role, is_active, created_at, updated_at
            FROM users
            WHERE LOWER(email) = LOWER(?)
            LIMIT 1
            """,
            (payload.email,),
        ).fetchone()

    if row is None:
        LOGIN_RATE_LIMITER.record_failure(
            client_ip,
            payload.email,
            window_seconds=settings.login_rate_limit_window_seconds,
        )
        raise AuthError(
            "Invalid email or password.",
            status_code=401,
            code="invalid_credentials",
        )

    valid_pw, needs_rehash = verify_password(
        str(row["password_hash"]),
        payload.password,
    )
    if not valid_pw:
        LOGIN_RATE_LIMITER.record_failure(
            client_ip,
            payload.email,
            window_seconds=settings.login_rate_limit_window_seconds,
        )
        raise AuthError(
            "Invalid email or password.",
            status_code=401,
            code="invalid_credentials",
        )

    if not bool(row["is_active"]):
        raise AuthError(
            "Your account is inactive. Please contact a canteen manager for assistance.",
            status_code=403,
            code="account_inactive",
        )

    LOGIN_RATE_LIMITER.reset(client_ip, payload.email)

    user_id = str(row["id"])
    now_iso = datetime.now(settings.zone_info).isoformat(timespec="seconds")
    with write_transaction() as conn:
        if needs_rehash:
            conn.execute(
                "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
                (hash_password(payload.password), now_iso, user_id),
            )
        fresh_row = conn.execute(
            """
            SELECT id, full_name, email, student_roll_no, role, is_active, created_at, updated_at
            FROM users WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        assert fresh_row is not None
        user = _row_to_user(fresh_row)
        _, raw_session, csrf_token, expires_iso = _create_session_in_tx(
            conn, user_id, settings
        )

    return user, raw_session, csrf_token, expires_iso


def get_active_session_context(
    raw_session_token: str | None,
    settings: Settings,
) -> SessionContext | None:
    """Resolve an active, unexpired session cookie to its SessionContext."""
    if not raw_session_token or not raw_session_token.strip():
        return None

    token_hash = hash_session_token(raw_session_token.strip())
    with db_session() as conn:
        row = conn.execute(
            """
            SELECT s.id AS session_id,
                   s.csrf_token AS csrf_token,
                   s.expires_at AS expires_at,
                   s.revoked_at AS revoked_at,
                   u.id AS id,
                   u.full_name AS full_name,
                   u.email AS email,
                   u.student_roll_no AS student_roll_no,
                   u.role AS role,
                   u.is_active AS is_active,
                   u.created_at AS created_at,
                   u.updated_at AS updated_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.session_token_hash = ?
            LIMIT 1
            """,
            (token_hash,),
        ).fetchone()

    if row is None or row["revoked_at"] is not None or not bool(row["is_active"]):
        return None

    tz = settings.zone_info
    now_dt = datetime.now(tz)
    expires_at_str = str(row["expires_at"])
    expires_dt = datetime.fromisoformat(expires_at_str)
    if expires_dt.tzinfo is None:
        expires_dt = expires_dt.replace(tzinfo=tz)
    else:
        expires_dt = expires_dt.astimezone(tz)

    if expires_dt <= now_dt:
        return None

    return SessionContext(
        user=_row_to_user(row),
        session_id=str(row["session_id"]),
        csrf_token=str(row["csrf_token"]),
        expires_at=expires_at_str,
        raw_session_token=raw_session_token.strip(),
    )


def revoke_session_by_token(raw_session_token: str | None, settings: Settings) -> None:
    """Mark a session row as revoked inside SQLite."""
    if not raw_session_token or not raw_session_token.strip():
        return
    token_hash = hash_session_token(raw_session_token.strip())
    now_iso = datetime.now(settings.zone_info).isoformat(timespec="seconds")
    with write_transaction() as conn:
        conn.execute(
            """
            UPDATE sessions
            SET revoked_at = COALESCE(revoked_at, ?)
            WHERE session_token_hash = ?
            """,
            (now_iso, token_hash),
        )


def update_own_profile(
    user_id: str,
    payload: ProfileUpdateRequest,
    settings: Settings,
) -> AuthenticatedUserResponse:
    """Allow authenticated users to update only permitted self-profile fields."""
    now_iso = datetime.now(settings.zone_info).isoformat(timespec="seconds")
    with write_transaction() as conn:
        row = conn.execute(
            """
            SELECT id, full_name, email, student_roll_no, password_hash,
                   role, is_active, created_at, updated_at
            FROM users WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        if row is None or not bool(row["is_active"]):
            raise AuthError(
                "Account is unavailable.",
                status_code=401,
                code="authentication_required",
            )

        next_name = payload.full_name if payload.full_name is not None else str(row["full_name"])
        next_roll = (
            payload.student_roll_no
            if "student_roll_no" in payload.model_fields_set and str(row["role"]) == "STUDENT"
            else row["student_roll_no"]
        )
        next_hash = str(row["password_hash"])

        if payload.new_password is not None:
            valid_current, _ = verify_password(next_hash, payload.current_password or "")
            if not valid_current:
                raise AuthError(
                    "Current password is incorrect.",
                    status_code=400,
                    code="invalid_current_password",
                )
            next_hash = hash_password(payload.new_password)

        conn.execute(
            """
            UPDATE users
            SET full_name = ?, student_roll_no = ?, password_hash = ?, updated_at = ?
            WHERE id = ?
            """,
            (next_name, next_roll, next_hash, now_iso, user_id),
        )
        updated = conn.execute(
            """
            SELECT id, full_name, email, student_roll_no, role, is_active, created_at, updated_at
            FROM users WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        assert updated is not None
        return _row_to_user(updated)


def list_staff_accounts() -> list[AuthenticatedUserResponse]:
    """List CANTEEN_STAFF and MANAGER accounts ordered by role and name."""
    with db_session() as conn:
        rows = conn.execute(
            """
            SELECT id, full_name, email, student_roll_no, role, is_active, created_at, updated_at
            FROM users
            WHERE role IN ('CANTEEN_STAFF', 'MANAGER')
            ORDER BY CASE role WHEN 'MANAGER' THEN 0 ELSE 1 END, full_name ASC
            """
        ).fetchall()
    return [_row_to_user(row) for row in rows]


def create_staff_account(
    payload: StaffCreateRequest,
    settings: Settings,
) -> AuthenticatedUserResponse:
    """Provision a CANTEEN_STAFF (or explicitly authorized MANAGER) account by a manager."""
    now_iso = datetime.now(settings.zone_info).isoformat(timespec="seconds")
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    password_hash = hash_password(payload.password)
    assigned_role: UserRole = payload.role

    with write_transaction() as conn:
        existing = conn.execute(
            "SELECT 1 FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
            (payload.email,),
        ).fetchone()
        if existing is not None:
            raise AuthError(
                "An account with this email address already exists.",
                status_code=409,
                code="email_already_registered",
            )

        conn.execute(
            """
            INSERT INTO users (
                id, full_name, email, student_roll_no, password_hash,
                role, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, NULL, ?, ?, 1, ?, ?)
            """,
            (
                user_id,
                payload.full_name,
                payload.email,
                password_hash,
                assigned_role,
                now_iso,
                now_iso,
            ),
        )
        row = conn.execute(
            """
            SELECT id, full_name, email, student_roll_no, role, is_active, created_at, updated_at
            FROM users WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        assert row is not None
        return _row_to_user(row)


def update_staff_account_status(
    target_user_id: str,
    is_active: bool,
    actor_user_id: str,
    settings: Settings,
) -> AuthenticatedUserResponse:
    """Activate or deactivate a staff/manager account and revoke sessions on deactivation."""
    cleaned_target = target_user_id.strip()
    if cleaned_target == actor_user_id:
        raise AuthError(
            "Managers cannot change their own activation status.",
            status_code=400,
            code="cannot_modify_self_status",
        )

    now_iso = datetime.now(settings.zone_info).isoformat(timespec="seconds")
    with write_transaction() as conn:
        row = conn.execute(
            """
            SELECT id, role FROM users WHERE id = ?
            """,
            (cleaned_target,),
        ).fetchone()
        if row is None or str(row["role"]) not in ("CANTEEN_STAFF", "MANAGER"):
            raise AuthError(
                f"Staff account '{cleaned_target}' was not found.",
                status_code=404,
                code="staff_user_not_found",
            )

        conn.execute(
            "UPDATE users SET is_active = ?, updated_at = ? WHERE id = ?",
            (1 if is_active else 0, now_iso, cleaned_target),
        )
        if not is_active:
            conn.execute(
                """
                UPDATE sessions
                SET revoked_at = COALESCE(revoked_at, ?)
                WHERE user_id = ? AND revoked_at IS NULL
                """,
                (now_iso, cleaned_target),
            )

        updated = conn.execute(
            """
            SELECT id, full_name, email, student_roll_no, role, is_active, created_at, updated_at
            FROM users WHERE id = ?
            """,
            (cleaned_target,),
        ).fetchone()
        assert updated is not None
        return _row_to_user(updated)


def bootstrap_manager_account(
    full_name: str,
    email: str,
    password: str,
    settings: Settings,
    *,
    allow_additional: bool = False,
) -> AuthenticatedUserResponse:
    """Create the initial MANAGER account from the secure bootstrap CLI or test setup."""
    clean_name = sanitize_text_input(full_name) or ""
    if len(clean_name) < 2:
        raise AuthError(
            "Full name must be at least 2 characters.",
            status_code=400,
            code="invalid_bootstrap_input",
        )
    try:
        clean_email = normalize_and_validate_email(email)
        validate_password_policy(password)
    except ValueError as exc:
        raise AuthError(
            str(exc),
            status_code=400,
            code="invalid_bootstrap_input",
        ) from exc

    now_iso = datetime.now(settings.zone_info).isoformat(timespec="seconds")
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    pw_hash = hash_password(password)

    with write_transaction() as conn:
        existing_email = conn.execute(
            "SELECT 1 FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
            (clean_email,),
        ).fetchone()
        if existing_email is not None:
            raise AuthError(
                f"An account with email '{clean_email}' already exists.",
                status_code=409,
                code="email_already_registered",
            )

        if not allow_additional:
            existing_mgr = conn.execute(
                "SELECT 1 FROM users WHERE role = 'MANAGER' AND is_active = 1 LIMIT 1"
            ).fetchone()
            if existing_mgr is not None:
                raise AuthError(
                    "An active Manager account already exists. Log in as Manager to provision staff or pass --allow-additional explicitly.",
                    status_code=409,
                    code="manager_already_exists",
                )

        conn.execute(
            """
            INSERT INTO users (
                id, full_name, email, student_roll_no, password_hash,
                role, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, NULL, ?, 'MANAGER', 1, ?, ?)
            """,
            (user_id, clean_name, clean_email, pw_hash, now_iso, now_iso),
        )
        row = conn.execute(
            """
            SELECT id, full_name, email, student_roll_no, role, is_active, created_at, updated_at
            FROM users WHERE id = ?
            """,
            (user_id,),
        ).fetchone()
        assert row is not None
        return _row_to_user(row)

