"""Tests for Phase 8 deterministic plain-language order parsing and slot-time checks."""

from datetime import datetime
from pathlib import Path
import tempfile

from fastapi.testclient import TestClient

from app.config import get_settings
from app.database import init_db
from app.main import create_app
from app.natural_order import parse_natural_order
from app.seed import seed_menu_items


def _setup_test_app(monkeypatch, tmpdir: str):
    db_file = Path(tmpdir) / "test_natural_order.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_file))
    monkeypatch.setenv("SLOT_CAPACITY_UNITS", "12")
    monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
    get_settings.cache_clear()
    return create_app()


def test_natural_order_valid_items_synonyms_and_db_prices(monkeypatch) -> None:
    """Verify multiple items, number words, synonyms, and authoritative DB prices."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as client:
            res = client.post(
                "/api/natural-order/parse",
                json={"text": "One masala dosa and two teas"},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["can_add_to_cart"] is True
            assert len(data["matched_items"]) == 2

            dosa = next(i for i in data["matched_items"] if i["menu_item_id"] == "item_2")
            chai = next(i for i in data["matched_items"] if i["menu_item_id"] == "item_9")
            assert dosa["quantity"] == 1
            assert dosa["unit_price"] == 6500
            assert chai["quantity"] == 2
            assert chai["unit_price"] == 2000
            assert data["subtotal_paise"] == 10500
            assert data["total_prep_units"] == 10
            assert data["unmatched_terms"] == []

        get_settings.cache_clear()


def test_natural_order_rejects_unknown_ambiguous_unavailable_deleted_and_bad_quantities(
    monkeypatch,
) -> None:
    """Verify no fabricated items, no silent substitution, unavailable/deleted detection, and quantity limits."""
    with tempfile.TemporaryDirectory() as tmpdir:
        app = _setup_test_app(monkeypatch, tmpdir)
        with TestClient(app) as client:
            # Blank input rejected
            assert (
                client.post("/api/natural-order/parse", json={"text": "   "}).status_code
                == 422
            )

            # Unknown items ("two idlis", "one vada") must NOT substitute dosa
            unknown_res = client.post(
                "/api/natural-order/parse",
                json={"text": "I need two idlis and one cold coffee"},
            ).json()
            assert len(unknown_res["matched_items"]) == 1
            assert unknown_res["matched_items"][0]["menu_item_id"] == "item_10"
            assert unknown_res["unmatched_terms"] == ["idlis"]
            assert any("idlis" in w.lower() for w in unknown_res["warnings"])

            # Generic / ambiguous phrase ("one veg meal" or "one masala") prompts user instead of guessing
            ambig_res = client.post(
                "/api/natural-order/parse",
                json={"text": "One veg meal"},
            ).json()
            assert ambig_res["matched_items"] == []
            assert len(ambig_res["ambiguous_items"]) == 1
            assert len(ambig_res["ambiguous_items"][0]["candidates"]) >= 2

            ambig_masala = client.post(
                "/api/natural-order/parse",
                json={"text": "Two masala"},
            ).json()
            assert ambig_masala["matched_items"] == []
            assert len(ambig_masala["ambiguous_items"]) == 1

            # Unavailable item (item_12 Butter Pav Bhaji) detected cleanly
            unavail_res = client.post(
                "/api/natural-order/parse",
                json={"text": "One pav bhaji and one poha"},
            ).json()
            assert [i["menu_item_id"] for i in unavail_res["matched_items"]] == ["item_7"]
            assert [i["menu_item_id"] for i in unavail_res["unavailable_items"]] == ["item_12"]
            assert any("sold out" in w.lower() for w in unavail_res["warnings"])

            # Soft-deleted item is flagged as removed rather than ordered
            client.delete("/api/manager/menu/item_7")
            deleted_res = client.post(
                "/api/natural-order/parse",
                json={"text": "One poha"},
            ).json()
            assert deleted_res["matched_items"] == []
            assert any("removed from the canteen menu" in w.lower() for w in deleted_res["warnings"])

            # Zero, negative, and excessive quantities rejected cleanly
            bad_qty_res = client.post(
                "/api/natural-order/parse",
                json={"text": "zero teas, -2 masala dosa, 100 cold coffee"},
            ).json()
            assert bad_qty_res["matched_items"] == []
            assert bad_qty_res["can_add_to_cart"] is False
            assert len(bad_qty_res["warnings"]) >= 3

        get_settings.cache_clear()


def test_natural_order_pickup_time_extraction_past_invalid_and_closed_slot(
    monkeypatch,
) -> None:
    """Verify Asia/Kolkata pickup time extraction, past/invalid times, and closed-slot warnings."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_natural_time.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        monkeypatch.setenv("SLOT_CAPACITY_UNITS", "12")
        monkeypatch.setenv("SLOT_DURATION_MINUTES", "5")
        get_settings.cache_clear()

        init_db()
        seed_menu_items()
        settings = get_settings()
        ref_now = datetime.fromisoformat("2026-11-12T12:47:00+05:30")

        # Valid future requested time
        future_res = parse_natural_order(
            "One masala dosa for pickup around 1:15 PM",
            settings,
            reference_time=ref_now,
        )
        assert len(future_res.matched_items) == 1
        assert future_res.requested_pickup_time is not None
        assert future_res.requested_pickup_time.status == "valid_note"
        assert future_res.requested_pickup_time.formatted_time == "1:15 PM"

        # Past pickup time flagged with open alternatives
        past_res = parse_natural_order(
            "Two veg sandwiches at 10:30 AM",
            settings,
            reference_time=ref_now,
        )
        assert len(past_res.matched_items) == 1
        assert past_res.requested_pickup_time is not None
        assert past_res.requested_pickup_time.status == "past"
        assert len(past_res.requested_pickup_time.suggested_slots) >= 1

        # Invalid clock time (25:99) flagged cleanly
        invalid_time_res = parse_natural_order(
            "One cold coffee at 25:99",
            settings,
            reference_time=ref_now,
        )
        assert len(invalid_time_res.matched_items) == 1
        assert invalid_time_res.requested_pickup_time is not None
        assert invalid_time_res.requested_pickup_time.status == "invalid"

        # Closed slot detected when manager closes 1:15 PM slot
        app = create_app()
        with TestClient(app) as client:
            client.patch(
                "/api/manager/slots/status",
                json={
                    "slot_start": "2026-11-12T13:15:00+05:30",
                    "is_closed": True,
                    "reason": "Lunch maintenance",
                },
            )

        closed_res = parse_natural_order(
            "One masala dosa around 1:15 PM",
            settings,
            reference_time=ref_now,
        )
        assert closed_res.requested_pickup_time is not None
        assert closed_res.requested_pickup_time.status == "unavailable"
        assert "closed" in closed_res.requested_pickup_time.message.lower()

        get_settings.cache_clear()
