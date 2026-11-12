"""Pydantic request and response schemas for QUEUELESS."""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

_CONTROL_CHARS_RE = re.compile(r"[\x00-\x1f\x7f]+")


def sanitize_text_input(value: str | None) -> str | None:
    """Strip control characters and normalize whitespace without guessing HTML intent."""
    if value is None:
        return None
    cleaned = re.sub(r"\s+", " ", _CONTROL_CHARS_RE.sub(" ", value)).strip()
    return cleaned or None


OrderStatus = Literal[
    "PLACED",
    "ACCEPTED",
    "PREPARING",
    "READY",
    "COLLECTED",
    "CANCELLED",
]

DemoPaymentMethod = Literal["DEMO_UPI", "COUNTER_CASH"]
DemoPaymentStatus = Literal[
    "PAY_AT_COUNTER",
    "PENDING",
    "DEMO_PAID",
    "DEMO_FAILED",
    "DEMO_CANCELLED",
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
    is_vegan: bool = False
    is_jain: bool = False
    allergen_info: str | None = None
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
    requested_pickup_slot_start: str | None = Field(
        default=None,
        max_length=64,
        description="Optional ISO-8601 pickup slot start timestamp chosen by the student.",
    )
    payment_method: DemoPaymentMethod = "COUNTER_CASH"

    @field_validator("customer_name")
    @classmethod
    def validate_customer_name(cls, value: str) -> str:
        """Ensure customer_name contains non-whitespace printable characters."""
        cleaned = sanitize_text_input(value)
        if not cleaned:
            raise ValueError("Customer name is required.")
        return cleaned

    @field_validator("notes")
    @classmethod
    def normalize_notes(cls, value: str | None) -> str | None:
        """Trim/sanitize optional special instructions and convert empty strings to None."""
        return sanitize_text_input(value)

    @field_validator("requested_pickup_slot_start")
    @classmethod
    def normalize_requested_slot(cls, value: str | None) -> str | None:
        """Trim optional pickup slot timestamp and convert empty strings to None."""
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class CreateOrderResponse(BaseModel):
    """Confirmation payload returned by POST /api/orders."""

    id: str
    pickup_code: str
    pickup_token: str
    status: OrderStatus
    pickup_slot_start: str
    pickup_slot_end: str
    total_amount: int
    payment_method: DemoPaymentMethod = "COUNTER_CASH"
    payment_status: DemoPaymentStatus = "PAY_AT_COUNTER"
    payment_reference: str | None = None
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
    payment_method: DemoPaymentMethod = "COUNTER_CASH"
    payment_status: DemoPaymentStatus = "PAY_AT_COUNTER"
    payment_reference: str | None = None
    created_at: str
    updated_at: str
    items: list[OrderItemResponse]


class DemoPaymentRequest(BaseModel):
    """Payload accepted by POST /api/orders/{order_id}/demo-payment."""

    outcome: Literal["succeed", "fail", "cancel", "switch_to_counter"]
    method: DemoPaymentMethod = "DEMO_UPI"


class DemoPaymentResponse(BaseModel):
    """Result returned by simulated demo payment endpoint."""

    status: str
    payment_status: DemoPaymentStatus
    message: str
    order: OrderDetailResponse


class VerifyPickupRequest(BaseModel):
    """Payload accepted by POST /api/kitchen/verify-pickup."""

    token: str = Field(min_length=8, max_length=256)

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        """Trim token whitespace and ensure non-empty bearer token."""
        cleaned = value.strip()
        if len(cleaned) < 8:
            raise ValueError("Verification token is invalid or incomplete.")
        return cleaned


class VerifyPickupResponse(BaseModel):
    """Payload returned by POST /api/kitchen/verify-pickup on valid collection."""

    status: str
    verified: bool
    message: str
    order: OrderDetailResponse


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


SlotAvailabilityState = Literal["available", "limited", "full", "closed"]


class AvailablePickupSlotResponse(BaseModel):
    """Student-facing upcoming pickup slot capacity and availability status."""

    slot_start: str
    slot_end: str
    capacity_units: int
    used_units: int
    remaining_units: int
    active_orders: int
    availability_state: SlotAvailabilityState
    is_closed: bool = False
    close_reason: str | None = None
    is_full: bool
    is_feasible: bool


class AvailableSlotsResponse(BaseModel):
    """Chronological upcoming pickup slots returned by GET /api/slots/available."""

    slot_duration_minutes: int
    slot_capacity_units: int
    requested_workload_units: int = 0
    recommended_slot_start: str | None = None
    slots: list[AvailablePickupSlotResponse]


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
    is_vegan: bool = False
    is_jain: bool = False
    allergen_info: str | None = Field(default=None, max_length=200)
    available: bool = True

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        """Ensure dish name is non-blank and within bounds."""
        cleaned = sanitize_text_input(value) or ""
        if len(cleaned) < 2:
            raise ValueError("Item name must be at least 2 characters.")
        return cleaned

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        """Ensure description is non-blank and within bounds."""
        cleaned = sanitize_text_input(value) or ""
        if len(cleaned) < 4:
            raise ValueError("Description must be at least 4 characters.")
        return cleaned

    @field_validator("allergen_info")
    @classmethod
    def normalize_allergen_info(cls, value: str | None) -> str | None:
        """Sanitize manager-provided allergen string without guessing values."""
        return sanitize_text_input(value)

    @model_validator(mode="after")
    def validate_dietary_consistency(self) -> "MenuItemUpsertRequest":
        """Prevent marking Non-Veg dishes as Vegan or Jain-friendly."""
        if not self.is_veg and (self.is_vegan or self.is_jain):
            raise ValueError("Vegan or Jain-friendly dishes must also be Vegetarian.")
        return self

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


class NaturalOrderParseRequest(BaseModel):
    """Payload accepted by POST /api/natural-order/parse."""

    text: str = Field(min_length=1, max_length=400)

    @field_validator("text")
    @classmethod
    def validate_text(cls, value: str) -> str:
        """Ensure natural-language order text is non-blank."""
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Please enter what you would like to order.")
        return cleaned


class ParsedOrderItem(BaseModel):
    """Single matched or unavailable menu item extracted from plain-language text."""

    menu_item_id: str
    name: str
    category: str
    quantity: int
    unit_price: int
    line_total: int
    prep_minutes: int
    available: bool
    is_veg: bool
    matched_phrase: str
    match_type: Literal["exact", "synonym", "fuzzy"]


class AmbiguousOrderTerm(BaseModel):
    """Ambiguous request phrase requiring explicit user selection."""

    phrase: str
    quantity: int
    candidates: list[MenuItemResponse]


class ParsedPickupTime(BaseModel):
    """Extracted preferred pickup time evaluated against Asia/Kolkata and live slots."""

    raw_text: str
    requested_time_iso: str | None = None
    formatted_time: str | None = None
    status: Literal["valid_note", "unavailable", "past", "invalid"]
    message: str
    matched_slot_start: str | None = None
    suggested_slots: list[SlotWorkloadResponse] = Field(default_factory=list)


class NaturalOrderParseResponse(BaseModel):
    """Structured interpretation preview returned by POST /api/natural-order/parse."""

    original_text: str
    matched_items: list[ParsedOrderItem]
    unavailable_items: list[ParsedOrderItem]
    ambiguous_items: list[AmbiguousOrderTerm]
    unmatched_terms: list[str]
    warnings: list[str]
    requested_pickup_time: ParsedPickupTime | None = None
    subtotal_paise: int
    total_prep_units: int
    can_add_to_cart: bool


class VerifyPickupRequest(BaseModel):
    """Payload accepted by POST /api/kitchen/verify-pickup."""

    token: str = Field(min_length=8, max_length=256)

    @field_validator("token")
    @classmethod
    def validate_token(cls, value: str) -> str:
        """Trim token whitespace and ensure non-empty bearer token."""
        cleaned = value.strip()
        if len(cleaned) < 8:
            raise ValueError("Verification token is invalid or incomplete.")
        return cleaned


class VerifyPickupResponse(BaseModel):
    """Payload returned by POST /api/kitchen/verify-pickup on valid collection."""

    status: str
    verified: bool
    message: str
    order: OrderDetailResponse

