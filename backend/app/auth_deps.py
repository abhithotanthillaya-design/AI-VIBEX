"""FastAPI authentication, CSRF, and role-based authorization dependencies."""

import hmac
from urllib.parse import urlparse

from fastapi import Depends, HTTPException, Request, Response, status

from app.auth_service import (
    SessionContext,
    get_active_session_context,
)
from app.config import Settings, get_settings
from app.schemas import AuthenticatedUserResponse


def set_session_cookie(
    response: Response,
    raw_session_token: str,
    settings: Settings,
) -> None:
    """Attach HttpOnly session cookie with environment-appropriate Secure/SameSite flags."""
    response.set_cookie(
        key=settings.session_cookie_name,
        value=raw_session_token,
        max_age=max(1, settings.session_ttl_hours) * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.session_cookie_samesite,
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    """Clear the HttpOnly session cookie on logout or session invalidation."""
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.session_cookie_samesite,
    )


def extract_client_ip(request: Request) -> str:
    """Extract client IP address cleanly for rate limiting."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip() or "unknown"
    return request.client.host if request.client else "unknown"


def validate_request_origin(request: Request, settings: Settings) -> None:
    """Reject cross-site browser requests whose Origin or Referer is outside cors_origins."""
    allowed = {origin.rstrip("/").lower() for origin in settings.cors_origin_list}
    origin = request.headers.get("origin")
    if origin:
        if origin.rstrip("/").lower() not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "csrf_origin_denied",
                    "message": "Request origin is not permitted.",
                },
            )
        return

    referer = request.headers.get("referer")
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            ref_origin = f"{parsed.scheme}://{parsed.netloc}".lower()
            if ref_origin not in allowed:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "csrf_origin_denied",
                        "message": "Request referer origin is not permitted.",
                    },
                )


def require_public_origin(request: Request) -> None:
    """Validate Origin/Referer on unauthenticated state-changing auth routes."""
    validate_request_origin(request, get_settings())


def get_session_context(request: Request) -> SessionContext:
    """Require an active, unexpired HttpOnly cookie session."""
    settings = get_settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    ctx = get_active_session_context(raw_token, settings)
    if ctx is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "authentication_required",
                "message": "Authentication required or session expired. Please sign in.",
            },
        )
    return ctx


def get_current_user(
    ctx: SessionContext = Depends(get_session_context),
) -> AuthenticatedUserResponse:
    """Return the authenticated user bound to the current session."""
    return ctx.user


def require_csrf(
    request: Request,
    ctx: SessionContext = Depends(get_session_context),
) -> SessionContext:
    """Enforce origin validation and session-bound X-CSRF-Token on state-changing routes."""
    settings = get_settings()
    validate_request_origin(request, settings)
    submitted_csrf = request.headers.get("x-csrf-token", "").strip()
    if not submitted_csrf or not hmac.compare_digest(submitted_csrf, ctx.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "csrf_token_invalid",
                "message": "Missing or invalid CSRF security token. Please refresh and try again.",
            },
        )
    return ctx


def require_student(
    user: AuthenticatedUserResponse = Depends(get_current_user),
) -> AuthenticatedUserResponse:
    """Allow access only to authenticated STUDENT accounts."""
    if user.role != "STUDENT":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "forbidden",
                "message": "This endpoint is restricted to authenticated student accounts.",
            },
        )
    return user


def require_canteen_staff(
    user: AuthenticatedUserResponse = Depends(get_current_user),
) -> AuthenticatedUserResponse:
    """Allow access only to authenticated CANTEEN_STAFF accounts."""
    if user.role != "CANTEEN_STAFF":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "forbidden",
                "message": "This endpoint is restricted to authorized canteen staff.",
            },
        )
    return user


def require_kitchen_access(
    user: AuthenticatedUserResponse = Depends(get_current_user),
) -> AuthenticatedUserResponse:
    """Allow kitchen operations for CANTEEN_STAFF and MANAGER accounts."""
    if user.role not in ("CANTEEN_STAFF", "MANAGER"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "forbidden",
                "message": "Kitchen access requires a Canteen Staff or Manager account.",
            },
        )
    return user


def require_manager(
    user: AuthenticatedUserResponse = Depends(get_current_user),
) -> AuthenticatedUserResponse:
    """Allow access only to authenticated MANAGER accounts."""
    if user.role != "MANAGER":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "forbidden",
                "message": "This action requires Manager authorization.",
            },
        )
    return user

