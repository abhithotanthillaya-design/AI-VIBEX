"""Pydantic request and response schemas for QUEUELESS."""

from pydantic import BaseModel, Field


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
