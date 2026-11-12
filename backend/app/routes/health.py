"""Health and readiness endpoints."""

from datetime import datetime

from fastapi import APIRouter, HTTPException, status

from app.config import get_settings
from app.database import check_db_health
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health_check() -> HealthResponse:
    """Verify API availability and SQLite database connectivity."""
    settings = get_settings()
    db_ok = check_db_health()
    if not db_ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database health check failed.",
        )

    return HealthResponse(
        status="ok",
        service=settings.app_name,
        database="connected",
        environment=settings.environment,
        timestamp=datetime.now(settings.zone_info).isoformat(timespec="seconds"),
    )

