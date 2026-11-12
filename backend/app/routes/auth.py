"""Authentication endpoints: student registration, login, session check, logout, profile."""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.auth_deps import (
    clear_session_cookie,
    extract_client_ip,
    get_current_user,
    get_session_context,
    require_csrf,
    require_public_origin,
    set_session_cookie,
)
from app.auth_service import (
    AuthError,
    SessionContext,
    authenticate_user,
    register_student,
    revoke_session_by_token,
    update_own_profile,
)
from app.config import get_settings
from app.schemas import (
    AuthenticatedUserResponse,
    AuthSessionResponse,
    LoginRequest,
    LogoutResponse,
    ProfileUpdateRequest,
    StudentRegisterRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=AuthSessionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_public_origin)],
)
def auth_register_student(
    payload: StudentRegisterRequest,
    response: Response,
) -> AuthSessionResponse:
    """Register a new STUDENT account only and issue an authenticated HttpOnly session."""
    settings = get_settings()
    try:
        user, raw_session, csrf_token, expires_at = register_student(payload, settings)
    except AuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc

    set_session_cookie(response, raw_session, settings)
    return AuthSessionResponse(
        status="ok",
        user=user,
        csrf_token=csrf_token,
        expires_at=expires_at,
    )


@router.post(
    "/login",
    response_model=AuthSessionResponse,
    dependencies=[Depends(require_public_origin)],
)
def auth_login(
    payload: LoginRequest,
    request: Request,
    response: Response,
) -> AuthSessionResponse:
    """Authenticate any role by email and password and start an HttpOnly cookie session."""
    settings = get_settings()
    client_ip = extract_client_ip(request)
    try:
        user, raw_session, csrf_token, expires_at = authenticate_user(
            payload, client_ip, settings
        )
    except AuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc

    set_session_cookie(response, raw_session, settings)
    return AuthSessionResponse(
        status="ok",
        user=user,
        csrf_token=csrf_token,
        expires_at=expires_at,
    )


@router.get("/me", response_model=AuthSessionResponse)
def auth_me(
    ctx: SessionContext = Depends(get_session_context),
) -> AuthSessionResponse:
    """Return the active authenticated user, actual role, and session CSRF token."""
    return AuthSessionResponse(
        status="ok",
        user=ctx.user,
        csrf_token=ctx.csrf_token,
        expires_at=ctx.expires_at,
    )


@router.post(
    "/logout",
    response_model=LogoutResponse,
    dependencies=[Depends(require_csrf)],
)
def auth_logout(
    response: Response,
    ctx: SessionContext = Depends(get_session_context),
) -> LogoutResponse:
    """Revoke the current server-side session and clear the HttpOnly cookie."""
    settings = get_settings()
    revoke_session_by_token(ctx.raw_session_token, settings)
    clear_session_cookie(response, settings)
    return LogoutResponse(
        status="ok",
        message="You have been signed out safely.",
    )


@router.get("/profile", response_model=AuthenticatedUserResponse)
def auth_get_profile(
    user: AuthenticatedUserResponse = Depends(get_current_user),
) -> AuthenticatedUserResponse:
    """Return the authenticated user's profile details."""
    return user


@router.patch(
    "/profile",
    response_model=AuthenticatedUserResponse,
    dependencies=[Depends(require_csrf)],
)
def auth_update_profile(
    payload: ProfileUpdateRequest,
    user: AuthenticatedUserResponse = Depends(get_current_user),
) -> AuthenticatedUserResponse:
    """Update permitted profile fields for the currently authenticated user."""
    try:
        return update_own_profile(user.id, payload, get_settings())
    except AuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc

