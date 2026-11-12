"""Deterministic, capacity-aware pickup-slot allocation algorithm."""

from dataclasses import dataclass
from datetime import datetime, timedelta
import math
import sqlite3

from app.config import Settings
from app.schemas import (
    AvailablePickupSlotResponse,
    AvailableSlotsResponse,
    SlotAvailabilityState,
    SlotWorkloadResponse,
)

ACTIVE_WORKLOAD_STATUSES = ("PLACED", "ACCEPTED", "PREPARING", "READY")
MAX_EXTENSION_SLOTS = 24  # Up to 2 hours ahead at 5-minute intervals
SLOT_CAPACITY_SETTING_KEY = "slot_capacity_units"


class CapacityAllocationError(Exception):
    """Raised when an order cannot be safely assigned to any pickup slot."""

    def __init__(self, message: str, status_code: int = 400, code: str = "capacity_error") -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code


@dataclass(frozen=True)
class SlotAllocation:
    """Result of assigning an order to a capacity-checked pickup window."""

    slot_start: datetime
    slot_end: datetime
    prior_workload: int
    new_workload: int
    slot_capacity: int
    dedicated_slot: bool


def align_to_slot_start(reference_time: datetime, slot_duration_minutes: int) -> datetime:
    """Round a timezone-aware datetime up to the nearest pickup-slot grid boundary."""
    if slot_duration_minutes <= 0:
        raise ValueError("slot_duration_minutes must be positive.")

    minute_floor = reference_time.replace(second=0, microsecond=0)
    seconds_past_minute = reference_time.second + (reference_time.microsecond / 1_000_000)

    remainder_minutes = minute_floor.minute % slot_duration_minutes
    if remainder_minutes == 0 and seconds_past_minute == 0:
        return minute_floor

    minutes_to_next = slot_duration_minutes - remainder_minutes
    return minute_floor + timedelta(minutes=minutes_to_next)


def get_effective_slot_capacity(
    conn: sqlite3.Connection,
    settings: Settings,
) -> int:
    """Read manager-configured slot capacity from SQLite, falling back to env default."""
    row = conn.execute(
        "SELECT value FROM canteen_settings WHERE key = ?",
        (SLOT_CAPACITY_SETTING_KEY,),
    ).fetchone()
    if row is not None:
        try:
            parsed = int(row["value"])
            if 1 <= parsed <= 100:
                return parsed
        except (TypeError, ValueError):
            pass
    return settings.slot_capacity_units


def get_closed_slots_map(
    conn: sqlite3.Connection,
) -> dict[datetime, str | None]:
    """Return closed pickup slot timestamps mapped to their optional closure reason."""
    rows = conn.execute(
        "SELECT slot_start, reason FROM closed_slots"
    ).fetchall()
    closed: dict[datetime, str | None] = {}
    for row in rows:
        slot_start = datetime.fromisoformat(str(row["slot_start"]))
        closed[slot_start] = row["reason"]
    return closed


def get_active_slot_workloads(
    conn: sqlite3.Connection,
    earliest_slot_start: datetime | None = None,
) -> dict[datetime, tuple[int, int]]:
    """Aggregate active preparation units and active order counts by slot start.

    Excludes COLLECTED and CANCELLED orders so completed or cancelled orders
    never consume current kitchen capacity.
    """
    rows = conn.execute(
        """
        SELECT pickup_slot_start, total_prep_units
        FROM orders
        WHERE status NOT IN ('COLLECTED', 'CANCELLED')
        """
    ).fetchall()

    workloads: dict[datetime, tuple[int, int]] = {}
    for row in rows:
        slot_start = datetime.fromisoformat(str(row["pickup_slot_start"]))
        if earliest_slot_start is not None and slot_start < earliest_slot_start:
            continue
        prev_units, prev_count = workloads.get(slot_start, (0, 0))
        workloads[slot_start] = (
            prev_units + int(row["total_prep_units"]),
            prev_count + 1,
        )
    return workloads


