"""Tests for demo reset safety, rollback protection, and full 14-step integration flow."""

from pathlib import Path
import sqlite3
import tempfile

from fastapi.testclient import TestClient
import pytest

from app.config import get_settings
from app.database import db_session, init_db
from app.main import create_app
from app.models import create_order, reset_demo_data
from app.schemas import CreateOrderRequest, OrderItemCreate
from app.seed import SEED_MENU_ITEMS, seed_menu_items


def _setup_test_app(monkeypatch, tmpdir: str, **env_overrides: str):
    db_file = Path(tmpdir) / "test_demo_reset.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    for key, value in env_overrides.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()
    return create_app()


def test_demo_reset_clears_orders_and_preserves_menu(monkeypatch) -> None:
    """Verify POST /api/demo/reset deletes orders/items while keeping seeded menu intact."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir, ENABLE_DEMO_RESET="true")
        with TestClient(app) as client:
            created = client.post(
                "/api/orders",
                json={
                    "customer_name": "Demo User",
                    "items": [
                        {"menu_item_id": "item_1", "quantity": 2},
                        {"menu_item_id": "item_9", "quantity": 1},
                    ],
                },
            )
            assert created.status_code == 201

            reset_res = client.post("/api/demo/reset")
            assert reset_res.status_code == 200
            payload = reset_res.json()
            assert payload["status"] == "ok"
            assert payload["deleted_orders"] == 1
            assert payload["deleted_order_items"] == 2
            assert payload["available_menu_items"] == len(
                [item for item in SEED_MENU_ITEMS if item.available]
            )

            assert client.get("/api/kitchen/orders").json() == []
            menu_items = client.get("/api/menu").json()
            assert len(menu_items) == payload["available_menu_items"]

            with db_session() as conn:
                assert conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 0
                assert conn.execute("SELECT COUNT(*) FROM order_items").fetchone()[0] == 0

        get_settings.cache_clear()


def test_demo_reset_blocked_when_disabled_or_in_production(monkeypatch) -> None:
    """Verify demo reset cannot run in production or when ENABLE_DEMO_RESET is false."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(
            monkeypatch, tmpdir, ENABLE_DEMO_RESET="false", ENVIRONMENT="development"
        )
        with TestClient(app) as client:
            client.post(
                "/api/orders",
                json={
                    "customer_name": "Protected Order",
                    "items": [{"menu_item_id": "item_1", "quantity": 1}],
                },
            )
            res = client.post("/api/demo/reset")
            assert res.status_code == 403
            assert res.json()["error"] == "demo_reset_disabled"
            assert len(client.get("/api/kitchen/orders").json()) == 1

        get_settings.cache_clear()

    with tempfile.TemporaryDirectory() as tmpdir:
        app_prod = _setup_test_app(
            monkeypatch, tmpdir, ENABLE_DEMO_RESET="true", ENVIRONMENT="production"
        )
        with TestClient(app_prod) as client_prod:
            res_prod = client_prod.post("/api/demo/reset")
            assert res_prod.status_code == 403
            assert res_prod.json()["error"] == "demo_reset_disabled"

        get_settings.cache_clear()


def test_demo_reset_rolls_back_atomically_on_failure(monkeypatch) -> None:
    """Verify mid-transaction failure during reset leaves orders and order_items untouched."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_rollback.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        monkeypatch.setenv("ENABLE_DEMO_RESET", "true")
        get_settings.cache_clear()

        init_db()
        seed_menu_items()
        settings = get_settings()

        create_order(
            CreateOrderRequest(
                customer_name="Rollback Check",
                items=[OrderItemCreate(menu_item_id="item_1", quantity=1)],
            ),
            settings,
        )

        # Force seed_menu_items inside reset_demo_data to fail after DELETE statements.
        def fail_mid_transaction(_conn: sqlite3.Connection) -> int:
            raise sqlite3.OperationalError("Simulated database failure during reset")

        monkeypatch.setattr("app.models.seed_menu_items", fail_mid_transaction)

        with pytest.raises(sqlite3.OperationalError):
            reset_demo_data(settings)

        # Transaction rollback must preserve both orders and order_items.
        with db_session() as conn:
            assert conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0] == 1
            assert conn.execute("SELECT COUNT(*) FROM order_items").fetchone()[0] == 1

        get_settings.cache_clear()


def test_complete_end_to_end_hackathon_flow(monkeypatch) -> None:
    """Exercise the complete 14-step student -> kitchen -> tracking -> reset lifecycle."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(
            monkeypatch,
            tmpdir,
            ENABLE_DEMO_RESET="true",
            SLOT_CAPACITY_UNITS="12",
            SLOT_DURATION_MINUTES="5",
        )
        with TestClient(app) as client:
            # 1-2. Clean demo & browse menu
            assert client.get("/api/kitchen/orders").json() == []
            menu = client.get("/api/menu").json()
            assert len(menu) == 11

            # 3-5. Place order & verify slot allocation
            order_res = client.post(
                "/api/orders",
                json={
                    "customer_name": "Integration Student",
                    "items": [{"menu_item_id": "item_2", "quantity": 2}],
                    "notes": "Extra coconut chutney",
                },
            )
            assert order_res.status_code == 201
            order = order_res.json()
            slot_start = order["pickup_slot_start"]

            # 6. Kitchen sees order & full slot
            kitchen_orders = client.get("/api/kitchen/orders").json()
            assert len(kitchen_orders) == 1
            assert kitchen_orders[0]["id"] == order["id"]
            slots_before = client.get("/api/kitchen/slots").json()
            assigned_slot = next(s for s in slots_before if s["slot_start"] == slot_start)
            assert assigned_slot["used_units"] == 12
            assert assigned_slot["is_full"] is True

            # 7-11. Kitchen transitions & student tracking reflects every update
            for next_status in ("ACCEPTED", "PREPARING", "READY", "COLLECTED"):
                patch_res = client.patch(
                    f"/api/kitchen/orders/{order['id']}/status",
                    json={"status": next_status},
                )
                assert patch_res.status_code == 200
                tracked = client.get(f"/api/orders/{order['id']}").json()
                assert tracked["status"] == next_status

            # 12. Slot capacity released after collection
            slots_after = client.get("/api/kitchen/slots").json()
            released_slot = next(s for s in slots_after if s["slot_start"] == slot_start)
            assert released_slot["used_units"] == 0
            assert released_slot["is_full"] is False

            # 13-14. Reset demo & verify orders removed while menu remains available
            reset_res = client.post("/api/demo/reset")
            assert reset_res.status_code == 200
            assert reset_res.json()["deleted_orders"] == 1
            assert client.get("/api/kitchen/orders").json() == []
            assert client.get("/api/kitchen/orders", params={"status": "COLLECTED"}).json() == []
            assert client.get(f"/api/orders/{order['id']}").status_code == 404
            assert len(client.get("/api/menu").json()) == 11

        get_settings.cache_clear()

