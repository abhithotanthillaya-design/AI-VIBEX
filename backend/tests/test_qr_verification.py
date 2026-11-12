"""Tests for Phase 7 QR token security, hash storage, verification API, and concurrency."""

from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import sqlite3
import tempfile

from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import db_session, init_db, write_transaction
from app.main import create_app
from app.models import hash_pickup_token
from tests.auth_helpers import create_manager_client, create_staff_client, create_student_client


def _setup_test_app(monkeypatch, tmpdir: str):
    db_file = Path(tmpdir) / "test_qr.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    monkeypatch.setenv("SLOT_CAPACITY_UNITS", "12")
    monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
    get_settings.cache_clear()
    return create_app()


def test_qr_token_hash_storage_uniqueness_and_non_exposure(monkeypatch) -> None:
    """Verify high-entropy unique tokens are stored only as SHA-256 hashes and hidden from queue/list APIs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)
            student = create_student_client(app)

            o1 = student.post(
                "/api/orders",
                json={
                    "customer_name": "Student One",
                    "items": [{"menu_item_id": "item_1", "quantity": 1}],
                },
            ).json()
            o2 = student.post(
                "/api/orders",
                json={
                    "customer_name": "Student Two",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            ).json()

            t1 = o1["pickup_token"]
            t2 = o2["pickup_token"]
            assert t1.startswith("qlp_")
            assert len(t1) >= 24
            assert t1 != t2
            assert t1 != o1["id"]
            assert t1 != o1["pickup_code"]

            # Database must store hash only, never raw token
            with db_session() as conn:
                row = conn.execute(
                    "SELECT pickup_token_hash, pickup_token_used_at FROM orders WHERE id = ?",
                    (o1["id"],),
                ).fetchone()
                assert row["pickup_token_hash"] == hash_pickup_token(t1)
                assert row["pickup_token_hash"] != t1
                assert row["pickup_token_used_at"] is None

            # Kitchen queue, manager list, and GET order tracking must never expose raw or hashed token
            for endpoint_payload in (
                staff.get("/api/kitchen/orders").json()[0],
                manager.get("/api/manager/orders").json()[0],
                student.get(f"/api/orders/{o1['id']}").json(),
            ):
                assert "pickup_token" not in endpoint_payload
                assert "pickup_token_hash" not in endpoint_payload

        get_settings.cache_clear()


def test_qr_verification_lifecycle_errors_and_capacity_release(monkeypatch) -> None:
    """Verify READY order QR collection, non-READY rejection, invalid/unknown/reused/cancelled tokens, and slot release."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)
            student = create_student_client(app)

            # Create order with 2 x Masala Dosa = 12 units (fills earliest slot)
            created = student.post(
                "/api/orders",
                json={
                    "customer_name": "QR Student",
                    "items": [{"menu_item_id": "item_2", "quantity": 2}],
                },
            ).json()
            order_id = created["id"]
            token = created["pickup_token"]
            slot_start = created["pickup_slot_start"]

            # Malformed / short token rejected (422)
            assert (
                staff.post("/api/kitchen/verify-pickup", json={"token": "bad"}).status_code
                == 422
            )

            # Unknown valid-length token rejected (404)
            unknown_res = staff.post(
                "/api/kitchen/verify-pickup",
                json={"token": "qlp_unknown_token_12345678"},
            )
            assert unknown_res.status_code == 404
            assert unknown_res.json()["error"] == "invalid_pickup_token"

            # Reject pickup codes used as substitute token (422 short / 404 unknown)
            assert (
                staff.post(
                    "/api/kitchen/verify-pickup",
                    json={"token": created["pickup_code"]},
                ).status_code
                == 422
            )

            # Reject when PLACED, ACCEPTED, or PREPARING
            for status_step in ("PLACED", "ACCEPTED", "PREPARING"):
                if status_step != "PLACED":
                    assert (
                        staff.patch(
                            f"/api/kitchen/orders/{order_id}/status",
                            json={"status": status_step},
                        ).status_code
                        == 200
                    )
                not_ready = staff.post(
                    "/api/kitchen/verify-pickup", json={"token": token}
                )
                assert not_ready.status_code == 409
                assert not_ready.json()["error"] == "order_not_ready"

            # Advance to READY -> slot still occupied 12/12
            assert (
                staff.patch(
                    f"/api/kitchen/orders/{order_id}/status",
                    json={"status": "READY"},
                ).status_code
                == 200
            )
            slots_before = staff.get("/api/kitchen/slots").json()
            target_before = next(s for s in slots_before if s["slot_start"] == slot_start)
            assert target_before["used_units"] == 12
            assert target_before["is_full"] is True

            # Valid QR verification collects READY order and releases slot capacity
            verify_res = staff.post(
                "/api/kitchen/verify-pickup", json={"token": token}
            )
            assert verify_res.status_code == 200
            verify_body = verify_res.json()
            assert verify_body["verified"] is True
            assert verify_body["order"]["id"] == order_id
            assert verify_body["order"]["status"] == "COLLECTED"
            assert verify_body["order"]["customer_name"] == "QR Student"
            assert len(verify_body["order"]["items"]) == 1

            # Student tracking reflects COLLECTED
            assert student.get(f"/api/orders/{order_id}").json()["status"] == "COLLECTED"

            # Slot capacity released once
            slots_after = staff.get("/api/kitchen/slots").json()
            target_after = next(s for s in slots_after if s["slot_start"] == slot_start)
            assert target_after["used_units"] == 0
            assert target_after["is_full"] is False

            # Reusing same token fails with 409 order_already_collected
            reuse_res = staff.post(
                "/api/kitchen/verify-pickup", json={"token": token}
            )
            assert reuse_res.status_code == 409
            assert reuse_res.json()["error"] == "order_already_collected"

            # Cancelled order cannot be collected via QR
            cancelled = student.post(
                "/api/orders",
                json={
                    "customer_name": "Cancel Target",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            ).json()
            with write_transaction() as conn:
                conn.execute(
                    "UPDATE orders SET status = 'CANCELLED' WHERE id = ?",
                    (cancelled["id"],),
                )
            cancel_res = staff.post(
                "/api/kitchen/verify-pickup",
                json={"token": cancelled["pickup_token"]},
            )
            assert cancel_res.status_code == 400
            assert cancel_res.json()["error"] == "order_cancelled"

            # Demo reset remains compatible and clears orders + tokens cleanly
            reset_res = manager.post("/api/demo/reset")
            assert reset_res.status_code == 200
            assert reset_res.json()["deleted_orders"] == 2

        get_settings.cache_clear()


def test_concurrent_qr_verification_prevents_double_collection(monkeypatch) -> None:
    """Verify simultaneous duplicate QR scans allow exactly one 200 collection and reject others with 409."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)
            student = create_student_client(app)

            created = student.post(
                "/api/orders",
                json={
                    "customer_name": "Concurrency Student",
                    "items": [{"menu_item_id": "item_2", "quantity": 1}],
                },
            ).json()
            order_id = created["id"]
            token = created["pickup_token"]

            for next_status in ("ACCEPTED", "PREPARING", "READY"):
                staff.patch(
                    f"/api/kitchen/orders/{order_id}/status",
                    json={"status": next_status},
                )

            def verify_attempt(_idx: int) -> int:
                return staff.post(
                    "/api/kitchen/verify-pickup",
                    json={"token": token},
                ).status_code

            with ThreadPoolExecutor(max_workers=5) as executor:
                statuses = sorted(executor.map(verify_attempt, range(5)))

            assert statuses == [200, 409, 409, 409, 409]

            # Capacity released cleanly (0 active units)
            slots = staff.get("/api/kitchen/slots").json()
            assert all(s["used_units"] == 0 for s in slots)

        get_settings.cache_clear()


def test_manual_collection_invalidates_qr_and_legacy_orders_migrate_safely(
    monkeypatch,
) -> None:
    """Verify manual collection marks token used and legacy pre-Phase 7 orders migrate cleanly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "legacy_orders.db"
        conn = sqlite3.connect(str(db_file))
        conn.executescript(
            """
            CREATE TABLE menu_items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Snacks',
                price INTEGER NOT NULL,
                prep_minutes INTEGER NOT NULL,
                available INTEGER NOT NULL DEFAULT 1,
                image_url TEXT
            );
            CREATE TABLE orders (
                id TEXT PRIMARY KEY,
                pickup_code TEXT NOT NULL UNIQUE,
                customer_name TEXT NOT NULL,
                status TEXT NOT NULL,
                pickup_slot_start TEXT NOT NULL,
                pickup_slot_end TEXT NOT NULL,
                total_amount INTEGER NOT NULL,
                total_prep_units INTEGER NOT NULL,
                notes TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            INSERT INTO orders VALUES (
                'ord_legacy1', 'LG77', 'Legacy User', 'READY',
                '2026-11-12T12:50:00+05:30', '2026-11-12T12:55:00+05:30',
                5000, 4, NULL, '2026-11-12T12:40:00+05:30', '2026-11-12T12:45:00+05:30'
            );
            """
        )
        conn.commit()
        conn.close()

        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        get_settings.cache_clear()
        init_db()

        app = create_app()
        with TestClient(app) as _lifespan:
            manager = create_manager_client(app)
            staff = create_staff_client(app, manager)
            student = create_student_client(app)

            # Legacy READY order can still be collected manually by authorized staff
            legacy_collect = staff.patch(
                "/api/kitchen/orders/ord_legacy1/status",
                json={"status": "COLLECTED"},
            )
            assert legacy_collect.status_code == 200
            assert legacy_collect.json()["status"] == "COLLECTED"

            # New QR order collected manually must invalidate its QR token
            created = student.post(
                "/api/orders",
                json={
                    "customer_name": "Manual Collect",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            ).json()
            for st in ("ACCEPTED", "PREPARING", "READY", "COLLECTED"):
                assert (
                    staff.patch(
                        f"/api/kitchen/orders/{created['id']}/status",
                        json={"status": st},
                    ).status_code
                    == 200
                )

            qr_after_manual = staff.post(
                "/api/kitchen/verify-pickup",
                json={"token": created["pickup_token"]},
            )
            assert qr_after_manual.status_code == 409
            assert qr_after_manual.json()["error"] == "order_already_collected"

        get_settings.cache_clear()