def get_kitchen_slot_workloads(
    conn: sqlite3.Connection,
    settings: Settings,
    *,
    reference_time: datetime | None = None,
) -> list[SlotWorkloadResponse]:
    """Return upcoming pickup slots and any active/closed slots with workload metrics."""
    now = reference_time or datetime.now(settings.zone_info)
    slot_duration = settings.slot_duration_minutes
    slot_capacity = get_effective_slot_capacity(conn, settings)
    first_upcoming = align_to_slot_start(now, slot_duration)

    active_workloads = get_active_slot_workloads(conn, earliest_slot_start=None)
    closed_slots = get_closed_slots_map(conn)

    base_slot_count = max(1, math.ceil(settings.slot_lookahead_minutes / slot_duration))
    slot_starts: set[datetime] = {
        first_upcoming + timedelta(minutes=index * slot_duration)
        for index in range(base_slot_count)
    }
    slot_starts.update(active_workloads.keys())
    for closed_start in closed_slots:
        if closed_start >= first_upcoming:
            slot_starts.add(closed_start)

    slots: list[SlotWorkloadResponse] = []
    for slot_start in sorted(slot_starts):
        slot_end = slot_start + timedelta(minutes=slot_duration)
        used_units, active_orders = active_workloads.get(slot_start, (0, 0))
        remaining_units = max(0, slot_capacity - used_units)
        is_closed = slot_start in closed_slots
        slots.append(
            SlotWorkloadResponse(
                slot_start=slot_start.isoformat(timespec="seconds"),
                slot_end=slot_end.isoformat(timespec="seconds"),
                used_units=used_units,
                capacity_units=slot_capacity,
                remaining_units=remaining_units,
                active_orders=active_orders,
                is_full=used_units >= slot_capacity,
                is_upcoming=slot_start >= first_upcoming,
                is_closed=is_closed,
                close_reason=closed_slots.get(slot_start),
            )
        )
    return slots


def _normalize_slot_timestamp(slot_start_iso: str, settings: Settings) -> datetime:
    """Parse an ISO pickup-slot timestamp into Asia/Kolkata and verify slot alignment."""
    try:
        parsed = datetime.fromisoformat(slot_start_iso.strip())
    except ValueError as exc:
        raise CapacityAllocationError(
            "Requested pickup slot timestamp is invalid.",
            status_code=400,
            code="invalid_requested_slot",
        ) from exc

    tz = settings.zone_info
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
        raise CapacityAllocationError(
            f"Requested pickup slot must align with {slot_duration}-minute boundaries.",
            status_code=400,
            code="invalid_requested_slot",
        )
    return parsed


def classify_slot_availability(
    used_units: int,
    capacity_units: int,
    is_closed: bool,
) -> SlotAvailabilityState:
    """Classify a pickup slot's student-facing availability badge."""
    if is_closed:
        return "closed"
    if used_units >= capacity_units:
        return "full"
    remaining = capacity_units - used_units
    limited_threshold = max(2, math.floor(capacity_units * 0.35))
    if used_units > 0 and remaining <= limited_threshold:
        return "limited"
    return "available"


def is_slot_feasible_for_workload(
    used_units: int,
    capacity_units: int,
    is_closed: bool,
    workload_units: int,
) -> bool:
    """Determine whether an order with `workload_units` can be placed into a slot."""
    if is_closed:
        return False
    if workload_units <= 0:
        return used_units < capacity_units
    if workload_units > capacity_units * 3:
        return False
    if workload_units > capacity_units:
        # Oversized batches require a completely empty open slot.
        return used_units == 0
    return used_units + workload_units <= capacity_units


