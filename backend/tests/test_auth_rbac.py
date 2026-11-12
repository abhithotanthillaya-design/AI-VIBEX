"""Comprehensive Phase 10.1 tests for Argon2id auth, HttpOnly sessions, CSRF, RBAC, ownership, and provisioning."""

from datetime import datetime, timedelta
from pathlib import Path
import sqlite3
import tempfile

from fastapi.testclient import TestClient

from app.auth_service import AuthError, bootstrap_manager_account
from app.config import get_settings
from app.database import db_session, init_db, write_transaction
from app.main import create_app
from app.security import LOGIN_RATE_LIMITER, hash_password, hash_session_token, verify_password
from tests.auth_helpers import (
    create_manager_client,
    create_staff_client,
    create_student_client,
)


def _setup_app(monkeypatch, tmpdir: str):
    db_file = Path(tmpdir) / "test_auth.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("ENABLE_DEMO_RESET", "true")
    monkeypatch.setenv("LOGIN_RATE_LIMIT_MAX_ATTEMPTS", "4")
    monkeypatch.setenv("LOGIN_RATE_LIMIT_WINDOW_SECONDS", "300")
    get_settings.cache_clear()
    LOGIN_RATE_LIMITER.clear_all()
    return create_app()


def test_argon2id_password_hashing_and_student_registration_rules(monkeypatch) -> None:
    """Verify Argon2id hashing, student-only registration, duplicate/invalid email & escalation checks."""
    hashed = hash_password("SecurePass123")
    assert hashed.startswith("$argon2id$")
    assert verify_password(hashed, "SecurePass123")[0] is True
    assert verify_password(hashed, "WrongPass123")[0] is False

    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            anon = TestClient(app)

            # Reject role escalation in registration payload
            esc = anon.post(
                "/api/auth/register",
                json={
                    "full_name": "Attacker",
                    "email": "attacker@campus.edu",
                    "password": "Password123",
                    "confirm_password": "Password123",
                    "role": "MANAGER",
                },
            )
            assert esc.status_code == 422

            # Reject bad email & mismatched passwords
            assert (
                anon.post(
                    "/api/auth/register",
                    json={
                        "full_name": "Bad Email",
                        "email": "not-an-email",
                        "password": "Password123",
                        "confirm_password": "Password123",
                    },
                ).status_code
                == 422
            )
            assert (
                anon.post(
                    "/api/auth/register",
                    json={
                        "full_name": "Weak Pass",
                        "email": "weak@campus.edu",
                        "password": "onlyletters",
                        "confirm_password": "onlyletters",
                    },
                ).status_code
                == 422
            )
            assert (
                anon.post(
                    "/api/auth/register",
                    json={
                        "full_name": "Mismatch",
                        "email": "mismatch@campus.edu",
                        "password": "Password123",
                        "confirm_password": "Password999",
                    },
                ).status_code
                == 422
            )

            # Valid student registration -> assigns STUDENT, sets HttpOnly cookie, hides hashes
            reg = anon.post(
                "/api/auth/register",
                json={
                    "full_name": "Ananya Rao",
                    "email": "Ananya.Rao@Campus.edu",
                    "password": "Password123",
                    "confirm_password": "Password123",
                    "student_roll_no": "CS2026-42",
                },
            )
            assert reg.status_code == 201
            body = reg.json()
            assert body["user"]["role"] == "STUDENT"
            assert body["user"]["email"] == "ananya.rao@campus.edu"
            assert body["user"]["student_roll_no"] == "CS2026-42"
            assert "password_hash" not in body["user"]
            assert body["csrf_token"]
            set_cookie = reg.headers.get("set-cookie", "").lower()
            assert "httponly" in set_cookie
            assert "samesite=lax" in set_cookie

            # Duplicate email (case-insensitive) rejected cleanly
            dup = anon.post(
                "/api/auth/register",
                json={
                    "full_name": "Duplicate",
                    "email": "ananya.rao@campus.edu",
                    "password": "Password123",
                    "confirm_password": "Password123",
                },
            )
            assert dup.status_code == 409
            assert dup.json()["error"] == "email_already_registered"

            # Raw session token must NOT appear in SQLite (only SHA-256 hash stored)
            raw_cookie = reg.cookies.get(get_settings().session_cookie_name)
            assert raw_cookie is not None
            with db_session() as conn:
                pw_in_db = conn.execute(
                    "SELECT password_hash FROM users WHERE id = ?",
                    (body["user"]["id"],),
                ).fetchone()["password_hash"]
                assert str(pw_in_db).startswith("$argon2id$")

                ses_row = conn.execute(
                    "SELECT session_token_hash FROM sessions WHERE user_id = ?",
                    (body["user"]["id"],),
                ).fetchone()
                assert ses_row["session_token_hash"] == hash_session_token(raw_cookie)
                assert ses_row["session_token_hash"] != raw_cookie

        get_settings.cache_clear()


