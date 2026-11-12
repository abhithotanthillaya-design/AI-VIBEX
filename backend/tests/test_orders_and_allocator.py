"""Comprehensive tests for order placement, capacity-aware slot allocation, and order tracking."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
import tempfile

from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import init_db, write_transaction
from app.main import create_app
from app.models import create_order
from app.schemas import CreateOrderRequest, OrderItemCreate
from app.seed import seed_menu_items
from tests.auth_helpers import create_student_client


def _setup_test_app(monkeypatch, tmpdir: str):
    db_file = Path(tmpdir) / "test_orders.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    get_settings.cache_clear()
    return create_app()


def test_valid_order_placement_server_pricing_and_tracking(monkeypatch) -> None:
    """Verify valid order creation calculates prices server-side and is retrievable via tracking API."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            client = create_student_client(app)
            # item_1: Veg Grilled Sandwich (5000 paise, 4 prep) x2 = 10000, 8 prep
            # item_9: Masala Chai (2000 paise, 2 prep) x1 = 2000, 2 prep
            # Total: 12000 paise, 10 prep units
            res = client.post(
                "/api/orders",
                json={
                    "customer_name": "  Aarav Sharma  ",
                    "items": [
                        {"menu_item_id": "item_1", "quantity": 2},
                        {"menu_item_id": "item_9", "quantity": 1},
                    ],
                    "notes": "  Less spicy  ",
                },
            )
            assert res.status_code == 201
            created = res.json()
            assert created["id"].startswith("ord_")
            assert len(created["pickup_code"]) == 4
            assert created["status"] == "PLACED"
            assert created["total_amount"] == 12000
            assert created["pickup_slot_start"] < created["pickup_slot_end"]

            track_res = client.get(f"/api/orders/{created['id']}")
            assert track_res.status_code == 200
            detail = track_res.json()
            assert detail["customer_name"] == "Aarav Sharma"
            assert detail["notes"] == "Less spicy"
            assert detail["total_amount"] == 12000
            assert detail["total_prep_units"] == 10
            assert len(detail["items"]) == 2
            assert detail["items"][0]["unit_price"] == 5000

        get_settings.cache_clear()


