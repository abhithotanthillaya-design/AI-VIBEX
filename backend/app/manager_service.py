"""Manager dashboard analytics, menu CRUD, order oversight, and slot controls."""

from datetime import date, datetime, timedelta
import sqlite3
import uuid

from app.allocator import (
    SLOT_CAPACITY_SETTING_KEY,
    get_effective_slot_capacity,
    get_kitchen_slot_workloads,
)
from app.config import Settings
from app.database import db_session, write_transaction
from app.models import (
    VALID_ORDER_STATUSES,
    OrderValidationError,
    _build_order_detail,
    fetch_items_by_order,
    list_menu_items,
    row_to_menu_item,
)
from app.schemas import (
    DailySalesPoint,
    ManagerDashboardResponse,
    ManagerSalesSummaryResponse,
    ManagerSlotSettingsResponse,
    MenuItemDeleteResponse,
    MenuItemResponse,
    MenuItemUpsertRequest,
    OrderDetailResponse,
    PopularMenuItemStat,
    SlotWorkloadResponse,
)

ACTIVE_ORDER_STATUSES = {"PLACED", "ACCEPTED", "PREPARING", "READY"}


def _fetch_active_menu_row(conn: sqlite3.Connection, item_id: str) -> sqlite3.Row:
    """Fetch a non-deleted menu_items row or raise 404."""
    row = conn.execute(
        """
        SELECT id, name, description, category, price, prep_minutes, available, is_veg, image_url
        FROM menu_items
        WHERE id = ? AND is_deleted = 0
        """,
        (item_id,),
    ).fetchone()
    if row is None:
        raise OrderValidationError(
            f"Menu item '{item_id}' was not found.",
            status_code=404,
            code="menu_item_not_found",
        )
    return row


def list_manager_menu_items() -> list[MenuItemResponse]:
    """Return all non-deleted menu items (both available and sold out)."""
    return list_menu_items(include_unavailable=True, include_deleted=False)


