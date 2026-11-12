"""Order placement and student order-tracking endpoints."""

from fastapi import APIRouter, HTTPException, status

from app.allocator import CapacityAllocationError
from app.config import get_settings
from app.models import (
    OrderValidationError,
    create_order,
    get_order_by_id,
    process_demo_payment,
)
from app.schemas import (
    CreateOrderRequest,
    CreateOrderResponse,
    DemoPaymentRequest,
    DemoPaymentResponse,
    OrderDetailResponse,
)

router = APIRouter(tags=["orders"])


@router.post(
    "/orders",
    response_model=CreateOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def place_order(payload: CreateOrderRequest) -> CreateOrderResponse:
    """Validate order items, allocate a capacity-aware pickup slot, and save the order."""
    try:
        return create_order(payload, get_settings())
    except (OrderValidationError, CapacityAllocationError) as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
def get_order_status(order_id: str) -> OrderDetailResponse:
    """Return full order details, pickup window, items, and live status."""
    order = get_order_by_id(order_id)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "order_not_found",
                "message": f"Order '{order_id}' was not found.",
            },
        )
    return order


@router.post("/orders/{order_id}/demo-payment", response_model=DemoPaymentResponse)
def simulate_demo_payment(
    order_id: str,
    payload: DemoPaymentRequest,
) -> DemoPaymentResponse:
    """Process a simulated demo payment state transition (no real money is charged)."""
    try:
        return process_demo_payment(order_id, payload, get_settings())
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc

