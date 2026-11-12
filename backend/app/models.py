"""Database access and row-mapping helpers for QUEUELESS domain models."""

import sqlite3

from app.database import db_session
from app.schemas import MenuItemResponse


def row_to_menu_item(row: sqlite3.Row) -> MenuItemResponse:
    """Convert a SQLite menu_items row into a validated Pydantic model."""
    return MenuItemResponse(
        id=str(row["id"]),
        name=str(row["name"]),
        description=str(row["description"]),
        category=str(row["category"]),
        price=int(row["price"]),
        prep_minutes=int(row["prep_minutes"]),
        available=bool(row["available"]),
        image_url=row["image_url"],
    )


def list_menu_items(
    *,
    category: str | None = None,
    search: str | None = None,
    include_unavailable: bool = False,
) -> list[MenuItemResponse]:
    """Query menu items from SQLite with optional filtering."""
    clauses: list[str] = []
    params: list[object] = []

    if not include_unavailable:
        clauses.append("available = 1")

    if category and category.strip() and category.strip().lower() != "all":
        clauses.append("LOWER(category) = LOWER(?)")
        params.append(category.strip())

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        clauses.append("(LOWER(name) LIKE LOWER(?) OR LOWER(description) LIKE LOWER(?))")
        params.extend([pattern, pattern])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    query = f"""
        SELECT id, name, description, category, price, prep_minutes, available, image_url
        FROM menu_items
        {where_sql}
        ORDER BY category ASC, name ASC
    """

    with db_session() as conn:
        rows = conn.execute(query, params).fetchall()

    return [row_to_menu_item(row) for row in rows]

