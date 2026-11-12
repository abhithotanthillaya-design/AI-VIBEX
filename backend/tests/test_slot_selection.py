"""Tests for Phase 9: student slot listing, exact-slot checkout validation, and concurrency."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
import tempfile

from fastapi.testclient import TestClient

from app.allocator import align_to_slot_start
from app.config import get_settings
from app.database import init_db, write_transaction
from app.main import create_app
from app.models import create_order
from app.natural_order import parse_natural_order
from app.schemas import CreateOrderRequest, OrderItemCreate
from app.seed import seed_menu_items
from tests.auth_helpers import create_manager_client, create_staff_client, create_student_client


def _setup_test_app(monkeypatch, tmpdir: str, capacity: int = 12):
    db_file = Path(tmpdir) / "test_slots.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    monkeypatch.setenv("SLOT_CAPACITY_UNITS", str(capacity))
    monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("ENABLE_DEMO_RESET", "true")
    get_settings.cache_clear()
    return create_app()


def test_available_slots_listing_chronological_states_and_workload_feasibility(
    monkeypatch,
) -> None:
    """GET /api/slots/available returns chronological Asia/Kolkata slots with accurate states."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir, capacity=12)
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            client = create_student_client(app)

            resp = client.get("/api/slots/available?workload_units=6")
            assert resp.status_code == 200
            data = resp.json()

            assert data["slot_duration_minutes"] == 5
            assert data["slot_capacity_units"] == 12
            assert data["requested_workload_units"] == 6
            slots = data["slots"]
            assert len(slots) >= 9
            assert data["recommended_slot_start"] == slots[0]["slot_start"]

            # Strictly chronological with +05:30 Asia/Kolkata offsets
            starts = [datetime.fromisoformat(s["slot_start"]) for s in slots]
            assert starts == sorted(starts)
            for s in slots:
                assert s["slot_start"].endswith("+05:30")
                assert s["slot_end"].endswith("+05:30")
                assert s["availability_state"] == "available"
                assert s["is_feasible"] is True

            # Book 8 units into slot 0 -> remaining 4 -> limited (< 6 requested -> not feasible)
            slot0 = slots[0]["slot_start"]
            slot1 = slots[1]["slot_start"]
            order_resp = client.post(
                "/api/orders",
                json={
                    "customer_name": "Priya",
                    "items": [{"menu_item_id": "item_1", "quantity": 2}],  # 2 * 4 = 8 units
                    "requested_pickup_slot_start": slot0,
                },
            )
            assert order_resp.status_code == 201
            assert order_resp.json()["pickup_slot_start"] == slot0

            # Book 12 units into slot 1 -> full
            full_resp = client.post(
                "/api/orders",
                json={
                    "customer_name": "Rohan",
                    "items": [{"menu_item_id": "item_2", "quantity": 2}],  # 2 * 6 = 12 units
                    "requested_pickup_slot_start": slot1,
                },
            )
            assert full_resp.status_code == 201

            # Close slot 2 via manager control
            slot2 = slots[2]["slot_start"]
            close_resp = manager.patch(
                "/api/manager/slots/status",
                json={"slot_start": slot2, "is_closed": True, "reason": "Cleaning"},
            )
            assert close_resp.status_code == 200

            refreshed = client.get("/api/slots/available?workload_units=6").json()
            assert refreshed["slots"][0]["availability_state"] == "limited"
            assert refreshed["slots"][0]["remaining_units"] == 4
            assert refreshed["slots"][0]["is_feasible"] is False

            assert refreshed["slots"][1]["availability_state"] == "full"
            assert refreshed["slots"][1]["is_full"] is True
            assert refreshed["slots"][1]["is_feasible"] is False

            assert refreshed["slots"][2]["availability_state"] == "closed"
            assert refreshed["slots"][2]["is_closed"] is True
            assert refreshed["slots"][2]["close_reason"] == "Cleaning"
            assert refreshed["slots"][2]["is_feasible"] is False

            # Earliest recommended slot for 6 units jumps cleanly to slot 3
            assert refreshed["recommended_slot_start"] == refreshed["slots"][3]["slot_start"]

        get_settings.cache_clear()


