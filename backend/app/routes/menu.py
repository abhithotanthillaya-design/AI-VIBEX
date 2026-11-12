"""Menu catalog endpoints."""

from fastapi import APIRouter, Query

from app.models import list_menu_items
from app.schemas import MenuItemResponse

router = APIRouter(tags=["menu"])


@router.get("/menu", response_model=list[MenuItemResponse])
def get_menu(
    category: str | None = Query(
        default=None,
        min_length=1,
        max_length=60,
        description="Optional category filter",
    ),
    search: str | None = Query(
        default=None,
        min_length=1,
        max_length=100,
        description="Optional name or description search term",
    ),
    include_unavailable: bool = Query(
        default=False,
        description="Include unavailable items when true",
    ),
) -> list[MenuItemResponse]:
    """Return available canteen menu items stored in SQLite."""
    return list_menu_items(
        category=category,
        search=search,
        include_unavailable=include_unavailable,
    )

