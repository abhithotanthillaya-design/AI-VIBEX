"""Tests for kitchen order queue, status transitions, slot workload, and concurrency."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
import tempfile

from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import init_db
from app.main import create_app
from app.models import create_order
from app.schemas import CreateOrderRequest, OrderItemCreate
from app.seed import seed_menu_items
from tests.auth_helpers import create_manager_client, create_staff_client, create_student_client


def _setup_test_app(monkeypatch, tmpdir: str):
    db_file = Path(tmpdir) / "test_kitchen.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    monkeypatch.setenv("SLOT_CAPACITY_UNITS", "12")
    monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
    get_settings.cache_clear()
    return create_app()


def test_kitchen_order_listing_sorting_and_status_filtering(monkeypatch) -> None:
    """Verify active orders exclude COLLECTED/CANCELLED, sort by slot then created_at, and filter cleanly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)
            student = create_student_client(app)
            # Order 1: 10 prep units -> earliest slot
            o1 = student.post(
                "/api/orders",
                json={
                    "customer_name": "First Student",
                    "items": [
                        {"menu_item_id": "item_1", "quantity": 2},
                        {"menu_item_id": "item_9", "quantity": 1},
                    ],
                    "notes": "No onions",
                },
            ).json()

            # Order 2: 6 prep units -> overflows to second slot
            o2 = student.post(
                "/api/orders",
                json={
                    "customer_name": "Second Student",
                    "items": [{"menu_item_id": "item_2", "quantity": 1}],
                },
            ).json()

            # Order 3: 2 prep units -> fits remaining capacity in first slot
            o3 = student.post(
                "/api/orders",
                json={
                    "customer_name": "Third Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            ).json()

            active_res = staff.get("/api/kitchen/orders")
            assert active_res.status_code == 200
            active_orders = active_res.json()
            assert [o["id"] for o in active_orders] == [o1["id"], o3["id"], o2["id"]]
            assert active_orders[0]["notes"] == "No onions"
            assert active_orders[0]["total_prep_units"] == 10
            assert len(active_orders[0]["items"]) == 2

            # Advance o1 to ACCEPTED, then verify ?status=ACCEPTED and ?status=PLACED filters
            accept_res = staff.patch(
                f"/api/kitchen/orders/{o1['id']}/status",
                json={"status": "ACCEPTED"},
            )
            assert accept_res.status_code == 200

            accepted_only = staff.get("/api/kitchen/orders", params={"status": "ACCEPTED"}).json()
            assert [o["id"] for o in accepted_only] == [o1["id"]]

            placed_only = staff.get("/api/kitchen/orders", params={"status": "PLACED"}).json()
            assert [o["id"] for o in placed_only] == [o3["id"], o2["id"]]

            bad_filter = staff.get("/api/kitchen/orders", params={"status": "UNKNOWN"})
            assert bad_filter.status_code == 400
            assert bad_filter.json()["error"] == "invalid_status_filter"

        get_settings.cache_clear()


def test_valid_and_invalid_kitchen_status_transitions_and_unknown_id(monkeypatch) -> None:
    """Verify PLACED -> ACCEPTED -> PREPARING -> READY -> COLLECTED and rejection of invalid transitions."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)
            student = create_student_client(app)
            created = student.post(
                "/api/orders",
                json={
                    "customer_name": "Riya",
                    "items": [{"menu_item_id": "item_1", "quantity": 1}],
                },
            ).json()
            order_id = created["id"]

            # Invalid skip: PLACED -> READY
            skip_res = staff.patch(
                f"/api/kitchen/orders/{order_id}/status",
                json={"status": "READY"},
            )
            assert skip_res.status_code == 400
            assert skip_res.json()["error"] == "invalid_status_transition"

            # Valid progression
            for next_status in ("ACCEPTED", "PREPARING", "READY", "COLLECTED"):
                res = staff.patch(
                    f"/api/kitchen/orders/{order_id}/status",
                    json={"status": next_status},
                )
                assert res.status_code == 200
                assert res.json()["status"] == next_status

                # Student tracking endpoint immediately reflects kitchen update
                tracked = student.get(f"/api/orders/{order_id}").json()
                assert tracked["status"] == next_status

            # Collected order excluded from active queue by default
            active_orders = staff.get("/api/kitchen/orders").json()
            assert active_orders == []

            # Explicit ?status=COLLECTED returns it
            collected_orders = staff.get(
                "/api/kitchen/orders", params={"status": "COLLECTED"}
            ).json()
            assert [o["id"] for o in collected_orders] == [order_id]

            # Terminal COLLECTED cannot transition further
            terminal_res = staff.patch(
                f"/api/kitchen/orders/{order_id}/status",
                json={"status": "READY"},
            )
            assert terminal_res.status_code == 400
            assert terminal_res.json()["error"] == "invalid_status_transition"

            # Unknown order ID
            missing_res = staff.patch(
                "/api/kitchen/orders/ord_missing/status",
                json={"status": "ACCEPTED"},
            )
            assert missing_res.status_code == 404
            assert missing_res.json()["error"] == "order_not_found"

        get_settings.cache_clear()


def test_kitchen_slots_workload_and_capacity_release_after_collection(monkeypatch) -> None:
    """Verify GET /api/kitchen/slots reflects real DB load and frees capacity once COLLECTED."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)
            student = create_student_client(app)
            # Fill earliest slot to 12/12 capacity (2 x Masala Dosa = 12 units)
            full_order = student.post(
                "/api/orders",
                json={
                    "customer_name": "Full Slot Student",
                    "items": [{"menu_item_id": "item_2", "quantity": 2}],
                },
            ).json()
            slot_start = full_order["pickup_slot_start"]

            # Place a second order -> overflows to next slot
            next_order = student.post(
                "/api/orders",
                json={
                    "customer_name": "Overflow Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            ).json()
            assert next_order["pickup_slot_start"] != slot_start

            slots_before = staff.get("/api/kitchen/slots").json()
            first_slot_before = next(s for s in slots_before if s["slot_start"] == slot_start)
            assert first_slot_before["used_units"] == 12
            assert first_slot_before["capacity_units"] == 12
            assert first_slot_before["remaining_units"] == 0
            assert first_slot_before["active_orders"] == 1
            assert first_slot_before["is_full"] is True

            # Move full_order through to COLLECTED
            for st in ("ACCEPTED", "PREPARING", "READY", "COLLECTED"):
                assert (
                    staff.patch(
                        f"/api/kitchen/orders/{full_order['id']}/status",
                        json={"status": st},
                    ).status_code
                    == 200
                )

            slots_after = staff.get("/api/kitchen/slots").json()
            first_slot_after = next(s for s in slots_after if s["slot_start"] == slot_start)
            assert first_slot_after["used_units"] == 0
            assert first_slot_after["remaining_units"] == 12
            assert first_slot_after["active_orders"] == 0
            assert first_slot_after["is_full"] is False

        get_settings.cache_clear()


def test_concurrent_kitchen_status_updates_are_serialized(monkeypatch) -> None:
    """Verify two parallel ACCEPTED updates on the same order result in 1 success and 1 409 conflict."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_concurrent_status.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        get_settings.cache_clear()

        init_db()
        seed_menu_items()
        settings = get_settings()
        created = create_order(
            CreateOrderRequest(
                customer_name="Concurrent Target",
                items=[OrderItemCreate(menu_item_id="item_1", quantity=1)],
            ),
            settings,
            reference_time=datetime.fromisoformat("2026-11-12T12:47:00+05:30"),
        )

        app = create_app()
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)

            def send_accept(_idx: int) -> int:
                return staff.patch(
                    f"/api/kitchen/orders/{created.id}/status",
                    json={"status": "ACCEPTED"},
                ).status_code

            with ThreadPoolExecutor(max_workers=2) as executor:
                codes = sorted(executor.map(send_accept, range(2)))

            assert codes == [200, 409]

        get_settings.cache_clear()

