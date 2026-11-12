"""Pydantic request and response schemas for QUEUELESS."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Service readiness payload returned by /api/health."""

    status: str
    service: str
    database: str
    environment: str
    timestamp: str