def list_available_pickup_slots(
    conn: sqlite3.Connection,
    settings: Settings,
    *,
    workload_units: int = 0,
    reference_time: datetime | None = None,
) -> AvailableSlotsResponse:
    """Return chronological upcoming pickup slots and live feasibility for students."""
    now = reference_time or datetime.now(settings.zone_info)
    slot_duration = settings.slot_duration_minutes
    slot_capacity = get_effective_slot_capacity(conn, settings)
    first_upcoming = align_to_slot_start(now, slot_duration)

    active_workloads = get_active_slot_workloads(conn, earliest_slot_start=first_upcoming)
    closed_slots = get_closed_slots_map(conn)

    base_slot_count = max(1, math.ceil(settings.slot_lookahead_minutes / slot_duration))
    total_candidate_slots = max(base_slot_count, MAX_EXTENSION_SLOTS)

    slots: list[AvailablePickupSlotResponse] = []
    recommended_slot_start: str | None = None

    for index in range(total_candidate_slots):
        slot_start = first_upcoming + timedelta(minutes=index * slot_duration)
        slot_end = slot_start + timedelta(minutes=slot_duration)
        used_units, active_orders = active_workloads.get(slot_start, (0, 0))
        remaining_units = max(0, slot_capacity - used_units)
        is_closed = slot_start in closed_slots
        is_full = used_units >= slot_capacity
        is_feasible = is_slot_feasible_for_workload(
            used_units,
            slot_capacity,
            is_closed,
            workload_units,
        )
        slot_start_iso = slot_start.isoformat(timespec="seconds")
        if recommended_slot_start is None and is_feasible:
            recommended_slot_start = slot_start_iso

        slots.append(
            AvailablePickupSlotResponse(
                slot_start=slot_start_iso,
                slot_end=slot_end.isoformat(timespec="seconds"),
                capacity_units=slot_capacity,
                used_units=used_units,
                remaining_units=remaining_units,
                active_orders=active_orders,
                availability_state=classify_slot_availability(
                    used_units,
                    slot_capacity,
                    is_closed,
                ),
                is_closed=is_closed,
                close_reason=closed_slots.get(slot_start),
                is_full=is_full,
                is_feasible=is_feasible,
            )
        )

    return AvailableSlotsResponse(
        slot_duration_minutes=slot_duration,
        slot_capacity_units=slot_capacity,
        requested_workload_units=max(0, workload_units),
        recommended_slot_start=recommended_slot_start,
        slots=slots,
    )


