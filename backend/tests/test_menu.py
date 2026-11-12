"""Tests for idempotent menu seeding and GET /api/menu."""

from pathlib import Path
import tempfile

from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import db_session
from app.main import create_app
from app.seed import SEED_MENU_ITEMS, seed_menu_items


def test_menu_seeding_is_idempotent_and_get_menu_returns_available(
    monkeypatch,
) -> None:
    """Verify startup seeds items once, never duplicates on restart, and filters unavailable items by default."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_menu.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        get_settings.cache_clear()

        app = create_app()
        with TestClient(app) as client:
            # Calling seed_menu_items again should insert 0 new rows.
            second_seed_inserts = seed_menu_items()
            assert second_seed_inserts == 0

            with db_session() as conn:
                total_rows = conn.execute(
                    "SELECT COUNT(*) AS count FROM menu_items"
                ).fetchone()["count"]
            assert total_rows == len(SEED_MENU_ITEMS)

            response = client.get("/api/menu")
            assert response.status_code == 200
            items = response.json()

            expected_available = [item for item in SEED_MENU_ITEMS if item.available]
            assert len(items) == len(expected_available)
            assert all(item["available"] is True for item in items)

            all_response = client.get("/api/menu", params={"include_unavailable": "true"})
            assert all_response.status_code == 200
            assert len(all_response.json()) == len(SEED_MENU_ITEMS)

        # Restarting the app on the same SQLite DB must not duplicate rows.
        app_restarted = create_app()
        with TestClient(app_restarted) as client_restarted:
            restarted_response = client_restarted.get("/api/menu")
            assert restarted_response.status_code == 200
            assert len(restarted_response.json()) == len(expected_available)

        get_settings.cache_clear()


def test_menu_filtering_by_category_and_search(monkeypatch) -> None:
    """Verify server-side category and search query filters on GET /api/menu."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_menu_filters.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        get_settings.cache_clear()

        app = create_app()
        with TestClient(app) as client:
            beverages_res = client.get("/api/menu", params={"category": "Beverages"})
            assert beverages_res.status_code == 200
            beverages = beverages_res.json()
            assert len(beverages) == 3
            assert all(item["category"] == "Beverages" for item in beverages)

            search_res = client.get("/api/menu", params={"search": "dosa"})
            assert search_res.status_code == 200
            dosa_items = search_res.json()
            assert len(dosa_items) == 1
            assert dosa_items[0]["id"] == "item_2"

        get_settings.cache_clear()

