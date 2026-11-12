"""Manager dashboard, menu CRUD, order oversight, sales, slot controls, and staff provisioning."""

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.auth_deps import require_csrf, require_manager
from app.auth_service import (
    AuthError,
    create_staff_account,
    list_staff_accounts,
    update_staff_account_status,
)
from app.config import get_settings
from app.manager_service import (
    create_manager_menu_item,
    delete_manager_menu_item,
    get_manager_dashboard,
    get_manager_sales_summary,
    get_manager_slot_settings,
    list_manager_menu_items,
    list_manager_orders,
    update_manager_menu_item,
    update_menu_item_availability,
    update_slot_capacity_setting,
    update_slot_closure_status,
)
from app.models import OrderValidationError
from app.schemas import (
    AuthenticatedUserResponse,
    CapacityUpdateRequest,
    ManagerDashboardResponse,
    ManagerSalesSummaryResponse,
    ManagerSlotSettingsResponse,
    MenuItemAvailabilityRequest,
    MenuItemDeleteResponse,
    MenuItemResponse,
    MenuItemUpsertRequest,
    OrderDetailResponse,
    SlotClosureRequest,
    SlotWorkloadResponse,
    StaffCreateRequest,
    UserStatusUpdateRequest,
)

router = APIRouter(
    prefix="/manager",
    tags=["manager"],
    dependencies=[Depends(require_manager)],
)


@router.get("/dashboard", response_model=ManagerDashboardResponse)
def manager_dashboard() -> ManagerDashboardResponse:
    """Return real-time manager KPIs and slot workload highlights."""
    return get_manager_dashboard(get_settings())


@router.get("/menu", response_model=list[MenuItemResponse])
def manager_list_menu() -> list[MenuItemResponse]:
    """Return all non-deleted menu items including unavailable items."""
    return list_manager_menu_items()


@router.post(
    "/menu",
    response_model=MenuItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_csrf)],
)
def manager_create_menu_item(payload: MenuItemUpsertRequest) -> MenuItemResponse:
    """Add a new dish to the canteen menu."""
    return create_manager_menu_item(payload)


@router.put(
    "/menu/{item_id}",
    response_model=MenuItemResponse,
    dependencies=[Depends(require_csrf)],
)
def manager_update_menu_item(
    item_id: str,
    payload: MenuItemUpsertRequest,
) -> MenuItemResponse:
    """Update an existing menu item without changing past order records."""
    try:
        return update_manager_menu_item(item_id, payload)
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.patch(
    "/menu/{item_id}/availability",
    response_model=MenuItemResponse,
    dependencies=[Depends(require_csrf)],
)
def manager_toggle_menu_availability(
    item_id: str,
    payload: MenuItemAvailabilityRequest,
) -> MenuItemResponse:
    """Mark a menu item available or sold out immediately."""
    try:
        return update_menu_item_availability(item_id, payload.available)
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.delete(
    "/menu/{item_id}",
    response_model=MenuItemDeleteResponse,
    dependencies=[Depends(require_csrf)],
)
def manager_delete_menu_item(item_id: str) -> MenuItemDeleteResponse:
    """Soft-delete/archive a menu item while preserving historical order records."""
    try:
        return delete_manager_menu_item(item_id)
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.get("/orders", response_model=list[OrderDetailResponse])
def manager_list_orders(
    status: str | None = Query(
        default="all",
        description="Filter: 'all', 'active', 'completed', 'cancelled', or specific status.",
    ),
    date: str | None = Query(
        default=None,
        description="Optional YYYY-MM-DD creation date filter (Asia/Kolkata).",
    ),
    search: str | None = Query(
        default=None,
        max_length=100,
        description="Search by order ID, pickup code, or customer name.",
    ),
) -> list[OrderDetailResponse]:
    """Return orders for manager oversight with filtering and search."""
    try:
        return list_manager_orders(
            get_settings(),
            status_filter=status,
            date_filter=date,
            search=search,
        )
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.get("/sales", response_model=ManagerSalesSummaryResponse)
def manager_sales_summary() -> ManagerSalesSummaryResponse:
    """Return finalized sales summary computed from collected orders only."""
    return get_manager_sales_summary(get_settings())


@router.get("/slots", response_model=ManagerSlotSettingsResponse)
def manager_get_slots() -> ManagerSlotSettingsResponse:
    """Return current slot capacity configuration and upcoming/active pickup slots."""
    return get_manager_slot_settings(get_settings())


@router.patch(
    "/settings/capacity",
    response_model=ManagerSlotSettingsResponse,
    dependencies=[Depends(require_csrf)],
)
def manager_update_capacity(
    payload: CapacityUpdateRequest,
) -> ManagerSlotSettingsResponse:
    """Update default pickup-slot capacity in the database."""
    return update_slot_capacity_setting(payload.slot_capacity_units, get_settings())


@router.patch(
    "/slots/status",
    response_model=SlotWorkloadResponse,
    dependencies=[Depends(require_csrf)],
)
def manager_update_slot_status(
    payload: SlotClosureRequest,
) -> SlotWorkloadResponse:
    """Close or reopen a pickup slot without modifying existing orders."""
    try:
        return update_slot_closure_status(
            payload.slot_start,
            payload.is_closed,
            payload.reason,
            get_settings(),
        )
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.get("/staff", response_model=list[AuthenticatedUserResponse])
def manager_list_staff() -> list[AuthenticatedUserResponse]:
    """List canteen staff and manager accounts."""
    return list_staff_accounts()


@router.post(
    "/staff",
    response_model=AuthenticatedUserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_csrf)],
)
def manager_create_staff(
    payload: StaffCreateRequest,
) -> AuthenticatedUserResponse:
    """Create a CANTEEN_STAFF (or explicitly confirmed MANAGER) account."""
    try:
        return create_staff_account(payload, get_settings())
    except AuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.patch(
    "/staff/{user_id}/status",
    response_model=AuthenticatedUserResponse,
    dependencies=[Depends(require_csrf)],
)
def manager_update_staff_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    current_user: AuthenticatedUserResponse = Depends(require_manager),
) -> AuthenticatedUserResponse:
    """Activate or deactivate a staff/manager account and revoke sessions if deactivated."""
    try:
        return update_staff_account_status(
            user_id,
            payload.is_active,
            current_user.id,
            get_settings(),
        )
    except AuthError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc
