"""Plain-language / natural-language order parsing endpoint."""

from fastapi import APIRouter

from app.config import get_settings
from app.natural_order import parse_natural_order
from app.schemas import NaturalOrderParseRequest, NaturalOrderParseResponse

router = APIRouter(prefix="/natural-order", tags=["natural-order"])


@router.post("/parse", response_model=NaturalOrderParseResponse)
def parse_natural_language_order(
    payload: NaturalOrderParseRequest,
) -> NaturalOrderParseResponse:
    """Interpret plain-language food text against live SQLite menu and slot state."""
    return parse_natural_order(payload.text, get_settings())

