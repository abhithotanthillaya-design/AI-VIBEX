"""Pydantic request and response schemas for QUEUELESS."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

OrderStatus = Literal[
    "PLACED",
    "ACCEPTED",
    "PREPARING",
    "READY",
    "COLLECTED",
    "CANCELLED",
]


class HealthResponse(BaseModel):
    """Service readiness payload returned by /api/health."""

    status: str
    service: str
    database: str
    environment: str
    timestamp: str


class MenuItemResponse(BaseModel):
    """Menu item payload returned by /api/menu and /api/manager/menu."""

    id: str
    name: str
    description: str
    category: str
    price: int = Field(ge=0, description="Price in paise")
    prep_minutes: int = Field(gt=0, description="Estimated preparation units/minutes")
    available: bool
    is_veg: bool = True
    image_url: str | None = None


class OrderItemCreate(BaseModel):
    """Single item requested by a student when placing an order."""

    menu_item_id: str = Field(min_length=1, max_length=64)
    quantity: int = Field(gt=0, le=50)

    @field_validator("menu_item_id")
    @classmethod
    def validate_menu_item_id(cls, value: str) -> str:
        """Ensure menu_item_id is non-blank."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("menu_item_id cannot be blank.")
        return cleaned


class CreateOrderRequest(BaseModel):
    """Payload accepted by POST /api/orders."""

    customer_name: str = Field(min_length=1, max_length=80)
    items: list[OrderItemCreate] = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=300)

    @field_validator("customer_name")
    @classmethod
    def validate_customer_name(cls, value: str) -> str:
        """Ensure customer_name contains non-whitespace characters."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Customer name is required.")
        return cleaned

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        """Trim optional notes and convert empty strings to None."""
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class CreateOrderResponse(BaseModel):
    """Confirmation payload returned by POST /api/orders."""

    id: str
    pickup_code: str
    status: OrderStatus
    pickup_slot_start: str
    pickup_slot_end: str
    total_amount: int
    message: str


class OrderItemResponse(BaseModel):
    """Line item snapshot attached to an order."""

    id: str
    menu_item_id: str
    item_name: str
    quantity: int
    unit_price: int
    prep_minutes: int


class OrderDetailResponse(BaseModel):
    """Full order payload returned by GET /api/orders/{order_id}."""

    id: str
    pickup_code: str
    customer_name: str
    status: OrderStatus
    pickup_slot_start: str
    pickup_slot_end: str
    total_amount: int
    total_prep_units: int
    notes: str | None = None
    created_at: str
    updated_at: str
    items: list[OrderItemResponse]


class OrderStatusUpdateRequest(BaseModel):
    """Payload accepted by PATCH /api/kitchen/orders/{order_id}/status."""

    status: OrderStatus


class SlotWorkloadResponse(BaseModel):
    """Pickup-slot capacity and active workload summary returned by /api/kitchen/slots."""

    slot_start: str
    slot_end: str
    used_units: int
    capacity_units: int
    remaining_units: int
    active_orders: int
    is_full: bool
    is_upcoming: bool
    is_closed: bool = False
    close_reason: str | None = None


class DemoResetResponse(BaseModel):
    """Payload returned by POST /api/demo/reset (hackathon demo mode only)."""

    status: str
    deleted_orders: int
    deleted_order_items: int
    available_menu_items: int
    message: str


MenuCategory = Literal["Meals", "Fast Food", "Snacks", "Beverages"]

_CANONICAL_CATEGORIES: dict[str, MenuCategory] = {
    "meals": "Meals",
    "fast food": "Fast Food",
    "snacks": "Snacks",
    "beverages": "Beverages",
}


class MenuItemUpsertRequest(BaseModel):
    """Payload accepted by POST /api/manager/menu and PUT /api/manager/menu/{item_id}."""

    name: str = Field(min_length=2, max_length=80)
    description: str = Field(min_length=4, max_length=300)
    category: MenuCategory
    price: int = Field(gt=0, le=500000, description="Positive price in paise")
    prep_minutes: int = Field(gt=0, le=60, description="Positive preparation time")
    image_url: str | None = Field(default=None, max_length=500)
    is_veg: bool = True
    available: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        """Ensure dish name is non-blank and within bounds."""
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Item name must be at least 2 characters.")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        """Ensure description is non-blank and within bounds."""
        cleaned = value.strip()
        if len(cleaned) < 4:
            raise ValueError("Description must be at least 4 characters.")
        return cleaned

    @field_validator("category", mode="before")
    @classmethod
    def normalize_category(cls, value: object) -> str:
        """Normalize supported category names case-insensitively."""
        if not isinstance(value, str):
            raise ValueError("Category must be a string.")
        canonical = _CANONICAL_CATEGORIES.get(value.strip().lower())
        if canonical is None:
            raise ValueError(
                "Category must be one of: Meals, Fast Food, Snacks, Beverages."
            )
        return canonical

    @field_validator("image_url")
    @classmethod
    def validate_image_url(cls, value: str | None) -> str | None:
        """Allow relative / paths or http(s) URLs; reject unsafe schemes."""
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        if not (
            cleaned.startswith("/")
            or cleaned.startswith("https://")
            or cleaned.startswith("http://")
        ):
            raise ValueError(
                "Image URL must start with '/', 'http://', or 'https://'."
            )
        return cleaned


class MenuItemAvailabilityRequest(BaseModel):
    """Payload accepted by PATCH /api/manager/menu/{item_id}/availability."""

    available: bool


class MenuItemDeleteResponse(BaseModel):
    """Payload returned by DELETE /api/manager/menu/{item_id}."""

    status: str
    id: str
    archived: bool
    message: str


class ManagerDashboardResponse(BaseModel):
    """Real-time KPI summary returned by GET /api/manager/dashboard."""

    today_date: str
    today_sales_paise: int
    today_orders: int
    active_orders: int
    completed_orders: int
    cancelled_orders: int
    total_menu_items: int
    available_menu_items: int
    unavailable_menu_items: int
    current_slot: SlotWorkloadResponse | None = None
    busiest_slot: SlotWorkloadResponse | None = None


class DailySalesPoint(BaseModel):
    """Single day bucket in the 7-day sales summary."""

    date: str
    label: str
    order_count: int
    revenue_paise: int


class PopularMenuItemStat(BaseModel):
    """Aggregated item sales stat across collected orders."""

    menu_item_id: str
    item_name: str
    quantity_sold: int
    revenue_paise: int


class ManagerSalesSummaryResponse(BaseModel):
    """Finalized sales analytics returned by GET /api/manager/sales."""

    today_sales_paise: int
    total_collected_orders: int
    total_collected_revenue_paise: int
    average_order_value_paise: int
    daily_sales: list[DailySalesPoint]
    top_items: list[PopularMenuItemStat]


class ManagerSlotSettingsResponse(BaseModel):
    """Slot capacity configuration and live pickup-slot controls."""

    slot_capacity_units: int
    slot_duration_minutes: int
    slots: list[SlotWorkloadResponse]


class CapacityUpdateRequest(BaseModel):
    """Payload accepted by PATCH /api/manager/settings/capacity."""

    slot_capacity_units: int = Field(ge=1, le=100)


class SlotClosureRequest(BaseModel):
    """Payload accepted by PATCH /api/manager/slots/status."""

    slot_start: str = Field(min_length=1, max_length=64)
    is_closed: bool
    reason: str | None = Field(default=None, max_length=160)

    @field_validator("reason")
    @classmethod
    def normalize_reason(cls, value: str | None) -> str | None:
        """Trim optional slot closure reason."""
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

