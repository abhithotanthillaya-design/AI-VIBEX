"""Kitchen operations endpoints for queue management, status updates, and slot workload."""

from fastapi import APIRouter, HTTPException, Query

from app.config import get_settings
from app.models import (
    OrderValidationError,
    list_kitchen_orders,
    list_kitchen_slots,
    update_kitchen_order_status,
)
from app.schemas import (
    OrderDetailResponse,
    OrderStatusUpdateRequest,
    SlotWorkloadResponse,
)

router = APIRouter(prefix="/kitchen", tags=["kitchen"])


@router.get("/orders", response_model=list[OrderDetailResponse])
def get_kitchen_orders(
    status: str | None = Query(
        default="active",
        description="Filter by 'active' (default) or a specific order status.",
    ),
) -> list[OrderDetailResponse]:
    """Return kitchen orders sorted by pickup window and creation time."""
    try:
        return list_kitchen_orders(status_filter=status)
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.patch("/orders/{order_id}/status", response_model=OrderDetailResponse)
def patch_kitchen_order_status(
    order_id: str,
    payload: OrderStatusUpdateRequest,
) -> OrderDetailResponse:
    """Advance an order along PLACED -> ACCEPTED -> PREPARING -> READY -> COLLECTED."""
    try:
        return update_kitchen_order_status(order_id, payload.status, get_settings())
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.get("/slots", response_model=list[SlotWorkloadResponse])
def get_kitchen_slots() -> list[SlotWorkloadResponse]:
    """Return upcoming and active pickup slots with capacity and order counts."""
    return list_kitchen_slots(get_settings())