def create_manager_menu_item(payload: MenuItemUpsertRequest) -> MenuItemResponse:
    """Create a new menu item in SQLite."""
    item_id = f"item_{uuid.uuid4().hex[:8]}"
    with write_transaction() as conn:
        conn.execute(
            """
            INSERT INTO menu_items (
                id, name, description, category, price, prep_minutes, available, is_veg, is_deleted, image_url
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (
                item_id,
                payload.name,
                payload.description,
                payload.category,
                payload.price,
                payload.prep_minutes,
                1 if payload.available else 0,
                1 if payload.is_veg else 0,
                payload.image_url,
            ),
        )
        row = _fetch_active_menu_row(conn, item_id)
    return row_to_menu_item(row)


def update_manager_menu_item(
    item_id: str,
    payload: MenuItemUpsertRequest,
) -> MenuItemResponse:
    """Update an existing non-deleted menu item without altering historical order snapshots."""
    cleaned_id = item_id.strip()
    with write_transaction() as conn:
        _fetch_active_menu_row(conn, cleaned_id)
        conn.execute(
            """
            UPDATE menu_items
            SET name = ?, description = ?, category = ?, price = ?,
                prep_minutes = ?, available = ?, is_veg = ?, image_url = ?
            WHERE id = ? AND is_deleted = 0
            """,
            (
                payload.name,
                payload.description,
                payload.category,
                payload.price,
                payload.prep_minutes,
                1 if payload.available else 0,
                1 if payload.is_veg else 0,
                payload.image_url,
                cleaned_id,
            ),
        )
        row = _fetch_active_menu_row(conn, cleaned_id)
    return row_to_menu_item(row)


def update_menu_item_availability(
    item_id: str,
    available: bool,
) -> MenuItemResponse:
    """Toggle menu item availability immediately reflected in student menu."""
    cleaned_id = item_id.strip()
    with write_transaction() as conn:
        _fetch_active_menu_row(conn, cleaned_id)
        conn.execute(
            "UPDATE menu_items SET available = ? WHERE id = ? AND is_deleted = 0",
            (1 if available else 0, cleaned_id),
        )
        row = _fetch_active_menu_row(conn, cleaned_id)
    return row_to_menu_item(row)


def delete_manager_menu_item(item_id: str) -> MenuItemDeleteResponse:
    """Soft-delete a menu item so historical order_items snapshots remain intact."""
    cleaned_id = item_id.strip()
    with write_transaction() as conn:
        row = _fetch_active_menu_row(conn, cleaned_id)
        item_name = str(row["name"])
        conn.execute(
            "UPDATE menu_items SET is_deleted = 1, available = 0 WHERE id = ?",
            (cleaned_id,),
        )
    return MenuItemDeleteResponse(
        status="ok",
        id=cleaned_id,
        archived=True,
        message=f"'{item_name}' removed from menu while preserving historical order records.",
    )


def list_manager_orders(
    settings: Settings,
    *,
    status_filter: str | None = None,
    date_filter: str | None = None,
    search: str | None = None,
) -> list[OrderDetailResponse]:
    """List orders for manager oversight with status, date, and search filters."""
    normalized_status = (status_filter or "all").strip().upper()
    clauses: list[str] = []
    params: list[object] = []

    if normalized_status == "ALL":
        pass
    elif normalized_status == "ACTIVE":
        clauses.append("status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY')")
    elif normalized_status == "COMPLETED":
        clauses.append("status = 'COLLECTED'")
    elif normalized_status == "CANCELLED":
        clauses.append("status = 'CANCELLED'")
    elif normalized_status in VALID_ORDER_STATUSES:
        clauses.append("status = ?")
        params.append(normalized_status)
    else:
        raise OrderValidationError(
            f"Unsupported order status filter '{status_filter}'.",
            status_code=400,
            code="invalid_status_filter",
        )

    target_date: date | None = None
    if date_filter and date_filter.strip():
        try:
            target_date = date.fromisoformat(date_filter.strip())
        except ValueError as exc:
            raise OrderValidationError(
                "Date filter must use YYYY-MM-DD format.",
                status_code=400,
                code="invalid_date_filter",
            ) from exc

    if search and search.strip():
        pattern = f"%{search.strip()}%"
        clauses.append(
            "(LOWER(id) LIKE LOWER(?) OR LOWER(pickup_code) LIKE LOWER(?) OR LOWER(customer_name) LIKE LOWER(?))"
        )
        params.extend([pattern, pattern, pattern])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    with db_session() as conn:
        order_rows = conn.execute(
            f"""
            SELECT id, pickup_code, customer_name, status,
                   pickup_slot_start, pickup_slot_end,
                   total_amount, total_prep_units, notes,
                   created_at, updated_at
            FROM orders
            {where_sql}
            ORDER BY created_at DESC, pickup_slot_start DESC
            """,
            params,
        ).fetchall()

        if target_date is not None:
            tz = settings.zone_info
            order_rows = [
                row
                for row in order_rows
                if datetime.fromisoformat(str(row["created_at"])).astimezone(tz).date()
                == target_date
            ]

        if not order_rows:
            return []

        order_ids = [str(row["id"]) for row in order_rows]
        items_by_order = fetch_items_by_order(conn, order_ids)

    return [
        _build_order_detail(row, items_by_order.get(str(row["id"]), []))
        for row in order_rows
    ]


def get_manager_dashboard(
    settings: Settings,
    *,
    reference_time: datetime | None = None,
) -> ManagerDashboardResponse:
    """Compute real-time manager dashboard statistics from SQLite in Asia/Kolkata."""
    tz = settings.zone_info
    now = (reference_time or datetime.now(tz)).astimezone(tz)
    today = now.date()

    with db_session() as conn:
        order_rows = conn.execute(
            "SELECT status, total_amount, created_at FROM orders"
        ).fetchall()
        menu_counts = conn.execute(
            """
            SELECT
                COUNT(*) AS total_count,
                COALESCE(SUM(CASE WHEN available = 1 THEN 1 ELSE 0 END), 0) AS available_count,
                COALESCE(SUM(CASE WHEN available = 0 THEN 1 ELSE 0 END), 0) AS unavailable_count
            FROM menu_items
            WHERE is_deleted = 0
            """
        ).fetchone()
        slots = get_kitchen_slot_workloads(conn, settings, reference_time=now)

    today_sales_paise = 0
    today_orders = 0
    active_orders = 0
    completed_orders = 0
    cancelled_orders = 0

    for row in order_rows:
        status = str(row["status"])
        amount = int(row["total_amount"])
        created_local_date = (
            datetime.fromisoformat(str(row["created_at"])).astimezone(tz).date()
        )

        if created_local_date == today and status != "CANCELLED":
            today_orders += 1
        if created_local_date == today and status == "COLLECTED":
            today_sales_paise += amount

        if status in ACTIVE_ORDER_STATUSES:
            active_orders += 1
        elif status == "COLLECTED":
            completed_orders += 1
        elif status == "CANCELLED":
            cancelled_orders += 1

    upcoming_slots = [slot for slot in slots if slot.is_upcoming]
    current_slot = upcoming_slots[0] if upcoming_slots else (slots[0] if slots else None)

    occupied_slots = [slot for slot in slots if slot.used_units > 0]
    busiest_slot = (
        max(occupied_slots, key=lambda s: (s.used_units, s.active_orders))
        if occupied_slots
        else None
    )

    return ManagerDashboardResponse(
        today_date=today.isoformat(),
        today_sales_paise=today_sales_paise,
        today_orders=today_orders,
        active_orders=active_orders,
        completed_orders=completed_orders,
        cancelled_orders=cancelled_orders,
        total_menu_items=int(menu_counts["total_count"]),
        available_menu_items=int(menu_counts["available_count"]),
        unavailable_menu_items=int(menu_counts["unavailable_count"]),
        current_slot=current_slot,
        busiest_slot=busiest_slot,
    )


def get_manager_sales_summary(
    settings: Settings,
    *,
    reference_time: datetime | None = None,
) -> ManagerSalesSummaryResponse:
    """Aggregate finalized sales from COLLECTED orders only (excludes CANCELLED/uncollected)."""
    tz = settings.zone_info
    now = (reference_time or datetime.now(tz)).astimezone(tz)
    today = now.date()
    day_window = [today - timedelta(days=offset) for offset in range(6, -1, -1)]
    daily_buckets: dict[date, tuple[int, int]] = {d: (0, 0) for d in day_window}

    with db_session() as conn:
        collected_rows = conn.execute(
            """
            SELECT total_amount, created_at
            FROM orders
            WHERE status = 'COLLECTED'
            """
        ).fetchall()

        top_item_rows = conn.execute(
            """
            SELECT
                oi.menu_item_id,
                oi.item_name,
                SUM(oi.quantity) AS quantity_sold,
                SUM(oi.quantity * oi.unit_price) AS revenue_paise
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            WHERE o.status = 'COLLECTED'
            GROUP BY oi.menu_item_id, oi.item_name
            ORDER BY quantity_sold DESC, revenue_paise DESC, oi.item_name ASC
            LIMIT 5
            """
        ).fetchall()

    today_sales_paise = 0
    total_collected_orders = len(collected_rows)
    total_collected_revenue_paise = 0

    for row in collected_rows:
        amount = int(row["total_amount"])
        total_collected_revenue_paise += amount
        local_day = datetime.fromisoformat(str(row["created_at"])).astimezone(tz).date()
        if local_day == today:
            today_sales_paise += amount
        if local_day in daily_buckets:
            prev_count, prev_rev = daily_buckets[local_day]
            daily_buckets[local_day] = (prev_count + 1, prev_rev + amount)

    average_order_value_paise = (
        total_collected_revenue_paise // total_collected_orders
        if total_collected_orders > 0
        else 0
    )

    daily_sales = [
        DailySalesPoint(
            date=d.isoformat(),
            label=d.strftime("%d %b"),
            order_count=daily_buckets[d][0],
            revenue_paise=daily_buckets[d][1],
        )
        for d in day_window
    ]

    top_items = [
        PopularMenuItemStat(
            menu_item_id=str(row["menu_item_id"]),
            item_name=str(row["item_name"]),
            quantity_sold=int(row["quantity_sold"]),
            revenue_paise=int(row["revenue_paise"]),
        )
        for row in top_item_rows
    ]

    return ManagerSalesSummaryResponse(
        today_sales_paise=today_sales_paise,
        total_collected_orders=total_collected_orders,
        total_collected_revenue_paise=total_collected_revenue_paise,
        average_order_value_paise=average_order_value_paise,
        daily_sales=daily_sales,
        top_items=top_items,
    )


def get_manager_slot_settings(
    settings: Settings,
    *,
    reference_time: datetime | None = None,
) -> ManagerSlotSettingsResponse:
    """Return DB-backed capacity settings and upcoming/active slot states."""
    with db_session() as conn:
        capacity = get_effective_slot_capacity(conn, settings)
        slots = get_kitchen_slot_workloads(conn, settings, reference_time=reference_time)
    return ManagerSlotSettingsResponse(
        slot_capacity_units=capacity,
        slot_duration_minutes=settings.slot_duration_minutes,
        slots=slots,
    )


def update_slot_capacity_setting(
    capacity_units: int,
    settings: Settings,
) -> ManagerSlotSettingsResponse:
    """Persist new default slot capacity without modifying existing order slot assignments."""
    now_iso = datetime.now(settings.zone_info).isoformat(timespec="seconds")
    with write_transaction() as conn:
        conn.execute(
            """
            INSERT INTO canteen_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = excluded.updated_at
            """,
            (SLOT_CAPACITY_SETTING_KEY, str(capacity_units), now_iso),
        )
        slots = get_kitchen_slot_workloads(conn, settings)

    return ManagerSlotSettingsResponse(
        slot_capacity_units=capacity_units,
        slot_duration_minutes=settings.slot_duration_minutes,
        slots=slots,
    )


def update_slot_closure_status(
    slot_start_iso: str,
    is_closed: bool,
    reason: str | None,
    settings: Settings,
) -> SlotWorkloadResponse:
    """Close or reopen a 5-minute pickup slot without altering existing orders."""
    tz = settings.zone_info
    try:
        parsed = datetime.fromisoformat(slot_start_iso.strip())
    except ValueError as exc:
        raise OrderValidationError(
            "Invalid pickup slot timestamp.",
            status_code=400,
            code="invalid_slot_timestamp",
        ) from exc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=tz)
    else:
        parsed = parsed.astimezone(tz)

    slot_duration = settings.slot_duration_minutes
    if (
        parsed.minute % slot_duration != 0
        or parsed.second != 0
        or parsed.microsecond != 0
    ):
        raise OrderValidationError(
            f"Slot timestamp must align with {slot_duration}-minute boundaries.",
            status_code=400,
            code="unaligned_slot_timestamp",
        )

    canonical_start = parsed.isoformat(timespec="seconds")
    now_iso = datetime.now(tz).isoformat(timespec="seconds")

    with write_transaction() as conn:
        if is_closed:
            conn.execute(
                """
                INSERT INTO closed_slots (slot_start, reason, closed_at)
                VALUES (?, ?, ?)
                ON CONFLICT(slot_start) DO UPDATE SET
                    reason = excluded.reason,
                    closed_at = excluded.closed_at
                """,
                (canonical_start, reason, now_iso),
            )
        else:
            conn.execute(
                "DELETE FROM closed_slots WHERE slot_start = ?",
                (canonical_start,),
            )

        slots = get_kitchen_slot_workloads(conn, settings)

    matching = next((s for s in slots if s.slot_start == canonical_start), None)
    if matching is not None:
        return matching

    slot_end = (parsed + timedelta(minutes=slot_duration)).isoformat(timespec="seconds")
    with db_session() as conn:
        capacity = get_effective_slot_capacity(conn, settings)
    return SlotWorkloadResponse(
        slot_start=canonical_start,
        slot_end=slot_end,
        used_units=0,
        capacity_units=capacity,
        remaining_units=capacity,
        active_orders=0,
        is_full=False,
        is_upcoming=False,
        is_closed=is_closed,
        close_reason=reason if is_closed else None,
    )