def test_exact_slot_selection_and_rejections_without_silent_reassignment(
    monkeypatch,
) -> None:
    """Exact requested slots reserve atomically and invalid/full/closed requests never silently shift."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir, capacity=12)
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)
            client = create_student_client(app)

            slots = client.get("/api/slots/available").json()["slots"]
            slot0 = slots[0]["slot_start"]
            slot1 = slots[1]["slot_start"]
            slot2 = slots[2]["slot_start"]
            slot3 = slots[3]["slot_start"]

            # Automatic assignment when requested_pickup_slot_start omitted -> picks slot0
            auto_order = client.post(
                "/api/orders",
                json={
                    "customer_name": "Auto Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],  # 2 units
                },
            )
            assert auto_order.status_code == 201
            assert auto_order.json()["pickup_slot_start"] == slot0

            # Explicit future slot selection picks exact slot2 (later than earliest open slot0)
            chosen_order = client.post(
                "/api/orders",
                json={
                    "customer_name": "Explicit Student",
                    "items": [{"menu_item_id": "item_2", "quantity": 2}],  # 12 units -> fills slot2
                    "requested_pickup_slot_start": slot2,
                },
            )
            assert chosen_order.status_code == 201
            assert chosen_order.json()["pickup_slot_start"] == slot2

            # Attempting another order for already-full slot2 fails with 409 (never shifted to slot3!)
            full_attempt = client.post(
                "/api/orders",
                json={
                    "customer_name": "Late Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                    "requested_pickup_slot_start": slot2,
                },
            )
            assert full_attempt.status_code == 409
            assert full_attempt.json()["error"] == "slot_full"

            # Close slot1 -> placing order on closed slot1 fails cleanly; reopen -> succeeds
            manager.patch(
                "/api/manager/slots/status",
                json={"slot_start": slot1, "is_closed": True, "reason": "Break"},
            )
            closed_attempt = client.post(
                "/api/orders",
                json={
                    "customer_name": "Closed Slot Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                    "requested_pickup_slot_start": slot1,
                },
            )
            assert closed_attempt.status_code == 409
            assert closed_attempt.json()["error"] == "slot_closed"

            # Close slot2 too (which already has an order); kitchen must STILL see that existing order
            manager.patch(
                "/api/manager/slots/status",
                json={"slot_start": slot2, "is_closed": True, "reason": "Maintenance"},
            )
            kitchen_orders = staff.get("/api/kitchen/orders").json()
            assert any(o["id"] == chosen_order.json()["id"] for o in kitchen_orders)

            # Reopen slot1 -> available again and accepts booking
            manager.patch(
                "/api/manager/slots/status",
                json={"slot_start": slot1, "is_closed": False},
            )
            reopened_attempt = client.post(
                "/api/orders",
                json={
                    "customer_name": "Reopened Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                    "requested_pickup_slot_start": slot1,
                },
            )
            assert reopened_attempt.status_code == 201
            assert reopened_attempt.json()["pickup_slot_start"] == slot1

            # Partial remaining capacity (slot0 has 2 used -> 10 free): requesting 12 units fails
            insufficient_attempt = client.post(
                "/api/orders",
                json={
                    "customer_name": "Heavy Order",
                    "items": [{"menu_item_id": "item_2", "quantity": 2}],  # 12 units
                    "requested_pickup_slot_start": slot0,
                },
            )
            assert insufficient_attempt.status_code == 409
            assert insufficient_attempt.json()["error"] == "slot_insufficient_capacity"

            # Past slot rejected with 400 slot_in_past
            past_dt = datetime.fromisoformat(slot0) - timedelta(minutes=15)
            past_attempt = client.post(
                "/api/orders",
                json={
                    "customer_name": "Past Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                    "requested_pickup_slot_start": past_dt.isoformat(timespec="seconds"),
                },
            )
            assert past_attempt.status_code == 400
            assert past_attempt.json()["error"] == "slot_in_past"

            # UTC timestamp equivalent to Asia/Kolkata slot3 is converted and matches slot3!
            utc_slot3 = datetime.fromisoformat(slot3).astimezone(
                datetime.fromisoformat("2026-01-01T00:00:00+00:00").tzinfo
            )
            utc_order = client.post(
                "/api/orders",
                json={
                    "customer_name": "UTC Input Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                    "requested_pickup_slot_start": utc_slot3.isoformat(timespec="seconds"),
                },
            )
            assert utc_order.status_code == 201
            assert utc_order.json()["pickup_slot_start"] == slot3

        get_settings.cache_clear()


def test_manager_capacity_change_collection_and_cancellation_release_capacity(
    monkeypatch,
) -> None:
    """Capacity updates preserve old orders, and COLLECTED/CANCELLED free student-visible capacity."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir, capacity=12)
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)
            client = create_student_client(app)

            slots = client.get("/api/slots/available").json()["slots"]
            slot0 = slots[0]["slot_start"]

            # Fill slot0 with 12 units (2x Masala Dosa)
            created = client.post(
                "/api/orders",
                json={
                    "customer_name": "Ananya",
                    "items": [{"menu_item_id": "item_2", "quantity": 2}],
                    "requested_pickup_slot_start": slot0,
                },
            ).json()

            # Manager reduces default capacity from 12 to 6 -> existing order stays on slot0
            cap_res = manager.patch(
                "/api/manager/settings/capacity",
                json={"slot_capacity_units": 6},
            )
            assert cap_res.status_code == 200
            refreshed = client.get("/api/slots/available?workload_units=6").json()
            assert refreshed["slot_capacity_units"] == 6
            assert refreshed["slots"][0]["used_units"] == 12
            assert refreshed["slots"][0]["remaining_units"] == 0
            assert refreshed["slots"][0]["is_full"] is True

            # Verify existing order was NOT moved
            tracked = client.get(f"/api/orders/{created['id']}").json()
            assert tracked["pickup_slot_start"] == slot0

            # Advance through QR collection -> releases all 12 units cleanly
            for st in ("ACCEPTED", "PREPARING", "READY"):
                staff.patch(
                    f"/api/kitchen/orders/{created['id']}/status",
                    json={"status": st},
                )
            verify_res = staff.post(
                "/api/kitchen/verify-pickup",
                json={"token": created["pickup_token"]},
            )
            assert verify_res.status_code == 200

            after_collect = client.get("/api/slots/available?workload_units=6").json()
            assert after_collect["slots"][0]["used_units"] == 0
            assert after_collect["slots"][0]["remaining_units"] == 6
            assert after_collect["slots"][0]["is_feasible"] is True

            # Book 6 units again, then mark CANCELLED directly in DB and verify capacity releases
            second = client.post(
                "/api/orders",
                json={
                    "customer_name": "Kabir",
                    "items": [{"menu_item_id": "item_2", "quantity": 1}],
                    "requested_pickup_slot_start": slot0,
                },
            ).json()
            assert client.get("/api/slots/available").json()["slots"][0]["is_full"] is True

            with write_transaction() as conn:
                conn.execute(
                    "UPDATE orders SET status = 'CANCELLED' WHERE id = ?",
                    (second["id"],),
                )

            after_cancel = client.get("/api/slots/available?workload_units=6").json()
            assert after_cancel["slots"][0]["used_units"] == 0
            assert after_cancel["slots"][0]["is_feasible"] is True

        get_settings.cache_clear()


