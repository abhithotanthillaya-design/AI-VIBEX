"""Database access, order persistence, and row-mapping helpers."""

from datetime import datetime
import secrets
import sqlite3
import uuid

from app.allocator import allocate_pickup_slot
from app.config import Settings
from app.database import db_session, write_transaction
from app.schemas import (
    CreateOrderRequest,
    CreateOrderResponse,
    MenuItemResponse,
    OrderDetailResponse,
    OrderItemResponse,
    OrderStatus,
)

# Unambiguous uppercase alphanumeric characters for short pickup codes (e.g. Q7K2).
_PICKUP_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


class OrderValidationError(Exception):
    """Raised when an incoming order fails domain validation against menu data."""

    def __init__(self, message: str, status_code: int = 400, code: str = "order_error") -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


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


def _generate_unique_pickup_code(conn: sqlite3.Connection) -> str:
    """Generate a collision-free 4-character pickup token inside a write transaction."""
    for length in (4, 5, 6):
        for _ in range(32):
            candidate = "".join(
                secrets.choice(_PICKUP_CODE_ALPHABET) for _ in range(length)
            )
            exists = conn.execute(
                "SELECT 1 FROM orders WHERE pickup_code = ? LIMIT 1",
                (candidate,),
            ).fetchone()
            if exists is None:
                return candidate
    raise RuntimeError("Unable to generate a unique pickup code.")


def create_order(
    payload: CreateOrderRequest,
    settings: Settings,
    *,
    reference_time: datetime | None = None,
) -> CreateOrderResponse:
    """Validate items against DB, compute server totals, allocate slot, and persist order."""
    consolidated_quantities: dict[str, int] = {}
    for entry in payload.items:
        consolidated_quantities[entry.menu_item_id] = (
            consolidated_quantities.get(entry.menu_item_id, 0) + entry.quantity
        )

    item_ids = list(consolidated_quantities.keys())
    placeholders = ", ".join("?" for _ in item_ids)

    with write_transaction() as conn:
        rows = conn.execute(
            f"""
            SELECT id, name, price, prep_minutes, available
            FROM menu_items
            WHERE id IN ({placeholders})
            """,
            item_ids,
        ).fetchall()

        menu_by_id = {str(row["id"]): row for row in rows}
        for requested_id in item_ids:
            if requested_id not in menu_by_id:
                raise OrderValidationError(
                    f"Menu item '{requested_id}' does not exist.",
                    status_code=400,
                    code="unknown_menu_item",
                )

        total_amount = 0
        total_prep_units = 0
        order_items_to_insert: list[tuple[str, str, str, int, int, int]] = []

        for requested_id, qty in consolidated_quantities.items():
            menu_row = menu_by_id[requested_id]
            if not bool(menu_row["available"]):
                raise OrderValidationError(
                    f"'{menu_row['name']}' is currently unavailable.",
                    status_code=400,
                    code="unavailable_menu_item",
                )

            unit_price = int(menu_row["price"])
            prep_minutes = int(menu_row["prep_minutes"])
            total_amount += unit_price * qty
            total_prep_units += prep_minutes * qty
            order_items_to_insert.append(
                (
                    f"oi_{uuid.uuid4().hex[:12]}",
                    requested_id,
                    str(menu_row["name"]),
                    qty,
                    unit_price,
                    prep_minutes,
                )
            )

        allocation = allocate_pickup_slot(
            conn,
            total_prep_units,
            settings,
            reference_time=reference_time,
        )

        now_dt = reference_time or datetime.now(settings.zone_info)
        now_iso = now_dt.isoformat(timespec="seconds")
        slot_start_iso = allocation.slot_start.isoformat(timespec="seconds")
        slot_end_iso = allocation.slot_end.isoformat(timespec="seconds")

        order_id = f"ord_{uuid.uuid4().hex[:10]}"
        pickup_code = _generate_unique_pickup_code(conn)
        order_status: OrderStatus = "PLACED"

        conn.execute(
            """
            INSERT INTO orders (
                id, pickup_code, customer_name, status,
                pickup_slot_start, pickup_slot_end,
                total_amount, total_prep_units, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                order_id,
                pickup_code,
                payload.customer_name,
                order_status,
                slot_start_iso,
                slot_end_iso,
                total_amount,
                total_prep_units,
                payload.notes,
                now_iso,
                now_iso,
            ),
        )

        conn.executemany(
            """
            INSERT INTO order_items (
                id, order_id, menu_item_id, item_name, quantity, unit_price, prep_minutes
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (oi_id, order_id, menu_id, item_name, qty, unit_price, prep_mins)
                for oi_id, menu_id, item_name, qty, unit_price, prep_mins in order_items_to_insert
            ],
        )

    if allocation.dedicated_slot:
        confirmation_message = (
            f"Order placed in a dedicated pickup window due to higher kitchen workload "
            f"({total_prep_units} prep units; standard slot capacity is {allocation.slot_capacity})."
        )
    else:
        confirmation_message = "Order placed. Please arrive during your pickup window."

    return CreateOrderResponse(
        id=order_id,
        pickup_code=pickup_code,
        status=order_status,
        pickup_slot_start=slot_start_iso,
        pickup_slot_end=slot_end_iso,
        total_amount=total_amount,
        message=confirmation_message,
    )


def get_order_by_id(order_id: str) -> OrderDetailResponse | None:
    """Fetch a single order and its snapshotted items by order ID."""
    cleaned_id = order_id.strip()
    if not cleaned_id:
        return None

    with db_session() as conn:
        order_row = conn.execute(
            """
            SELECT id, pickup_code, customer_name, status,
                   pickup_slot_start, pickup_slot_end,
                   total_amount, total_prep_units, notes,
                   created_at, updated_at
            FROM orders
            WHERE id = ?
            """,
            (cleaned_id,),
        ).fetchone()

        if order_row is None:
            return None

        item_rows = conn.execute(
            """
            SELECT id, menu_item_id, item_name, quantity, unit_price, prep_minutes
            FROM order_items
            WHERE order_id = ?
            ORDER BY rowid ASC
            """,
            (cleaned_id,),
        ).fetchall()

    return OrderDetailResponse(
        id=str(order_row["id"]),
        pickup_code=str(order_row["pickup_code"]),
        customer_name=str(order_row["customer_name"]),
        status=str(order_row["status"]),  # type: ignore[arg-type]
        pickup_slot_start=str(order_row["pickup_slot_start"]),
        pickup_slot_end=str(order_row["pickup_slot_end"]),
        total_amount=int(order_row["total_amount"]),
        total_prep_units=int(order_row["total_prep_units"]),
        notes=order_row["notes"],
        created_at=str(order_row["created_at"]),
        updated_at=str(order_row["updated_at"]),
        items=[
            OrderItemResponse(
                id=str(item["id"]),
                menu_item_id=str(item["menu_item_id"]),
                item_name=str(item["item_name"]),
                quantity=int(item["quantity"]),
                unit_price=int(item["unit_price"]),
                prep_minutes=int(item["prep_minutes"]),
            )
            for item in item_rows
        ],
    )
