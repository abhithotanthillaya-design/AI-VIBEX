"""Tests for Phase 6 Manager Dashboard, Menu CRUD, Sales, Order Oversight, and Slot Settings."""

from datetime import datetime
from pathlib import Path
import sqlite3
import tempfile

from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import init_db, write_transaction
from app.main import create_app
from app.manager_service import get_manager_dashboard, get_manager_sales_summary
from app.models import create_order
from app.schemas import CreateOrderRequest, OrderItemCreate
from app.seed import seed_menu_items


def _setup_test_app(monkeypatch, tmpdir: str):
    db_file = Path(tmpdir) / "test_manager.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    monkeypatch.setenv("SLOT_CAPACITY_UNITS", "12")
    monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
    get_settings.cache_clear()
    return create_app()


def test_manager_menu_crud_availability_and_historical_order_snapshots(
    monkeypatch,
) -> None:
    """Verify manager CRUD, student availability sync, and historical order snapshot preservation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as client:
            # 1. Manager sees all 12 non-deleted items (11 available + 1 unavailable)
            mgr_menu = client.get("/api/manager/menu").json()
            assert len(mgr_menu) == 12
            student_menu = client.get("/api/menu").json()
            assert len(student_menu) == 11

            # 2. Add a new Non-Veg item
            create_res = client.post(
                "/api/manager/menu",
                json={
                    "name": "Chicken Tikka Roll",
                    "description": "Smoky char-grilled chicken tikka wrapped in crisp flaky paratha.",
                    "category": "Fast Food",
                    "price": 11000,
                    "prep_minutes": 6,
                    "image_url": "/images/menu/paneer-kathi-roll.jpg",
                    "is_veg": False,
                    "available": True,
                },
            )
            assert create_res.status_code == 201
            created_item = create_res.json()
            assert created_item["is_veg"] is False
            assert created_item["price"] == 11000
            item_id = created_item["id"]

            assert len(client.get("/api/menu").json()) == 12

            # 3. Student places an order containing the new item
            order_res = client.post(
                "/api/orders",
                json={
                    "customer_name": "Snapshot Student",
                    "items": [{"menu_item_id": item_id, "quantity": 2}],
                },
            )
            assert order_res.status_code == 201
            order_id = order_res.json()["id"]
            assert order_res.json()["total_amount"] == 22000

            # 4. Manager edits name, price, classification, and prep time
            update_res = client.put(
                f"/api/manager/menu/{item_id}",
                json={
                    "name": "Classic Egg Roll",
                    "description": "Updated spiced egg roll wrapped in warm paratha.",
                    "category": "Snacks",
                    "price": 7500,
                    "prep_minutes": 4,
                    "image_url": "/images/menu/paneer-kathi-roll.jpg",
                    "is_veg": False,
                    "available": True,
                },
            )
            assert update_res.status_code == 200
            assert update_res.json()["name"] == "Classic Egg Roll"
            assert update_res.json()["price"] == 7500

            # Historical order retains original snapshot (Chicken Tikka Roll @ 11000 paise)
            historical_order = client.get(f"/api/orders/{order_id}").json()
            assert historical_order["total_amount"] == 22000
            assert historical_order["items"][0]["item_name"] == "Chicken Tikka Roll"
            assert historical_order["items"][0]["unit_price"] == 11000

            # 5. Toggle availability to False -> immediately disappears from student menu and cannot be ordered
            avail_res = client.patch(
                f"/api/manager/menu/{item_id}/availability",
                json={"available": False},
            )
            assert avail_res.status_code == 200
            assert avail_res.json()["available"] is False
            student_ids = {item["id"] for item in client.get("/api/menu").json()}
            assert item_id not in student_ids

            blocked_order = client.post(
                "/api/orders",
                json={
                    "customer_name": "Late Student",
                    "items": [{"menu_item_id": item_id, "quantity": 1}],
                },
            )
            assert blocked_order.status_code == 400
            assert blocked_order.json()["error"] == "unavailable_menu_item"

            # 6. Soft-delete item -> removed from manager & student menus, order snapshot still intact
            del_res = client.delete(f"/api/manager/menu/{item_id}")
            assert del_res.status_code == 200
            assert del_res.json()["archived"] is True
            assert all(i["id"] != item_id for i in client.get("/api/manager/menu").json())
            assert all(i["id"] != item_id for i in client.get("/api/menu").json())

            historical_after_delete = client.get(f"/api/orders/{order_id}").json()
            assert historical_after_delete["items"][0]["item_name"] == "Chicken Tikka Roll"
            assert historical_after_delete["total_amount"] == 22000

        get_settings.cache_clear()


def test_manager_menu_validation_rejects_invalid_price_category_and_inputs(
    monkeypatch,
) -> None:
    """Verify Pydantic validation rejects zero/negative price, bad category, and unsafe URLs."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as client:
            bad_price = client.post(
                "/api/manager/menu",
                json={
                    "name": "Free Meal",
                    "description": "Invalid zero price test item.",
                    "category": "Meals",
                    "price": 0,
                    "prep_minutes": 4,
                    "is_veg": True,
                    "available": True,
                },
            )
            assert bad_price.status_code == 422

            bad_category = client.post(
                "/api/manager/menu",
                json={
                    "name": "Mystery Dish",
                    "description": "Invalid category test item.",
                    "category": "Desserts",
                    "price": 5000,
                    "prep_minutes": 4,
                },
            )
            assert bad_category.status_code == 422

            bad_url = client.post(
                "/api/manager/menu",
                json={
                    "name": "XSS Dish",
                    "description": "Invalid scheme URL test.",
                    "category": "Snacks",
                    "price": 4000,
                    "prep_minutes": 2,
                    "image_url": "javascript:alert(1)",
                },
            )
            assert bad_url.status_code == 422

            missing_update = client.put(
                "/api/manager/menu/item_missing",
                json={
                    "name": "Valid Name",
                    "description": "Valid description text.",
                    "category": "Snacks",
                    "price": 4000,
                    "prep_minutes": 3,
                },
            )
            assert missing_update.status_code == 404

        get_settings.cache_clear()


def test_manager_dashboard_sales_summary_and_order_filters(monkeypatch) -> None:
    """Verify dashboard stats, 7-day sales excluding cancelled/active, popular items, and order filters."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_dashboard_sales.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        get_settings.cache_clear()

        init_db()
        seed_menu_items()
        settings = get_settings()

        # Empty DB baseline
        empty_dash = get_manager_dashboard(settings)
        assert empty_dash.today_sales_paise == 0
        assert empty_dash.today_orders == 0
        assert empty_dash.busiest_slot is None
        empty_sales = get_manager_sales_summary(settings)
        assert empty_sales.total_collected_orders == 0
        assert empty_sales.average_order_value_paise == 0
        assert len(empty_sales.daily_sales) == 7
        assert empty_sales.top_items == []

        ref_today = datetime.fromisoformat("2026-11-12T12:30:00+05:30")
        ref_yesterday = datetime.fromisoformat("2026-11-11T12:30:00+05:30")

        # 1. Collected order today: 2 x Veg Sandwich (5000*2=10000) + 1 x Chai (2000) = 12000
        o_today = create_order(
            CreateOrderRequest(
                customer_name="Meera",
                items=[
                    OrderItemCreate(menu_item_id="item_1", quantity=2),
                    OrderItemCreate(menu_item_id="item_9", quantity=1),
                ],
            ),
            settings,
            reference_time=ref_today,
        )
        # 2. Active order today (should NOT count in finalized sales)
        o_active = create_order(
            CreateOrderRequest(
                customer_name="Kabir",
                items=[OrderItemCreate(menu_item_id="item_2", quantity=1)],
            ),
            settings,
            reference_time=ref_today,
        )
        # 3. Cancelled order today (must NOT count in sales or today's active orders)
        o_cancelled = create_order(
            CreateOrderRequest(
                customer_name="Cancelled User",
                items=[OrderItemCreate(menu_item_id="item_2", quantity=2)],
            ),
            settings,
            reference_time=ref_today,
        )
        # 4. Collected order yesterday: 1 x Masala Dosa (6500)
        o_yesterday = create_order(
            CreateOrderRequest(
                customer_name="Yesterday User",
                items=[OrderItemCreate(menu_item_id="item_2", quantity=1)],
            ),
            settings,
            reference_time=ref_yesterday,
        )

        with write_transaction() as conn:
            conn.execute(
                "UPDATE orders SET status = 'COLLECTED' WHERE id IN (?, ?)",
                (o_today.id, o_yesterday.id),
            )
            conn.execute(
                "UPDATE orders SET status = 'CANCELLED' WHERE id = ?",
                (o_cancelled.id,),
            )

        dash = get_manager_dashboard(settings, reference_time=ref_today)
        assert dash.today_sales_paise == 12000
        assert dash.today_orders == 2  # o_today + o_active (excludes cancelled)
        assert dash.active_orders == 1
        assert dash.completed_orders == 2
        assert dash.cancelled_orders == 1
        assert dash.total_menu_items == 12
        assert dash.available_menu_items == 11
        assert dash.unavailable_menu_items == 1
        assert dash.busiest_slot is not None
        assert dash.busiest_slot.used_units == 6

        sales = get_manager_sales_summary(settings, reference_time=ref_today)
        assert sales.today_sales_paise == 12000
        assert sales.total_collected_orders == 2
        assert sales.total_collected_revenue_paise == 18500
        assert sales.average_order_value_paise == 9250
        assert len(sales.daily_sales) == 7
        assert sales.daily_sales[-1].revenue_paise == 12000
        assert sales.daily_sales[-2].revenue_paise == 6500
        assert sales.top_items[0].menu_item_id == "item_1"
        assert sales.top_items[0].quantity_sold == 2

        # Verify /api/manager/orders filtering and search
        app = create_app()
        with TestClient(app) as client:
            assert len(client.get("/api/manager/orders").json()) == 4
            assert len(client.get("/api/manager/orders", params={"status": "active"}).json()) == 1
            assert len(client.get("/api/manager/orders", params={"status": "completed"}).json()) == 2
            assert len(client.get("/api/manager/orders", params={"status": "cancelled"}).json()) == 1
            assert len(
                client.get("/api/manager/orders", params={"date": "2026-11-11"}).json()
            ) == 1
            search_res = client.get(
                "/api/manager/orders", params={"search": o_active.pickup_code}
            ).json()
            assert len(search_res) == 1
            assert search_res[0]["id"] == o_active.id

        get_settings.cache_clear()


def test_manager_slot_closure_reopening_and_capacity_updates(monkeypatch) -> None:
    """Verify closing slots skips them for new orders while preserving existing orders & capacities."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as client:
            slot_cfg = client.get("/api/manager/slots").json()
            assert slot_cfg["slot_capacity_units"] == 12
            assert slot_cfg["slot_duration_minutes"] == 5
            first_slot = slot_cfg["slots"][0]["slot_start"]
            second_slot = slot_cfg["slots"][1]["slot_start"]

            # Place order 1 -> takes first_slot
            o1 = client.post(
                "/api/orders",
                json={
                    "customer_name": "Before Close",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            ).json()
            assert o1["pickup_slot_start"] == first_slot

            # Close first_slot
            close_res = client.patch(
                "/api/manager/slots/status",
                json={
                    "slot_start": first_slot,
                    "is_closed": True,
                    "reason": "Equipment cleaning",
                },
            )
            assert close_res.status_code == 200
            assert close_res.json()["is_closed"] is True
            assert close_res.json()["close_reason"] == "Equipment cleaning"

            # Existing order retains its slot!
            assert client.get(f"/api/orders/{o1['id']}").json()["pickup_slot_start"] == first_slot

            # New order MUST skip closed first_slot and receive second_slot
            o2 = client.post(
                "/api/orders",
                json={
                    "customer_name": "During Close",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            ).json()
            assert o2["pickup_slot_start"] == second_slot

            # Reopen first_slot -> next order can use first_slot again
            reopen_res = client.patch(
                "/api/manager/slots/status",
                json={"slot_start": first_slot, "is_closed": False},
            )
            assert reopen_res.status_code == 200
            assert reopen_res.json()["is_closed"] is False

            o3 = client.post(
                "/api/orders",
                json={
                    "customer_name": "After Reopen",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            ).json()
            assert o3["pickup_slot_start"] == first_slot

            # Update slot capacity in DB to 8 -> existing orders keep slots & new capacity persists
            cap_res = client.patch(
                "/api/manager/settings/capacity",
                json={"slot_capacity_units": 8},
            )
            assert cap_res.status_code == 200
            assert cap_res.json()["slot_capacity_units"] == 8
            assert client.get("/api/kitchen/slots").json()[0]["capacity_units"] == 8
            assert client.get(f"/api/orders/{o1['id']}").json()["pickup_slot_start"] == first_slot

        get_settings.cache_clear()


def test_safe_migration_upgrades_legacy_menu_items_table(monkeypatch) -> None:
    """Verify init_db safely adds is_veg and is_deleted to pre-Phase 6 databases without data loss."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "legacy.db"
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
            INSERT INTO menu_items VALUES (
                'item_legacy', 'Legacy Samosa', 'Crispy samosa', 'Snacks', 2500, 2, 1, NULL
            );
            """
        )
        conn.commit()
        conn.close()

        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        get_settings.cache_clear()
        init_db()

        migrated = sqlite3.connect(str(db_file))
        cols = {row[1] for row in migrated.execute("PRAGMA table_info(menu_items)").fetchall()}
        assert "is_veg" in cols
        assert "is_deleted" in cols
        row = migrated.execute(
            "SELECT name, is_veg, is_deleted FROM menu_items WHERE id = 'item_legacy'"
        ).fetchone()
        assert row == ("Legacy Samosa", 1, 0)
        migrated.close()
        get_settings.cache_clear()