def allocate_pickup_slot(
    conn: sqlite3.Connection,
    order_workload: int,
    settings: Settings,
    *,
    requested_slot_start: str | None = None,
    reference_time: datetime | None = None,
) -> SlotAllocation:
    """Assign the requested slot (if validated) or earliest feasible open pickup slot.

    Rules:
    1. Divide upcoming time into `slot_duration_minutes` (default 5-minute) slots.
    2. Reject or skip any slot closed by a canteen manager (`closed_slots`).
    3. Standard orders (`order_workload <= slot_capacity_units`) take the earliest
       (or student-selected) open slot where `current_workload + order_workload <= slot_capacity_units`.
    4. Orders exceeding a single slot's standard capacity (up to 3x slot capacity)
       are never combined with other orders: they require an empty open slot
       (`current_workload == 0`) so they cannot overbook an active window.
    5. When `requested_slot_start` is supplied, validate and reserve that exact slot
       without silently reassigning to another window on failure.
    6. Orders exceeding the maximum single-order batch cap (3x slot capacity)
       are rejected cleanly with instructions to split the order.
    """
    if order_workload <= 0:
        raise CapacityAllocationError(
            "Order workload must be greater than zero.",
            status_code=400,
            code="invalid_workload",
        )

    slot_duration = settings.slot_duration_minutes
    slot_capacity = get_effective_slot_capacity(conn, settings)
    max_single_order_units = slot_capacity * 3

    if order_workload > max_single_order_units:
        raise CapacityAllocationError(
            (
                f"Order preparation load ({order_workload} units) exceeds the maximum "
                f"single-order limit ({max_single_order_units} units). "
                "Please split this into smaller orders."
            ),
            status_code=400,
            code="order_too_large",
        )

    now = reference_time or datetime.now(settings.zone_info)
    first_slot_start = align_to_slot_start(now, slot_duration)
    active_workloads = get_active_slot_workloads(conn, first_slot_start)
    closed_slots = get_closed_slots_map(conn)

    base_slot_count = max(1, math.ceil(settings.slot_lookahead_minutes / slot_duration))
    total_candidate_slots = max(base_slot_count, MAX_EXTENSION_SLOTS)
    requires_dedicated_slot = order_workload > slot_capacity

    if requested_slot_start is not None:
        requested_dt = _normalize_slot_timestamp(requested_slot_start, settings)
        last_slot_start = first_slot_start + timedelta(
            minutes=(total_candidate_slots - 1) * slot_duration
        )

        if requested_dt < first_slot_start:
            raise CapacityAllocationError(
                "The selected pickup slot has already passed. Please choose an upcoming pickup slot.",
                status_code=400,
                code="slot_in_past",
            )
        if requested_dt > last_slot_start:
            raise CapacityAllocationError(
                "The selected pickup slot is beyond the bookable pickup horizon. Please choose a closer open slot.",
                status_code=400,
                code="slot_out_of_range",
            )

        if requested_dt in closed_slots:
            reason = closed_slots[requested_dt]
            reason_suffix = f" ({reason})" if reason else ""
            raise CapacityAllocationError(
                f"The selected pickup slot is closed{reason_suffix}. Please select another available slot.",
                status_code=409,
                code="slot_closed",
            )

        prior_units, _ = active_workloads.get(requested_dt, (0, 0))
        if not is_slot_feasible_for_workload(
            prior_units,
            slot_capacity,
            False,
            order_workload,
        ):
            remaining_units = max(0, slot_capacity - prior_units)
            if requires_dedicated_slot and prior_units > 0:
                raise CapacityAllocationError(
                    (
                        f"Your order ({order_workload} prep units) requires an empty pickup slot, "
                        f"but the chosen window already has {prior_units} units booked. "
                        "Please select an empty slot."
                    ),
                    status_code=409,
                    code="slot_insufficient_capacity",
                )
            if prior_units >= slot_capacity:
                raise CapacityAllocationError(
                    "The selected pickup slot is now full. Please choose another available slot.",
                    status_code=409,
                    code="slot_full",
                )
            raise CapacityAllocationError(
                (
                    f"The selected pickup slot only has {remaining_units} capacity units left, "
                    f"which cannot fit this {order_workload}-unit order. Please choose another slot."
                ),
                status_code=409,
                code="slot_insufficient_capacity",
            )

        return SlotAllocation(
            slot_start=requested_dt,
            slot_end=requested_dt + timedelta(minutes=slot_duration),
            prior_workload=prior_units,
            new_workload=prior_units + order_workload,
            slot_capacity=slot_capacity,
            dedicated_slot=requires_dedicated_slot,
        )

    for index in range(total_candidate_slots):
        candidate_start = first_slot_start + timedelta(minutes=index * slot_duration)
        if candidate_start in closed_slots:
            continue

        candidate_end = candidate_start + timedelta(minutes=slot_duration)
        prior_units, _ = active_workloads.get(candidate_start, (0, 0))

        if is_slot_feasible_for_workload(
            prior_units,
            slot_capacity,
            False,
            order_workload,
        ):
            return SlotAllocation(
                slot_start=candidate_start,
                slot_end=candidate_end,
                prior_workload=prior_units,
                new_workload=prior_units + order_workload,
                slot_capacity=slot_capacity,
                dedicated_slot=requires_dedicated_slot,
            )

    raise CapacityAllocationError(
        "All upcoming pickup windows are currently closed or at full kitchen capacity. Please try again shortly.",
        status_code=409,
        code="kitchen_full",
    )