def test_login_rate_limiting_session_expiry_logout_revocation_and_csrf(
    monkeypatch,
) -> None:
    """Verify login errors don't leak existence, sessions expire/revoke, and CSRF blocks forged writes."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            student = create_student_client(app, email="s1@campus.edu", password="UserPass123")
            me = student.get("/api/auth/me")
            assert me.status_code == 200
            assert me.json()["user"]["role"] == "STUDENT"

            # Profile update works & rejects role escalation
            prof_ok = student.patch(
                "/api/auth/profile",
                json={"full_name": "Updated Student Name"},
            )
            assert prof_ok.status_code == 200
            assert prof_ok.json()["full_name"] == "Updated Student Name"

            prof_esc = student.patch(
                "/api/auth/profile",
                json={"role": "MANAGER"},
            )
            assert prof_esc.status_code == 422

            # Missing CSRF header rejected on authenticated state-changing route (403)
            raw_token = student.cookies.get(get_settings().session_cookie_name)
            no_csrf = TestClient(app)
            no_csrf.cookies.set(get_settings().session_cookie_name, raw_token or "")
            forged_order = no_csrf.post(
                "/api/orders",
                json={
                    "customer_name": "Forged",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            )
            assert forged_order.status_code == 403
            assert forged_order.json()["error"] == "csrf_token_invalid"

            # Untrusted Origin rejected cleanly (403)
            bad_origin = student.post(
                "/api/orders",
                headers={"Origin": "https://evil.example.com"},
                json={
                    "customer_name": "Origin Attack",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            )
            assert bad_origin.status_code == 403
            assert bad_origin.json()["error"] == "csrf_origin_denied"

            # Logout revokes session server-side & clears cookie
            logout_res = student.post("/api/auth/logout")
            assert logout_res.status_code == 200
            assert student.get("/api/auth/me").status_code == 401
            # Replaying old session cookie manually must fail because DB session is revoked
            replay = TestClient(app)
            replay.cookies.set(get_settings().session_cookie_name, raw_token or "")
            assert replay.get("/api/auth/me").status_code == 401

            # Expired session rejected cleanly
            fresh = TestClient(app)
            login_res = fresh.post(
                "/api/auth/login",
                json={"email": "s1@campus.edu", "password": "UserPass123"},
            )
            assert login_res.status_code == 200
            expired_iso = (
                datetime.now(get_settings().zone_info) - timedelta(minutes=10)
            ).isoformat(timespec="seconds")
            with write_transaction() as conn:
                conn.execute("UPDATE sessions SET expires_at = ?", (expired_iso,))
            assert fresh.get("/api/auth/me").status_code == 401

            # Generic error messages & rate limiting on repeated wrong logins
            attacker = TestClient(app)
            for _ in range(4):
                bad = attacker.post(
                    "/api/auth/login",
                    json={"email": "s1@campus.edu", "password": "WrongPassword99"},
                )
                assert bad.status_code == 401
                assert bad.json()["message"] == "Invalid email or password."

            throttled = attacker.post(
                "/api/auth/login",
                json={"email": "s1@campus.edu", "password": "UserPass123"},
            )
            assert throttled.status_code == 429
            assert throttled.json()["error"] == "rate_limited"

        get_settings.cache_clear()


def test_rbac_matrix_and_staff_provisioning_and_deactivation(monkeypatch) -> None:
    """Enforce strict backend RBAC matrix across Student, Canteen Staff, Manager, and Manager bootstrap."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            # First manager created via CLI/bootstrap service (not open HTTP)
            manager = create_manager_client(
                app, email="boss@campus.edu", password="ManagerPass123", allow_additional=False
            )
            # Attempting second bootstrap without allow_additional raises AuthError
            try:
                bootstrap_manager_account(
                    "Rogue Manager",
                    "rogue@campus.edu",
                    "ManagerPass123",
                    get_settings(),
                    allow_additional=False,
                )
                assert False, "Expected second bootstrap without allow_additional to fail"
            except AuthError as exc:
                assert exc.code == "manager_already_exists"

            staff = create_staff_client(
                app, manager, email="chef@campus.edu", password="StaffPass123"
            )
            student = create_student_client(
                app, email="pupil@campus.edu", password="StudentPass123"
            )

            # Confirm additional Manager requires explicit confirm_manager_grant=True
            unconfirmed_mgr = manager.post(
                "/api/manager/staff",
                json={
                    "full_name": "Second Manager",
                    "email": "mgr2@campus.edu",
                    "password": "ManagerPass123",
                    "role": "MANAGER",
                },
            )
            assert unconfirmed_mgr.status_code == 422

            anon = TestClient(app)
            # 1. Unauthenticated access rejected with 401 across protected endpoints
            for get_path in (
                "/api/auth/me",
                "/api/slots/available",
                "/api/orders/mine",
                "/api/kitchen/orders",
                "/api/kitchen/slots",
                "/api/manager/dashboard",
                "/api/manager/menu",
                "/api/manager/orders",
                "/api/manager/sales",
                "/api/manager/slots",
                "/api/manager/staff",
            ):
                assert anon.get(get_path).status_code == 401

            # 2. Student blocked (403) from Kitchen, Manager, and Demo Reset routes
            assert student.get("/api/kitchen/orders").status_code == 403
            assert student.get("/api/kitchen/slots").status_code == 403
            assert (
                student.patch(
                    "/api/kitchen/orders/ord_123/status", json={"status": "ACCEPTED"}
                ).status_code
                == 403
            )
            assert (
                student.post(
                    "/api/kitchen/verify-pickup", json={"token": "qlp_12345678"}
                ).status_code
                == 403
            )
            assert student.get("/api/manager/dashboard").status_code == 403
            assert student.get("/api/manager/menu").status_code == 403
            assert student.get("/api/manager/staff").status_code == 403
            assert (
                student.post(
                    "/api/manager/menu",
                    json={
                        "name": "Unauthorized Dish",
                        "description": "Blocked test",
                        "category": "Snacks",
                        "price": 2000,
                        "prep_minutes": 2,
                        "is_veg": True,
                    },
                ).status_code
                == 403
            )
            assert student.post("/api/demo/reset").status_code == 403

            # 3. Canteen Staff allowed on Kitchen routes, blocked (403) from Manager, Student Checkout, Demo Reset
            assert staff.get("/api/kitchen/orders").status_code == 200
            assert staff.get("/api/kitchen/slots").status_code == 200
            assert staff.get("/api/manager/dashboard").status_code == 403
            assert staff.get("/api/manager/menu").status_code == 403
            assert staff.get("/api/manager/staff").status_code == 403
            assert (
                staff.patch(
                    "/api/manager/settings/capacity", json={"slot_capacity_units": 20}
                ).status_code
                == 403
            )
            assert staff.post("/api/demo/reset").status_code == 403
            assert staff.get("/api/orders/mine").status_code == 403

            # 4. Manager cannot deactivate self; deactivating staff revokes staff session immediately
            staff_list = manager.get("/api/manager/staff").json()
            mgr_id = next(u["id"] for u in staff_list if u["email"] == "boss@campus.edu")
            staff_id = next(u["id"] for u in staff_list if u["email"] == "chef@campus.edu")

            assert (
                manager.patch(
                    f"/api/manager/staff/{mgr_id}/status",
                    json={"is_active": False},
                ).status_code
                == 400
            )
            deact = manager.patch(
                f"/api/manager/staff/{staff_id}/status",
                json={"is_active": False},
            )
            assert deact.status_code == 200
            assert deact.json()["is_active"] is False

            # Existing staff session is immediately invalid (401), and re-login fails with 403
            assert staff.get("/api/kitchen/orders").status_code == 401
            relogin_inactive = TestClient(app).post(
                "/api/auth/login",
                json={"email": "chef@campus.edu", "password": "StaffPass123"},
            )
            assert relogin_inactive.status_code == 403
            assert relogin_inactive.json()["error"] == "account_inactive"

        get_settings.cache_clear()