def test_concurrent_exact_slot_checkouts_never_overbook(monkeypatch) -> None:
    """Simultaneous requests targeting the same open slot respect capacity via write lock."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_concurrent_slot.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        monkeypatch.setenv("SLOT_CAPACITY_UNITS", "12")
        monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
        get_settings.cache_clear()

        init_db()
        seed_menu_items()
        settings = get_settings()
        ref_now = datetime.fromisoformat("2026-11-12T12:15:00+05:30")
        target_slot = align_to_slot_start(ref_now, 5).isoformat(timespec="seconds")

        # Each order is 6 units (1x Masala Dosa); max 2 orders can fit in 12-unit slot
        def attempt(index: int) -> str:
            try:
                res = create_order(
                    CreateOrderRequest(
                        customer_name=f"Concurrent {index}",
                        items=[OrderItemCreate(menu_item_id="item_2", quantity=1)],
                        requested_pickup_slot_start=target_slot,
                    ),
                    settings,
                    reference_time=ref_now,
                )
                return f"ok:{res.pickup_slot_start}"
            except Exception as exc:
                return f"err:{getattr(exc, 'code', 'unknown')}"

        with ThreadPoolExecutor(max_workers=6) as pool:
            outcomes = list(pool.map(attempt, range(6)))

        successes = [o for o in outcomes if o.startswith("ok:")]
        failures = [o for o in outcomes if o.startswith("err:")]
        assert len(successes) == 2
        assert all(s == f"ok:{target_slot}" for s in successes)
        assert len(failures) == 4
        assert all(f == "err:slot_full" for f in failures)

        get_settings.cache_clear()


def test_natural_order_matched_slot_respects_workload_and_closure(monkeypatch) -> None:
    """Natural-language parser returns matched_slot_start only when slot fits workload and is open."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_nl_slots.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        monkeypatch.setenv("SLOT_CAPACITY_UNITS", "12")
        monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
        get_settings.cache_clear()

        init_db()
        seed_menu_items()
        settings = get_settings()
        ref_now = datetime.fromisoformat("2026-11-12T12:30:00+05:30")
        target_slot = "2026-11-12T13:30:00+05:30"

        # 1. Valid future request within 2-hour horizon sets matched_slot_start
        res_ok = parse_natural_order(
            "One masala dosa around 1:30 PM",
            settings,
            reference_time=ref_now,
        )
        assert res_ok.requested_pickup_time is not None
        assert res_ok.requested_pickup_time.status == "valid_note"
        assert res_ok.requested_pickup_time.matched_slot_start == target_slot

        # 2. Occupy 8 units at 1:30 PM -> asking for 1x Masala Dosa (6 units) doesn't fit (4 remaining)
        create_order(
            CreateOrderRequest(
                customer_name="Prebooker",
                items=[OrderItemCreate(menu_item_id="item_1", quantity=2)],  # 8 units
                requested_pickup_slot_start=target_slot,
            ),
            settings,
            reference_time=ref_now,
        )
        res_tight = parse_natural_order(
            "One masala dosa around 1:30 PM",
            settings,
            reference_time=ref_now,
        )
        assert res_tight.requested_pickup_time is not None
        assert res_tight.requested_pickup_time.status == "unavailable"
        assert res_tight.requested_pickup_time.matched_slot_start is None
        assert "4" in res_tight.requested_pickup_time.message

        get_settings.cache_clear()

