"""Student-facing pickup-slot availability endpoints."""

from fastapi import APIRouter, Depends, Query

from app.auth_deps import require_student
from app.config import get_settings
from app.models import get_available_slots
from app.schemas import AvailableSlotsResponse

router = APIRouter(prefix="/slots", tags=["slots"])


@router.get(
    "/available",
    response_model=AvailableSlotsResponse,
    dependencies=[Depends(require_student)],
)
def get_available_pickup_slots(
    workload_units: int = Query(
        default=0,
        ge=0,
        le=500,
        description="Optional cart preparation workload units to evaluate slot feasibility.",
    ),
) -> AvailableSlotsResponse:
    """Return chronological upcoming pickup slots for authenticated students."""
    return get_available_slots(get_settings(), workload_units=workload_units)