def test_student_order_ownership_and_legacy_order_migration(monkeypatch) -> None:
    """Students only view/pay their own orders; legacy NULL user_id orders are hidden from students."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_ownership.db"
        conn = sqlite3.connect(str(db_file))
        conn.executescript(
            """
            CREATE TABLE menu_items (
                id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
                category TEXT NOT NULL, price INTEGER NOT NULL, prep_minutes INTEGER NOT NULL,
                available INTEGER NOT NULL DEFAULT 1, image_url TEXT
            );
            CREATE TABLE orders (
                id TEXT PRIMARY KEY, pickup_code TEXT NOT NULL UNIQUE,
                customer_name TEXT NOT NULL, status TEXT NOT NULL,
                pickup_slot_start TEXT NOT NULL, pickup_slot_end TEXT NOT NULL,
                total_amount INTEGER NOT NULL, total_prep_units INTEGER NOT NULL,
                notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
            );
            INSERT INTO orders VALUES (
                'ord_legacy_null_user', 'LEG1', 'Historical Walkup', 'COLLECTED',
                '2026-11-12T10:00:00+05:30', '2026-11-12T10:05:00+05:30',
                5000, 4, NULL, '2026-11-12T09:50:00+05:30', '2026-11-12T10:05:00+05:30'
            );
            """
        )
        conn.commit()
        conn.close()

        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        get_settings.cache_clear()
        LOGIN_RATE_LIMITER.clear_all()
        init_db()

        app = create_app()
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            s_a = create_student_client(app, email="a@campus.edu", full_name="Student A")
            s_b = create_student_client(app, email="b@campus.edu", full_name="Student B")

            # Student A places an order
            res_a = s_a.post(
                "/api/orders",
                json={
                    "customer_name": "Student A",
                    "items": [{"menu_item_id": "item_2", "quantity": 1}],
                    "payment_method": "DEMO_UPI",
                },
            )
            assert res_a.status_code == 201
            order_a_id = res_a.json()["id"]

            # Student A sees own order in /api/orders/mine and GET /api/orders/{id}
            mine_a = s_a.get("/api/orders/mine").json()
            assert [o["id"] for o in mine_a] == [order_a_id]
            assert s_a.get(f"/api/orders/{order_a_id}").status_code == 200

            # Student B has empty history and CANNOT read or pay for Student A's order OR legacy order
            assert s_b.get("/api/orders/mine").json() == []
            assert s_b.get(f"/api/orders/{order_a_id}").status_code == 404
            assert (
                s_b.post(
                    f"/api/orders/{order_a_id}/demo-payment",
                    json={"outcome": "succeed", "method": "DEMO_UPI"},
                ).status_code
                == 404
            )
            assert s_a.get("/api/orders/ord_legacy_null_user").status_code == 404

            # Manager still preserves and sees the legacy historical order cleanly
            mgr_orders = manager.get("/api/manager/orders").json()
            mgr_ids = {o["id"] for o in mgr_orders}
            assert "ord_legacy_null_user" in mgr_ids
            assert order_a_id in mgr_ids

        get_settings.cache_clear()

