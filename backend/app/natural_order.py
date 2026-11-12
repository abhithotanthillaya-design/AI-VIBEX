"""Deterministic plain-language order parser backed by live SQLite menu & slot data."""

from datetime import datetime, timedelta
from difflib import SequenceMatcher
import re
import sqlite3

from app.allocator import (
    align_to_slot_start,
    is_slot_feasible_for_workload,
    list_available_pickup_slots,
)
from app.config import Settings
from app.database import db_session
from app.models import row_to_menu_item
from app.schemas import (
    AmbiguousOrderTerm,
    AvailablePickupSlotResponse,
    MenuItemResponse,
    NaturalOrderParseResponse,
    ParsedOrderItem,
    ParsedPickupTime,
    SlotWorkloadResponse,
)

MAX_NATURAL_QUANTITY = 20

_NUMBER_WORDS: dict[str, int] = {
    "zero": 0,
    "a": 1,
    "an": 1,
    "one": 1,
    "single": 1,
    "two": 2,
    "couple": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "sixteen": 16,
    "seventeen": 17,
    "eighteen": 18,
    "nineteen": 19,
    "twenty": 20,
}

# Safe word-level spelling & Indian canteen synonym normalizations.
_TOKEN_SYNONYMS: dict[str, str] = {
    "tea": "chai",
    "teas": "chai",
    "chais": "chai",
    "dosas": "dosa",
    "dosai": "dosa",
    "sandwiches": "sandwich",
    "rolls": "roll",
    "samosas": "samosa",
    "coffees": "coffee",
    "sodas": "soda",
    "bowls": "bowl",
    "maggie": "maggi",
    "magi": "maggi",
    "choley": "chole",
    "bhatura": "bhature",
    "bhaturas": "bhature",
    "bhatora": "bhature",
    "bhaturey": "bhature",
    "noodles": "maggi",
    "nimbu": "lime",
    "lemon": "lime",
    "vegetarian": "veg",
}

_STOP_WORDS = {
    "i",
    "would",
    "like",
    "to",
    "order",
    "need",
    "want",
    "please",
    "give",
    "me",
    "can",
    "get",
    "add",
    "have",
    "some",
    "of",
    "the",
    "with",
    "for",
    "pickup",
    "around",
    "at",
    "by",
    "pls",
}

_GENERIC_AMBIGUOUS_WORDS = {
    "meal",
    "meals",
    "snack",
    "snacks",
    "drink",
    "drinks",
    "beverage",
    "beverages",
    "food",
    "veg",
    "item",
    "items",
    "anything",
}

# Matches optional pickup preposition + time (HH:MM or H am/pm) or standalone HH:MM / H am|pm.
_TIME_CLAUSE_RE = re.compile(
    r"(?:\b(?:for\s+pickup|pickup|pick\s*up)\s*(?:around|at|by|near|for)?\s*|\b(?:around|at|by)\s+)"
    r"(\d{1,2})(?:[:.](\d{1,2}))?\s*(a\.?m\.?|p\.?m\.?)?\b"
    r"|\b(\d{1,2})(?:[:.](\d{1,2}))\s*(a\.?m\.?|p\.?m\.?)?\b"
    r"|\b(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b",
    re.IGNORECASE,
)


def _normalize_token(token: str) -> str:
    cleaned = token.lower().strip()
    if cleaned in _TOKEN_SYNONYMS:
        return _TOKEN_SYNONYMS[cleaned]
    if len(cleaned) > 4 and cleaned.endswith("es") and not cleaned.endswith("ies"):
        singular = cleaned[:-2]
        return _TOKEN_SYNONYMS.get(singular, singular)
    if len(cleaned) > 3 and cleaned.endswith("s") and not cleaned.endswith("ss"):
        singular = cleaned[:-1]
        return _TOKEN_SYNONYMS.get(singular, singular)
    return cleaned


