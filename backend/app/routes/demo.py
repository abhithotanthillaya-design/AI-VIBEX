"""Hackathon demonstration reset endpoint (disabled in production)."""

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models import OrderValidationError, reset_demo_data
from app.schemas import DemoResetResponse

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/reset", response_model=DemoResetResponse)
def reset_demo() -> DemoResetResponse:
    """Clear demo orders and order items while preserving seeded menu items."""
    try:
        return reset_demo_data(get_settings())
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc

