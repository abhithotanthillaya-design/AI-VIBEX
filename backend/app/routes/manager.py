"""Manager dashboard, menu CRUD, order oversight, sales, and slot settings routes."""

from fastapi import APIRouter, HTTPException, Query, status

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
)

router = APIRouter(prefix="/manager", tags=["manager"])


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
)
def manager_create_menu_item(payload: MenuItemUpsertRequest) -> MenuItemResponse:
    """Add a new dish to the canteen menu."""
    return create_manager_menu_item(payload)


@router.put("/menu/{item_id}", response_model=MenuItemResponse)
def manager_update_menu_item(
    item_id: str,
    payload: MenuItemUpsertRequest,
) -> MenuItemResponse:
    """Edit an existing menu item without altering historical order snapshots."""
    try:
        return update_manager_menu_item(item_id, payload)
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.patch("/menu/{item_id}/availability", response_model=MenuItemResponse)
def manager_toggle_availability(
    item_id: str,
    payload: MenuItemAvailabilityRequest,
) -> MenuItemResponse:
    """Mark a menu item available or sold out."""
    try:
        return update_menu_item_availability(item_id, payload.available)
    except OrderValidationError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail={"error": exc.code, "message": exc.message},
        ) from exc


@router.delete("/menu/{item_id}", response_model=MenuItemDeleteResponse)
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


@router.patch("/settings/capacity", response_model=ManagerSlotSettingsResponse)
def manager_update_capacity(
    payload: CapacityUpdateRequest,
) -> ManagerSlotSettingsResponse:
    """Update default pickup-slot capacity in the database."""
    return update_slot_capacity_setting(payload.slot_capacity_units, get_settings())


@router.patch("/slots/status", response_model=SlotWorkloadResponse)
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