def _tokenize_food_words(phrase: str) -> list[str]:
    raw_tokens = re.findall(r"[a-zA-Z0-9]+", phrase.lower())
    normalized: list[str] = []
    for tok in raw_tokens:
        if tok in _STOP_WORDS:
            continue
        normalized.append(_normalize_token(tok))
    return normalized


def _to_suggested_slot_workload(
    slot: AvailablePickupSlotResponse,
) -> SlotWorkloadResponse:
    """Convert a student-facing available slot record into SlotWorkloadResponse."""
    return SlotWorkloadResponse(
        slot_start=slot.slot_start,
        slot_end=slot.slot_end,
        used_units=slot.used_units,
        capacity_units=slot.capacity_units,
        remaining_units=slot.remaining_units,
        active_orders=slot.active_orders,
        is_full=slot.is_full,
        is_upcoming=True,
        is_closed=slot.is_closed,
        close_reason=slot.close_reason,
    )


def _extract_pickup_time(
    text: str,
    now: datetime,
    slots: list[AvailablePickupSlotResponse],
    slot_duration_minutes: int,
) -> tuple[str, ParsedPickupTime | None]:
    """Extract at most one preferred pickup time expression and strip it from text."""
    match = _TIME_CLAUSE_RE.search(text)
    if match is None:
        return text, None

    raw_phrase = match.group(0).strip()
    cleaned_text = (text[: match.start()] + " " + text[match.end() :]).strip()
    cleaned_text = re.sub(r"\s+", " ", cleaned_text)

    if match.group(1) is not None:
        hour_str, min_str, meridiem_raw = match.group(1), match.group(2), match.group(3)
    elif match.group(4) is not None:
        hour_str, min_str, meridiem_raw = match.group(4), match.group(5), match.group(6)
    else:
        hour_str, min_str, meridiem_raw = match.group(7), "0", match.group(8)

    hour = int(hour_str)
    minute = int(min_str) if min_str is not None else 0
    meridiem = (
        meridiem_raw.replace(".", "").lower() if meridiem_raw is not None else None
    )

    open_upcoming = [
        _to_suggested_slot_workload(slot)
        for slot in slots
        if not slot.is_closed and not slot.is_full
    ][:3]

    if minute < 0 or minute > 59:
        return cleaned_text, ParsedPickupTime(
            raw_text=raw_phrase,
            status="invalid",
            message=f"Requested time '{raw_phrase}' has invalid minutes. Please use a valid time such as 1:30 PM.",
            suggested_slots=open_upcoming,
        )

    if meridiem is not None:
        if hour < 1 or hour > 12:
            return cleaned_text, ParsedPickupTime(
                raw_text=raw_phrase,
                status="invalid",
                message=f"Requested time '{raw_phrase}' is invalid for 12-hour AM/PM format.",
                suggested_slots=open_upcoming,
            )
        if meridiem == "am":
            hour_24 = 0 if hour == 12 else hour
        else:
            hour_24 = 12 if hour == 12 else hour + 12
    else:
        if hour < 0 or hour > 23:
            return cleaned_text, ParsedPickupTime(
                raw_text=raw_phrase,
                status="invalid",
                message=f"Requested time '{raw_phrase}' is not a valid clock time.",
                suggested_slots=open_upcoming,
            )
        # During daytime campus hours (8 AM onward), bare 1..7 without AM/PM refers to afternoon.
        if 1 <= hour <= 7 and now.hour >= 8:
            hour_24 = hour + 12
        else:
            hour_24 = hour

    requested_dt = now.replace(
        hour=hour_24,
        minute=minute,
        second=0,
        microsecond=0,
    )
    formatted_time = requested_dt.strftime("%I:%M %p").lstrip("0")

    if requested_dt < now:
        return cleaned_text, ParsedPickupTime(
            raw_text=raw_phrase,
            requested_time_iso=requested_dt.isoformat(timespec="seconds"),
            formatted_time=formatted_time,
            status="past",
            message=(
                f"Requested pickup time ({formatted_time}) has already passed. "
                "Checkout assigns the earliest open slot automatically."
            ),
            suggested_slots=open_upcoming,
        )

    # Check whether the 5-minute slot containing requested_dt is open or closed/full.
    slot_floor_minute = (requested_dt.minute // slot_duration_minutes) * slot_duration_minutes
    target_slot_start = requested_dt.replace(minute=slot_floor_minute, second=0, microsecond=0)
    matching_slot = next(
        (
            slot
            for slot in slots
            if datetime.fromisoformat(slot.slot_start) == target_slot_start
        ),
        None,
    )

    if matching_slot is None:
        return cleaned_text, ParsedPickupTime(
            raw_text=raw_phrase,
            requested_time_iso=requested_dt.isoformat(timespec="seconds"),
            formatted_time=formatted_time,
            status="unavailable",
            message=(
                f"The {formatted_time} window is outside the current bookable pickup horizon. "
                "Please choose one of the available checkout slots."
            ),
            matched_slot_start=None,
            suggested_slots=open_upcoming,
        )

    if matching_slot.is_closed or matching_slot.is_full:
        reason = "closed" if matching_slot.is_closed else "full"
        return cleaned_text, ParsedPickupTime(
            raw_text=raw_phrase,
            requested_time_iso=requested_dt.isoformat(timespec="seconds"),
            formatted_time=formatted_time,
            status="unavailable",
            message=(
                f"The {formatted_time} window is currently {reason}. "
                "Please choose an open pickup slot during checkout."
            ),
            matched_slot_start=None,
            suggested_slots=open_upcoming,
        )

    slot_start_dt = datetime.fromisoformat(matching_slot.slot_start)
    slot_end_dt = datetime.fromisoformat(matching_slot.slot_end)
    window_text = (
        f"{slot_start_dt.strftime('%I:%M %p').lstrip('0')} – "
        f"{slot_end_dt.strftime('%I:%M %p').lstrip('0')}"
    )
    return cleaned_text, ParsedPickupTime(
        raw_text=raw_phrase,
        requested_time_iso=requested_dt.isoformat(timespec="seconds"),
        formatted_time=formatted_time,
        status="valid_note",
        message=(
            f"Matched pickup slot {window_text} (IST, {matching_slot.remaining_units} of "
            f"{matching_slot.capacity_units} units open); preselected in checkout for your confirmation."
        ),
        matched_slot_start=matching_slot.slot_start,
        suggested_slots=open_upcoming,
    )


def _split_order_clauses(text: str) -> list[str]:
    """Split text into item clauses while keeping dish names like 'Poha & Peanut' intact."""
    replaced = re.sub(r"\band\b", ",", text, flags=re.IGNORECASE)
    parts = re.split(r"[,;\n+]+", replaced)
    clauses: list[str] = []
    for part in parts:
        cleaned = part.strip(" .!?")
        if cleaned:
            clauses.append(cleaned)
    return clauses


def _extract_clause_quantity(
    clause: str,
) -> tuple[int | None, str, str | None]:
    """Extract leading quantity and remaining food phrase from a clause.

    Returns (quantity, remaining_phrase, error_message).
    """
    tokens = clause.strip().split()
    if not tokens:
        return None, "", None

    # Strip leading polite filler words before looking for a quantity token.
    while tokens and tokens[0].lower().strip(".,!?") in _STOP_WORDS:
        tokens.pop(0)

    if not tokens:
        return None, "", None

    first_raw = tokens[0].strip(".,!?")
    first_lower = first_raw.lower()

    # Handle numeric quantities including negative, zero, decimals, or trailing 'x' (e.g. 2x).
    numeric_match = re.fullmatch(r"(-?\d+(?:\.\d+)?)[xX]?", first_raw)
    if numeric_match:
        num_str = numeric_match.group(1)
        remaining = " ".join(tokens[1:]).strip()
        if "." in num_str:
            return (
                None,
                remaining,
                f"Quantity must be a whole number (got '{first_raw}' for '{remaining or clause}').",
            )
        qty = int(num_str)
        if qty <= 0:
            return (
                None,
                remaining,
                f"Quantity must be at least 1 (got {qty} for '{remaining or clause}').",
            )
        if qty > MAX_NATURAL_QUANTITY:
            return (
                None,
                remaining,
                f"Quantity {qty} for '{remaining or clause}' exceeds the maximum of {MAX_NATURAL_QUANTITY} per item in plain-language ordering.",
            )
        return qty, remaining, None

    if first_lower in _NUMBER_WORDS:
        qty = _NUMBER_WORDS[first_lower]
        remaining = " ".join(tokens[1:]).strip()
        if qty <= 0:
            return (
                None,
                remaining,
                f"Quantity cannot be zero for '{remaining or clause}'.",
            )
        return qty, remaining, None

    # Handle phrasing like "two of ..." or "a couple of ..."
    return 1, " ".join(tokens).strip(), None


def _score_menu_item(
    query_tokens: list[str],
    query_joined: str,
    item: MenuItemResponse,
) -> tuple[float, str]:
    """Compute a deterministic similarity score and match type against a DB MenuItem."""
    item_tokens = _tokenize_food_words(item.name)
    item_joined = " ".join(item_tokens)

    if not query_tokens or not item_tokens:
        return 0.0, "fuzzy"

    if query_joined == item_joined:
        return 1.0, "exact"

    query_set = set(query_tokens)
    item_set = set(item_tokens)

    if query_set.issubset(item_set):
        # Shorthand match like "veg sandwich" -> "Veg Grilled Sandwich",
        # "chai" -> "Masala Chai", "cold coffee" -> "Classic Cold Coffee".
        coverage = len(query_set) / len(item_set)
        return 0.80 + (0.18 * coverage), "synonym"

    if item_set.issubset(query_set):
        coverage = len(item_set) / len(query_set)
        return 0.78 + (0.15 * coverage), "synonym"

    # Token overlap + character similarity for minor typos (e.g. "masla dosa").
    overlap = len(query_set & item_set) / max(len(query_set | item_set), 1)
    seq_ratio = SequenceMatcher(None, query_joined, item_joined).ratio()

    best_token_sim = 0.0
    for q_tok in query_tokens:
        for i_tok in item_tokens:
            best_token_sim = max(
                best_token_sim,
                SequenceMatcher(None, q_tok, i_tok).ratio(),
            )

    combined = (0.55 * seq_ratio) + (0.35 * overlap) + (0.10 * best_token_sim)
    return combined, "fuzzy"


def _match_phrase_to_menu(
    phrase: str,
    active_items: list[MenuItemResponse],
    deleted_items: list[MenuItemResponse],
) -> tuple[str, list[tuple[MenuItemResponse, str]]]:
    """Match a cleaned food phrase against live SQLite menu items.

    Returns (status, [(item, match_type), ...]) where status is one of:
    'matched', 'ambiguous', 'deleted', 'unmatched'.
    """
    query_tokens = _tokenize_food_words(phrase)
    if not query_tokens:
        return "unmatched", []

    query_joined = " ".join(query_tokens)

    # Generic category/modifier words like "veg meal" or "drink" must prompt user choice.
    if all(tok in _GENERIC_AMBIGUOUS_WORDS for tok in query_tokens):
        candidates = [
            item
            for item in active_items
            if any(
                tok in item.category.lower() or (tok == "veg" and item.is_veg)
                for tok in query_tokens
            )
        ]
        if candidates:
            return "ambiguous", [(c, "synonym") for c in candidates[:4]]
        return "unmatched", []

    scored: list[tuple[float, MenuItemResponse, str]] = []
    for item in active_items:
        score, match_type = _score_menu_item(query_tokens, query_joined, item)
        if score >= 0.68:
            scored.append((score, item, match_type))

    if not scored:
        for deleted_item in deleted_items:
            del_score, _ = _score_menu_item(query_tokens, query_joined, deleted_item)
            if del_score >= 0.74:
                return "deleted", [(deleted_item, "synonym")]
        return "unmatched", []

    scored.sort(key=lambda entry: (-entry[0], not entry[1].available, entry[1].name))
    top_score, top_item, top_type = scored[0]

    # Exact match wins immediately.
    if top_score >= 0.99:
        return "matched", [(top_item, top_type)]

    # If multiple distinct items tie closely on a short/generic token, treat as ambiguous
    # rather than silently guessing one.
    close_candidates = [
        (item, mtype)
        for score, item, mtype in scored
        if (top_score - score) <= 0.06 and score >= 0.72
    ]
    if len(close_candidates) > 1:
        return "ambiguous", close_candidates[:4]

    if top_score >= 0.74:
        return "matched", [(top_item, top_type)]

    return "unmatched", []


def parse_natural_order(
    text: str,
    settings: Settings,
    *,
    reference_time: datetime | None = None,
) -> NaturalOrderParseResponse:
    """Parse plain-language food order text against actual SQLite menu and slot state."""
    tz = settings.zone_info
    now = (reference_time or datetime.now(tz)).astimezone(tz)

    with db_session() as conn:
        menu_rows = conn.execute(
            """
            SELECT id, name, description, category, price, prep_minutes, available,
                   is_veg, is_vegan, is_jain, allergen_info, is_deleted, image_url
            FROM menu_items
            ORDER BY category ASC, name ASC
            """
        ).fetchall()
        available_slots_resp = list_available_pickup_slots(
            conn,
            settings,
            reference_time=now,
        )
        slots = available_slots_resp.slots

    active_catalog: list[MenuItemResponse] = []
    deleted_catalog: list[MenuItemResponse] = []
    for row in menu_rows:
        item = row_to_menu_item(row)
        if bool(row["is_deleted"]):
            deleted_catalog.append(item)
        else:
            active_catalog.append(item)

    remaining_text, pickup_time = _extract_pickup_time(
        text.strip(),
        now,
        slots,
        settings.slot_duration_minutes,
    )

    warnings: list[str] = []
    if pickup_time is not None and pickup_time.status in ("past", "invalid", "unavailable"):
        warnings.append(pickup_time.message)

    clauses = _split_order_clauses(remaining_text)

    matched_by_id: dict[str, ParsedOrderItem] = {}
    unavailable_by_id: dict[str, ParsedOrderItem] = {}
    ambiguous_items: list[AmbiguousOrderTerm] = []
    unmatched_terms: list[str] = []

    for clause in clauses:
        qty, food_phrase, qty_error = _extract_clause_quantity(clause)
        if qty_error:
            warnings.append(qty_error)
            if food_phrase:
                unmatched_terms.append(clause)
            continue

        if qty is None or not food_phrase:
            continue

        status, results = _match_phrase_to_menu(
            food_phrase,
            active_catalog,
            deleted_catalog,
        )

        if status == "matched" and results:
            item, match_type = results[0]
            if item.available:
                existing = matched_by_id.get(item.id)
                new_qty = (existing.quantity if existing else 0) + qty
                if new_qty > MAX_NATURAL_QUANTITY:
                    warnings.append(
                        f"Combined quantity for '{item.name}' ({new_qty}) exceeds {MAX_NATURAL_QUANTITY}; capped at {MAX_NATURAL_QUANTITY}."
                    )
                    new_qty = MAX_NATURAL_QUANTITY
                matched_by_id[item.id] = ParsedOrderItem(
                    menu_item_id=item.id,
                    name=item.name,
                    category=item.category,
                    quantity=new_qty,
                    unit_price=item.price,
                    line_total=item.price * new_qty,
                    prep_minutes=item.prep_minutes,
                    available=True,
                    is_veg=item.is_veg,
                    matched_phrase=food_phrase,
                    match_type=match_type,  # type: ignore[arg-type]
                )
            else:
                existing_unavail = unavailable_by_id.get(item.id)
                new_qty = (existing_unavail.quantity if existing_unavail else 0) + qty
                unavailable_by_id[item.id] = ParsedOrderItem(
                    menu_item_id=item.id,
                    name=item.name,
                    category=item.category,
                    quantity=new_qty,
                    unit_price=item.price,
                    line_total=item.price * new_qty,
                    prep_minutes=item.prep_minutes,
                    available=False,
                    is_veg=item.is_veg,
                    matched_phrase=food_phrase,
                    match_type=match_type,  # type: ignore[arg-type]
                )
                warnings.append(
                    f"'{item.name}' is currently sold out and cannot be added to your cart."
                )
        elif status == "ambiguous" and results:
            candidates = [item for item, _ in results]
            ambiguous_items.append(
                AmbiguousOrderTerm(
                    phrase=food_phrase,
                    quantity=qty,
                    candidates=candidates,
                )
            )
            warnings.append(
                f"'{food_phrase}' could match multiple dishes. Please choose the exact item below."
            )
        elif status == "deleted":
            unmatched_terms.append(food_phrase)
            warnings.append(
                f"'{food_phrase}' has been removed from the canteen menu."
            )
        else:
            unmatched_terms.append(food_phrase)
            warnings.append(
                f"Could not find '{food_phrase}' on today's menu. No item was substituted."
            )

    matched_items = list(matched_by_id.values())
    unavailable_items = list(unavailable_by_id.values())
    subtotal_paise = sum(item.line_total for item in matched_items)
    total_prep_units = sum(item.prep_minutes * item.quantity for item in matched_items)

    # Re-verify matched pickup slot against extracted order workload before preselection.
    if (
        pickup_time is not None
        and pickup_time.status == "valid_note"
        and pickup_time.matched_slot_start is not None
        and total_prep_units > 0
    ):
        matched_slot_obj = next(
            (s for s in slots if s.slot_start == pickup_time.matched_slot_start),
            None,
        )
        if matched_slot_obj is not None and not is_slot_feasible_for_workload(
            matched_slot_obj.used_units,
            matched_slot_obj.capacity_units,
            matched_slot_obj.is_closed,
            total_prep_units,
        ):
            feasible_suggestions = [
                _to_suggested_slot_workload(s)
                for s in slots
                if is_slot_feasible_for_workload(
                    s.used_units,
                    s.capacity_units,
                    s.is_closed,
                    total_prep_units,
                )
            ][:3]
            if total_prep_units > matched_slot_obj.capacity_units * 3:
                reason_msg = (
                    f"Order workload ({total_prep_units} units) exceeds the maximum single-order limit "
                    f"({matched_slot_obj.capacity_units * 3} units)."
                )
            elif (
                total_prep_units > matched_slot_obj.capacity_units
                and matched_slot_obj.used_units > 0
            ):
                reason_msg = (
                    f"The {pickup_time.formatted_time} window already has active orders; this "
                    f"{total_prep_units}-unit order requires an empty pickup slot."
                )
            else:
                reason_msg = (
                    f"The {pickup_time.formatted_time} window only has {matched_slot_obj.remaining_units} "
                    f"units free, which cannot fit {total_prep_units} prep units."
                )
            pickup_time = ParsedPickupTime(
                raw_text=pickup_time.raw_text,
                requested_time_iso=pickup_time.requested_time_iso,
                formatted_time=pickup_time.formatted_time,
                status="unavailable",
                message=f"{reason_msg} Please confirm another available slot in checkout.",
                matched_slot_start=None,
                suggested_slots=feasible_suggestions,
            )
            warnings.append(pickup_time.message)

    if (
        not matched_items
        and not unavailable_items
        and not ambiguous_items
        and not unmatched_terms
        and not warnings
    ):
        warnings.append(
            "No menu items were detected in your request. Mention dish names like 'masala dosa' or 'masala chai'."
        )

    return NaturalOrderParseResponse(
        original_text=text,
        matched_items=matched_items,
        unavailable_items=unavailable_items,
        ambiguous_items=ambiguous_items,
        unmatched_terms=unmatched_terms,
        warnings=warnings,
        requested_pickup_time=pickup_time,
        subtotal_paise=subtotal_paise,
        total_prep_units=total_prep_units,
        can_add_to_cart=len(matched_items) > 0,
    )
