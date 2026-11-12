"""Order placement and authenticated student/staff order-tracking endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.allocator import CapacityAllocationError
from app.auth_deps import get_current_user, require_csrf, require_student
from app.config import get_settings
from app.models import (
    OrderValidationError,
    create_order,
    get_order_by_id,
    list_student_orders,
    process_demo_payment,
)
from app.schemas import (
    AuthenticatedUserResponse,
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
    dependencies=[Depends(require_csrf)],
)
def place_order(
    payload: CreateOrderRequest,
    user: AuthenticatedUserResponse = Depends(require_student),
) -> CreateOrderResponse:
    """Validate order items, allocate slot, and save the order for the authenticated student."""
    try:
        return create_order(payload, get_settings(), user_id=user.id)
    except (OrderValidationError, CapacityAllocationError) as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.get("/orders/mine", response_model=list[OrderDetailResponse])
def get_my_orders(
    user: AuthenticatedUserResponse = Depends(require_student),
) -> list[OrderDetailResponse]:
    """Return orders belonging exclusively to the authenticated student."""
    return list_student_orders(user.id)


@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
def get_order_status(
    order_id: str,
    user: AuthenticatedUserResponse = Depends(get_current_user),
) -> OrderDetailResponse:
    """Return full order details for the owning student or authorized staff/manager."""
    owner_filter = user.id if user.role == "STUDENT" else None
    order = get_order_by_id(order_id, owner_user_id=owner_filter)
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "order_not_found",
                "message": f"Order '{order_id}' was not found.",
            },
        )
    return order


@router.post(
    "/orders/{order_id}/demo-payment",
    response_model=DemoPaymentResponse,
    dependencies=[Depends(require_csrf)],
)
def simulate_demo_payment(
    order_id: str,
    payload: DemoPaymentRequest,
    user: AuthenticatedUserResponse = Depends(require_student),
) -> DemoPaymentResponse:
    """Process a simulated demo payment state transition for the student's own order."""
    try:
        return process_demo_payment(
            order_id,
            payload,
            get_settings(),
            owner_user_id=user.id,
        )
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc
