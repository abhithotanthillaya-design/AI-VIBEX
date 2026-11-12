"""Tests for Phase 10: dietary labels/allergens, instruction sanitization, demo payment, and migrations."""

from pathlib import Path
import sqlite3
import tempfile

from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import get_connection, init_db
from app.main import create_app
from app.seed import seed_menu_items


def _setup_app(monkeypatch, tmpdir: str) -> TestClient:
    db_file = Path(tmpdir) / "test_phase10.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("ENABLE_DEMO_RESET", "true")
    get_settings.cache_clear()
    return TestClient(create_app())


def test_dietary_labels_allergens_and_menu_dietary_filtering(monkeypatch) -> None:
    """Managers control vegan/jain/allergen metadata; never guessed; filterable via /api/menu."""
    with tempfile.TemporaryDirectory() as tmpdir:
        with _setup_app(monkeypatch, tmpdir) as client:
            # Seeded items default to unverified vegan/jain=False and allergen_info=None
            seeded = client.get("/api/menu").json()
            assert len(seeded) == 11
            assert all(item["is_vegan"] is False for item in seeded)
            assert all(item["is_jain"] is False for item in seeded)
            assert all(item["allergen_info"] is None for item in seeded)

            # Reject marking Non-Veg item as Vegan or Jain
            bad_res = client.post(
                "/api/manager/menu",
                json={
                    "name": "Egg Roll",
                    "description": "Crispy roll with egg filling.",
                    "category": "Fast Food",
                    "price": 7500,
                    "prep_minutes": 4,
                    "is_veg": False,
                    "is_vegan": True,
                    "is_jain": False,
                    "available": True,
                },
            )
            assert bad_res.status_code == 422

            # Create verified Vegan + Jain dish with explicit manager allergen info
            vegan_res = client.post(
                "/api/manager/menu",
                json={
                    "name": "Jain Steamed Idli Plate",
                    "description": "Steamed rice cakes without onion or garlic, served with fresh chutney.",
                    "category": "Meals",
                    "price": 5000,
                    "prep_minutes": 3,
                    "is_veg": True,
                    "is_vegan": True,
                    "is_jain": True,
                    "allergen_info": "May contain sesame or mustard seeds",
                    "available": True,
                },
            )
            assert vegan_res.status_code == 201
            created = vegan_res.json()
            assert created["is_vegan"] is True
            assert created["is_jain"] is True
            assert created["allergen_info"] == "May contain sesame or mustard seeds"

            # Edit an existing seeded dish to attach manager-verified allergen info
            upd_res = client.put(
                "/api/manager/menu/item_7",
                json={
                    "name": "Poha & Peanut Crunch",
                    "description": "Light flattened rice tempered with curry leaves and peanuts.",
                    "category": "Snacks",
                    "price": 3500,
                    "prep_minutes": 3,
                    "is_veg": True,
                    "is_vegan": True,
                    "is_jain": False,
                    "allergen_info": "Contains peanuts",
                    "available": True,
                },
            )
            assert upd_res.status_code == 200
            assert upd_res.json()["allergen_info"] == "Contains peanuts"

            # Filter /api/menu by dietary=vegan and dietary=jain and dietary=non_veg
            vegan_menu = client.get("/api/menu?dietary=vegan").json()
            assert {i["id"] for i in vegan_menu} == {created["id"], "item_7"}

            jain_menu = client.get("/api/menu?dietary=jain").json()
            assert [i["id"] for i in jain_menu] == [created["id"]]

            assert client.get("/api/menu?dietary=non_veg").json() == []

        get_settings.cache_clear()


def test_special_instructions_sanitized_and_preserved_and_no_unrestricted_order_list(
    monkeypatch,
) -> None:
    """Notes sanitize control characters, persist through kitchen/tracking, and orders cannot be listed openly."""
    with tempfile.TemporaryDirectory() as tmpdir:
        with _setup_app(monkeypatch, tmpdir) as client:
            # Verify there is NO open GET /api/orders student enumeration endpoint
            assert client.get("/api/orders").status_code in (404, 405)

            placed = client.post(
                "/api/orders",
                json={
                    "customer_name": "Meera\n\tNair",
                    "items": [{"menu_item_id": "item_2", "quantity": 1}],
                    "notes": "No onion\x00\x07 please, peanut sensitivity",
                },
            )
            assert placed.status_code == 201
            order_id = placed.json()["id"]

            tracked = client.get(f"/api/orders/{order_id}").json()
            assert tracked["customer_name"] == "Meera Nair"
            assert tracked["notes"] == "No onion please, peanut sensitivity"

            kitchen_orders = client.get("/api/kitchen/orders").json()
            matched = [o for o in kitchen_orders if o["id"] == order_id][0]
            assert matched["notes"] == "No onion please, peanut sensitivity"

        get_settings.cache_clear()


def test_simulated_demo_payment_lifecycle_and_duplicate_protection(monkeypatch) -> None:
    """Demo payment keeps order status separate, starts pending for DEMO_UPI, and prevents double-pay."""
    with tempfile.TemporaryDirectory() as tmpdir:
        with _setup_app(monkeypatch, tmpdir) as client:
            # Default COUNTER_CASH order starts with PAY_AT_COUNTER
            cash_order = client.post(
                "/api/orders",
                json={
                    "customer_name": "Cash Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                },
            ).json()
            assert cash_order["payment_method"] == "COUNTER_CASH"
            assert cash_order["payment_status"] == "PAY_AT_COUNTER"

            # DEMO_UPI starts PENDING (never paid automatically just because client requested it)
            upi_order = client.post(
                "/api/orders",
                json={
                    "customer_name": "UPI Student",
                    "items": [{"menu_item_id": "item_2", "quantity": 1}],
                    "payment_method": "DEMO_UPI",
                },
            ).json()
            oid = upi_order["id"]
            assert upi_order["payment_method"] == "DEMO_UPI"
            assert upi_order["payment_status"] == "PENDING"
            assert upi_order["payment_reference"] is None

            # Simulate failed demo payment -> order stays PLACED
            fail_res = client.post(
                f"/api/orders/{oid}/demo-payment",
                json={"outcome": "fail", "method": "DEMO_UPI"},
            )
            assert fail_res.status_code == 200
            assert fail_res.json()["payment_status"] == "DEMO_FAILED"
            assert fail_res.json()["order"]["status"] == "PLACED"

            # Simulate cancelled demo payment -> order still PLACED
            cancel_res = client.post(
                f"/api/orders/{oid}/demo-payment",
                json={"outcome": "cancel", "method": "DEMO_UPI"},
            )
            assert cancel_res.status_code == 200
            assert cancel_res.json()["payment_status"] == "DEMO_CANCELLED"
            assert cancel_res.json()["order"]["status"] == "PLACED"

            # Retry and succeed -> DEMO_PAID with simulated reference
            ok_res = client.post(
                f"/api/orders/{oid}/demo-payment",
                json={"outcome": "succeed", "method": "DEMO_UPI"},
            )
            assert ok_res.status_code == 200
            ok_data = ok_res.json()
            assert ok_data["payment_status"] == "DEMO_PAID"
            assert ok_data["order"]["payment_reference"].startswith("DEMO-UPI-")
            assert ok_data["order"]["status"] == "PLACED"

            # Duplicate payment attempt blocked cleanly with 409 already_demo_paid
            dup_res = client.post(
                f"/api/orders/{oid}/demo-payment",
                json={"outcome": "succeed", "method": "DEMO_UPI"},
            )
            assert dup_res.status_code == 409
            assert dup_res.json()["error"] == "already_demo_paid"

            # Switch to Cash at Counter works on pending/failed/cancelled DEMO_UPI orders
            cash_switch_order = client.post(
                "/api/orders",
                json={
                    "customer_name": "Switch Student",
                    "items": [{"menu_item_id": "item_9", "quantity": 1}],
                    "payment_method": "DEMO_UPI",
                },
            ).json()
            switch_res = client.post(
                f"/api/orders/{cash_switch_order['id']}/demo-payment",
                json={"outcome": "switch_to_counter", "method": "COUNTER_CASH"},
            )
            assert switch_res.status_code == 200
            assert switch_res.json()["payment_status"] == "PAY_AT_COUNTER"
            assert switch_res.json()["order"]["payment_method"] == "COUNTER_CASH"

        get_settings.cache_clear()


def test_phase10_migration_preserves_legacy_menu_and_orders(monkeypatch) -> None:
    """init_db() upgrades pre-Phase-10 SQLite tables without losing menu items or orders."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "legacy_pre10.db"
        conn = sqlite3.connect(str(db_file))
        conn.executescript(
            """
            CREATE TABLE menu_items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL,
                price INTEGER NOT NULL,
                prep_minutes INTEGER NOT NULL,
                available INTEGER NOT NULL DEFAULT 1,
                image_url TEXT
            );
            INSERT INTO menu_items VALUES (
                'legacy_1', 'Legacy Poha', 'Saved dish', 'Snacks', 3000, 3, 1, NULL
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
                'ord_old_1', 'OLD9', 'Legacy Student', 'PLACED',
                '2026-11-12T12:20:00+05:30', '2026-11-12T12:25:00+05:30',
                3000, 3, 'No spice', '2026-11-12T12:10:00+05:30', '2026-11-12T12:10:00+05:30'
            );
            """
        )
        conn.commit()
        conn.close()

        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        get_settings.cache_clear()

        init_db()
        seed_menu_items()

        migrated = get_connection()
        try:
            menu_row = migrated.execute(
                "SELECT * FROM menu_items WHERE id = 'legacy_1'"
            ).fetchone()
            assert menu_row is not None
            assert int(menu_row["is_vegan"]) == 0
            assert int(menu_row["is_jain"]) == 0
            assert menu_row["allergen_info"] is None

            ord_row = migrated.execute(
                "SELECT * FROM orders WHERE id = 'ord_old_1'"
            ).fetchone()
            assert ord_row is not None
            assert ord_row["payment_method"] == "COUNTER_CASH"
            assert ord_row["payment_status"] == "PAY_AT_COUNTER"
            assert ord_row["payment_reference"] is None
        finally:
            migrated.close()

        get_settings.cache_clear()

