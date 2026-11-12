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
    """Menu item payload returned by /api/menu."""

    id: str
    name: str
    description: str
    category: str
    price: int = Field(ge=0, description="Price in paise")
    prep_minutes: int = Field(gt=0, description="Estimated preparation units/minutes")
    available: bool
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