def test_order_validation_rejects_invalid_and_unavailable_items_and_bad_quantities(
    monkeypatch,
) -> None:
    """Verify unknown items, unavailable items, zero/negative quantities, and unknown order IDs fail cleanly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            client = create_student_client(app)
            # Unknown menu item
            unknown_res = client.post(
                "/api/orders",
                json={
                    "customer_name": "Student",
                    "items": [{"menu_item_id": "item_unknown", "quantity": 1}],
                },
            )
            assert unknown_res.status_code == 400
            assert unknown_res.json()["error"] == "unknown_menu_item"

            # Unavailable menu item (item_12 Butter Pav Bhaji)
            unavailable_res = client.post(
                "/api/orders",
                json={
                    "customer_name": "Student",
                    "items": [{"menu_item_id": "item_12", "quantity": 1}],
                },
            )
            assert unavailable_res.status_code == 400
            assert unavailable_res.json()["error"] == "unavailable_menu_item"

            # Zero quantity
            zero_res = client.post(
                "/api/orders",
                json={
                    "customer_name": "Student",
                    "items": [{"menu_item_id": "item_1", "quantity": 0}],
                },
            )
            assert zero_res.status_code == 422

            # Negative quantity
            neg_res = client.post(
                "/api/orders",
                json={
                    "customer_name": "Student",
                    "items": [{"menu_item_id": "item_1", "quantity": -2}],
                },
            )
            assert neg_res.status_code == 422

            # Invalid order ID lookup
            missing_order = client.get("/api/orders/ord_nonexistent")
            assert missing_order.status_code == 404
            assert missing_order.json()["error"] == "order_not_found"

        get_settings.cache_clear()


def test_capacity_aware_allocation_overflow_and_slot_reuse(monkeypatch) -> None:
    """Verify earliest-slot fit, full-slot overflow to later slots, and collected/cancelled capacity release."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_allocator.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        monkeypatch.setenv("SLOT_CAPACITY_UNITS", "12")
        monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
        get_settings.cache_clear()

        init_db()
        seed_menu_items()
        settings = get_settings()
        ref_time = datetime.fromisoformat("2026-11-12T12:47:20+05:30")

        # Order 1: 10 units (2 x Sandwich(4) + 1 x Chai(2)) -> Slot 1: 12:50..12:55
        o1 = create_order(
            CreateOrderRequest(
                customer_name="Student 1",
                items=[
                    OrderItemCreate(menu_item_id="item_1", quantity=2),
                    OrderItemCreate(menu_item_id="item_9", quantity=1),
                ],
            ),
            settings,
            reference_time=ref_time,
        )
        assert o1.pickup_slot_start == "2026-11-12T12:50:00+05:30"
        assert o1.pickup_slot_end == "2026-11-12T12:55:00+05:30"

        # Order 2: 6 units (1 x Masala Dosa(6)) -> 10 + 6 > 12, overflows to Slot 2: 12:55..13:00
        o2 = create_order(
            CreateOrderRequest(
                customer_name="Student 2",
                items=[OrderItemCreate(menu_item_id="item_2", quantity=1)],
            ),
            settings,
            reference_time=ref_time,
        )
        assert o2.pickup_slot_start == "2026-11-12T12:55:00+05:30"
        assert o2.pickup_slot_end == "2026-11-12T13:00:00+05:30"

        # Order 3: 2 units (1 x Chai(2)) -> 10 + 2 <= 12, still fits in Slot 1: 12:50..12:55
        o3 = create_order(
            CreateOrderRequest(
                customer_name="Student 3",
                items=[OrderItemCreate(menu_item_id="item_9", quantity=1)],
            ),
            settings,
            reference_time=ref_time,
        )
        assert o3.pickup_slot_start == "2026-11-12T12:50:00+05:30"
        assert o3.pickup_code != o1.pickup_code
        assert o3.pickup_code != o2.pickup_code

        # Mark Order 1 COLLECTED -> releases 10 units in Slot 1
        with write_transaction() as conn:
            conn.execute("UPDATE orders SET status = 'COLLECTED' WHERE id = ?", (o1.id,))

        # Order 4: 8 units (2 x Sandwich(4)) -> Slot 1 has 2 active + 8 = 10 <= 12, fits Slot 1 again
        o4 = create_order(
            CreateOrderRequest(
                customer_name="Student 4",
                items=[OrderItemCreate(menu_item_id="item_1", quantity=2)],
            ),
            settings,
            reference_time=ref_time,
        )
        assert o4.pickup_slot_start == "2026-11-12T12:50:00+05:30"

        # Order 5: 14 units (> 12 capacity) -> requires dedicated empty slot (13:00..13:05)
        o5 = create_order(
            CreateOrderRequest(
                customer_name="Group Order",
                items=[
                    OrderItemCreate(menu_item_id="item_2", quantity=2),
                    OrderItemCreate(menu_item_id="item_9", quantity=1),
                ],
            ),
            settings,
            reference_time=ref_time,
        )
        assert o5.pickup_slot_start == "2026-11-12T13:00:00+05:30"
        assert "dedicated pickup window" in o5.message.lower()

        get_settings.cache_clear()


def test_oversized_order_above_batch_limit_is_rejected(monkeypatch) -> None:
    """Verify orders exceeding 3x slot capacity are safely rejected instead of accepted."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            client = create_student_client(app)
            # 6 x Chole Bhature (7 prep each) = 42 units > 36 max cap
            res = client.post(
                "/api/orders",
                json={
                    "customer_name": "Bulk Order",
                    "items": [{"menu_item_id": "item_6", "quantity": 6}],
                },
            )
            assert res.status_code == 400
            assert res.json()["error"] == "order_too_large"

        get_settings.cache_clear()


def test_simultaneous_orders_do_not_overbook_slot(monkeypatch) -> None:
    """Verify concurrent order creation serializes slot allocation without overbooking."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_concurrency.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        monkeypatch.setenv("SLOT_CAPACITY_UNITS", "12")
        monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
        get_settings.cache_clear()

        init_db()
        seed_menu_items()
        settings = get_settings()
        ref_time = datetime.fromisoformat("2026-11-12T12:47:20+05:30")

        # Fire 6 simultaneous orders of 6 units each -> max 2 orders (12 units) per slot
        def submit(index: int):
            return create_order(
                CreateOrderRequest(
                    customer_name=f"Concurrent Student {index}",
                    items=[OrderItemCreate(menu_item_id="item_2", quantity=1)],
                ),
                settings,
                reference_time=ref_time,
            )

        with ThreadPoolExecutor(max_workers=6) as executor:
            results = list(executor.map(submit, range(6)))

        pickup_codes = {order.pickup_code for order in results}
        assert len(pickup_codes) == 6

        counts_by_slot: dict[str, int] = {}
        for order in results:
            counts_by_slot[order.pickup_slot_start] = (
                counts_by_slot.get(order.pickup_slot_start, 0) + 1
            )

        assert counts_by_slot == {
            "2026-11-12T12:50:00+05:30": 2,
            "2026-11-12T12:55:00+05:30": 2,
            "2026-11-12T13:00:00+05:30": 2,
        }

        get_settings.cache_clear()

