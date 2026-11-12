# QUEUELESS — REST API Reference

Base URL (local development): `http://127.0.0.1:8000`

All error responses follow a consistent JSON shape:

```json
{
  "error": "error_code",
  "message": "Human-readable explanation"
}
```

*(Validation errors on `422` also include a `details` array from FastAPI/Pydantic.)*

> **Authentication & CSRF:** Aside from `GET /api/health`, `GET /api/menu`, `POST /api/auth/register`, and `POST /api/auth/login`, endpoints require an active `HttpOnly` session cookie (`queueless_session` by default). All authenticated `POST`, `PUT`, `PATCH`, and `DELETE` requests must also include `X-CSRF-Token` matching the session CSRF token returned by login/register/`/api/auth/me` and pass trusted-origin verification.

---

## 0. Authentication & Profile

### `POST /api/auth/register` (`201 Created`)
Self-registers a **`STUDENT` account only** (request `role` overrides or extra fields are rejected with `422`). Hashes password with Argon2id, sets an `HttpOnly` session cookie, and returns `{ status, user, csrf_token, expires_at }`.
- **Errors:** `409 Conflict` (`email_already_registered`), `422` (`validation_error`, e.g. mismatched passwords or policy failure: 8–128 chars, letters + numbers).

### `POST /api/auth/login`
Authenticates any active account (`STUDENT`, `CANTEEN_STAFF`, `MANAGER`) by normalized email and password, sets an `HttpOnly` session cookie, and returns `{ status, user, csrf_token, expires_at }`.
- **Errors:** `401 Unauthorized` (`invalid_credentials` — generic error without disclosing whether the email exists), `403 Forbidden` (`account_inactive`), `429 Too Many Requests` (`rate_limit_exceeded`).

### `GET /api/auth/me`
Restores active session user details, role, and `csrf_token`. Returns `401` when unauthenticated/expired.

### `POST /api/auth/logout` *(Requires Auth + CSRF)*
Revokes the active server-side row in `sessions` and clears the `HttpOnly` cookie.

### `GET /api/auth/profile` & `PATCH /api/auth/profile` *(Requires Auth + CSRF on PATCH)*
Reads or updates `full_name`, student roll number (`STUDENT` only), or password (requires `current_password`, validates new password policy, rejects inactive sessions).

---

## 1. Health Check

### `GET /api/health`

Verifies API readiness and SQLite connectivity.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "QUEUELESS API",
  "database": "connected",
  "environment": "development",
  "timestamp": "2026-11-12T12:15:00+05:30"
}
```

**Error:** `503 Service Unavailable` if SQLite connectivity check fails.

---

## 2. Menu

### `GET /api/menu`

Returns available canteen menu items stored in SQLite.

**Optional Query Parameters:**
- `category` (string): filter by category (e.g. `Meals`, `Fast Food`, `Snacks`, `Beverages`)
- `search` (string): case-insensitive substring match against `name` or `description`
- `include_unavailable` (boolean, default `false`): include out-of-stock items when `true`

**Response `200 OK`:**
```json
[
  {
    "id": "item_1",
    "name": "Veg Grilled Sandwich",
    "description": "Crisp multi-grain toast layered with spiced potato, cucumber, tomato, and mint chutney.",
    "category": "Fast Food",
    "price": 5000,
    "prep_minutes": 4,
    "available": true,
    "is_veg": true,
    "image_url": "/images/menu/veg-grilled-sandwich.jpg"
  }
]
```

---

## 3. Orders & Pickup Slots

### `GET /api/slots/available`

Returns chronological upcoming 5-minute pickup slots in `Asia/Kolkata` (`MAX_EXTENSION_SLOTS = 24`, up to 2 hours ahead), reflecting manager-configured capacity (`canteen_settings`), active order workload, and closed windows (`closed_slots`).

**Query Parameter:**
- `workload_units` (`int`, optional, default `0`, bounds `0..500`) — cart prep units used to compute per-slot `is_feasible` and `recommended_slot_start`.

**Response `200 OK`:**
```json
{
  "slot_duration_minutes": 5,
  "slot_capacity_units": 12,
  "requested_workload_units": 6,
  "recommended_slot_start": "2026-11-12T12:20:00+05:30",
  "slots": [
    {
      "slot_start": "2026-11-12T12:20:00+05:30",
      "slot_end": "2026-11-12T12:25:00+05:30",
      "capacity_units": 12,
      "used_units": 4,
      "remaining_units": 8,
      "active_orders": 1,
      "availability_state": "available",
      "is_closed": false,
      "close_reason": null,
      "is_full": false,
      "is_feasible": true
    }
  ]
}
```

*(Availability states: `available`, `limited`, `full`, `closed`.)*

---

### `POST /api/orders`

Validates menu items and quantities, computes total price in paise server-side, reserves either the requested exact pickup slot (`requested_pickup_slot_start`) or the earliest feasible slot inside a serialized transaction, and persists the order.

**Request Body:**
```json
{
  "customer_name": "Aarav Sharma",
  "items": [
    { "menu_item_id": "item_1", "quantity": 2 },
    { "menu_item_id": "item_9", "quantity": 1 }
  ],
  "notes": "No extra spicy",
  "requested_pickup_slot_start": "2026-11-12T12:25:00+05:30",
  "payment_method": "DEMO_UPI"
}
```

*(Omit `requested_pickup_slot_start` or pass `null` to use automatic earliest-feasible slot assignment; `payment_method` defaults to `COUNTER_CASH`.)*

**Response `201 Created`:**
```json
{
  "id": "ord_a1b2c3d4e5",
  "pickup_code": "Q7K2",
  "pickup_token": "qlp_9xK2...",
  "status": "PLACED",
  "pickup_slot_start": "2026-11-12T12:20:00+05:30",
  "pickup_slot_end": "2026-11-12T12:25:00+05:30",
  "total_amount": 12000,
  "payment_method": "DEMO_UPI",
  "payment_status": "PENDING",
  "payment_reference": null,
  "message": "Order placed. Please arrive during your pickup window."
}
```
*(Note: `pickup_token` is returned only at creation time; SQLite stores only its SHA-256 hash.)*

**Error Responses:**
- `400 Bad Request` (`unknown_menu_item`, `unavailable_menu_item`, `order_too_large`, `invalid_requested_slot`, `slot_in_past`, `slot_out_of_range`)
- `409 Conflict` (`kitchen_full`, `slot_closed`, `slot_full`, `slot_insufficient_capacity`)
- `422 Unprocessable Content` (`validation_error`, e.g. blank name, empty items, quantity `<= 0`)

---

### `GET /api/orders/mine` *(Requires `STUDENT`)*

Returns all orders belonging to the authenticated student (`orders.user_id = current_user.id`) ordered newest-first.

---

### `GET /api/orders/{order_id}` *(Requires `STUDENT` Owner)*

Returns full order details, snapshotted items, pickup window, and live status for student tracking. Enforces ownership (`order.user_id == current_user.id`); unauthorized or legacy unowned orders return `404 Not Found` (`order_not_found`).

**Response `200 OK`:**
```json
{
  "id": "ord_a1b2c3d4e5",
  "pickup_code": "Q7K2",
  "customer_name": "Aarav Sharma",
  "status": "PREPARING",
  "pickup_slot_start": "2026-11-12T12:20:00+05:30",
  "pickup_slot_end": "2026-11-12T12:25:00+05:30",
  "total_amount": 12000,
  "total_prep_units": 10,
  "notes": "No extra spicy",
  "created_at": "2026-11-12T12:16:04+05:30",
  "updated_at": "2026-11-12T12:17:10+05:30",
  "items": [
    {
      "id": "oi_1234567890ab",
      "menu_item_id": "item_1",
      "item_name": "Veg Grilled Sandwich",
      "quantity": 2,
      "unit_price": 5000,
      "prep_minutes": 4
    }
  ]
}
```

**Error:** `404 Not Found` (`order_not_found`).

---

### `POST /api/orders/{order_id}/demo-payment`

Processes a simulated demo payment state transition (`"Demo Payment — No real money is charged"`). Keeps `payment_status` strictly separate from `order.status` and prevents duplicate payments (`409 already_demo_paid`).

**Request Body:**
```json
{
  "outcome": "succeed",
  "method": "DEMO_UPI"
}
```
*(Supported `outcome`: `succeed`, `fail`, `cancel`, `switch_to_counter`.)*

**Error Responses:**
- `400 Bad Request` (`order_cancelled`, `invalid_order_id`)
- `404 Not Found` (`order_not_found`)
- `409 Conflict` (`already_demo_paid`)

---

### `POST /api/natural-order/parse`

Deterministically parses a student's plain-language request against the live SQLite `menu_items` catalog and current pickup-slot workloads (`get_kitchen_slot_workloads()`) for confirmation preview before adding items to the cart. Does **not** create an order or reserve a slot.

**Request Body:**
```json
{
  "text": "One masala dosa and two teas around 1:30 PM."
}
```

**Response `200 OK`:**
```json
{
  "original_text": "One masala dosa and two teas around 1:30 PM.",
  "matched_items": [
    {
      "menu_item_id": "item_2",
      "name": "Masala Dosa",
      "category": "Meals",
      "quantity": 1,
      "unit_price": 6500,
      "line_total": 6500,
      "prep_minutes": 6,
      "available": true,
      "is_veg": true,
      "matched_phrase": "masala dosa",
      "match_type": "exact"
    }
  ],
  "unavailable_items": [],
  "ambiguous_items": [],
  "unmatched_terms": [],
  "warnings": [],
  "requested_pickup_time": {
    "raw_text": "1:30 PM",
    "requested_time_iso": "2026-11-12T13:30:00+05:30",
    "formatted_time": "1:30 PM",
    "status": "valid_note",
    "message": "Matched pickup slot 1:30 PM – 1:35 PM (IST, 12 of 12 units open); preselected in checkout for your confirmation.",
    "matched_slot_start": "2026-11-12T13:30:00+05:30",
    "suggested_slots": []
  },
  "subtotal_paise": 10500,
  "total_prep_units": 8,
  "can_add_to_cart": true
}
```

**Notes & Error Behavior:**
- Empty/too-long input (`> 500` chars) returns `422 Unprocessable Content` (`validation_error`).
- Never invents items or prices; flags sold-out/deleted items in `unavailable_items`, multi-match phrases in `ambiguous_items`, unknown phrases/bad quantities in `unmatched_terms`, and past/closed/full pickup times via `requested_pickup_time.status` (`valid_note` | `unavailable` | `past` | `invalid`).

---

## 4. Kitchen Operations

### `GET /api/kitchen/orders`

Returns kitchen orders sorted by `pickup_slot_start ASC, created_at ASC`.

**Query Parameter:**
- `status` (string, default `active`): `active` excludes `COLLECTED` and `CANCELLED`; or pass a specific status (`PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `COLLECTED`, `CANCELLED`).

**Response `200 OK`:** Array of `OrderDetailResponse` objects (same shape as `GET /api/orders/{order_id}`).

**Error:** `400 Bad Request` (`invalid_status_filter`).

---

### `PATCH /api/kitchen/orders/{order_id}/status`

Advances an order sequentially along `PLACED → ACCEPTED → PREPARING → READY → COLLECTED`.

**Request Body:**
```json
{
  "status": "ACCEPTED"
}
```

**Response `200 OK`:** Updated `OrderDetailResponse`.

**Error Responses:**
- `400 Bad Request` (`invalid_status_transition`)
- `404 Not Found` (`order_not_found`)
- `409 Conflict` (`duplicate_status_transition`)

---

### `POST /api/kitchen/verify-pickup`

Verifies a student's one-time QR pickup token and atomically transitions a `READY` order to `COLLECTED`, releasing its slot workload once.

**Request Body:**
```json
{
  "token": "qlp_9xK2..."
}
```

**Response `200 OK`:**
```json
{
  "status": "ok",
  "verified": true,
  "message": "Pickup verified. Order Q7K2 marked as collected.",
  "order": {
    "id": "ord_a1b2c3d4e5",
    "pickup_code": "Q7K2",
    "customer_name": "Aarav Sharma",
    "status": "COLLECTED"
  }
}
```

**Error Responses:**
- `400 Bad Request` (`order_cancelled`) — order was cancelled
- `404 Not Found` (`invalid_pickup_token`) — token unknown or invalid
- `409 Conflict` (`order_not_ready`) — order is still `PLACED`, `ACCEPTED`, or `PREPARING`
- `409 Conflict` (`order_already_collected`) — order already collected (token already redeemed)
- `422 Unprocessable Content` (`validation_error`) — malformed/too-short token (including 4-char pickup codes)

---

### `GET /api/kitchen/slots`

Returns upcoming 5-minute pickup slots (plus any earlier/later slots with active orders) and real workload metrics.

**Response `200 OK`:**
```json
[
  {
    "slot_start": "2026-11-12T12:20:00+05:30",
    "slot_end": "2026-11-12T12:25:00+05:30",
    "used_units": 10,
    "capacity_units": 12,
    "remaining_units": 2,
    "active_orders": 1,
    "is_full": false,
    "is_upcoming": true,
    "is_closed": false,
    "close_reason": null
  }
]
```

---

## 5. Manager Operations (`MANAGER` Role + CSRF on Mutations)

### `GET /api/manager/staff`
Lists all `CANTEEN_STAFF` and `MANAGER` accounts ordered newest-first (no password hashes returned).

### `POST /api/manager/staff` (`201 Created`)
Provisions a `CANTEEN_STAFF` or `MANAGER` account (`full_name`, `email`, `password` enforcing 8–128 chars + letters + numbers, `role`, and `confirm_manager_grant: true` required when creating another `MANAGER`). Never permits creating `STUDENT` here (`422`).

### `PATCH /api/manager/staff/{user_id}/status`
Activates or deactivates a `CANTEEN_STAFF` / `MANAGER` account (`{ "is_active": false }`). Rejects self-deactivation (`400 cannot_deactivate_self`), revokes active SQLite sessions immediately upon deactivation, and rejects unknown IDs (`404 user_not_found`).

### `GET /api/manager/dashboard`
Returns real-time KPIs calculated in `Asia/Kolkata` (`today_date`, `today_sales_paise`, `today_orders`, `active_orders`, `completed_orders`, `cancelled_orders`, `total_menu_items`, `available_menu_items`, `unavailable_menu_items`, `current_slot`, `busiest_slot`). Finalized sales count `COLLECTED` orders only.

### `GET /api/manager/menu`
Returns all non-deleted menu items (both available and sold out).

### `POST /api/manager/menu` (`201 Created`)
Creates a new menu item (`name`, `description`, `category` in `Meals|Fast Food|Snacks|Beverages`, positive integer `price` in paise, positive integer `prep_minutes`, optional safe `image_url`, `is_veg`, `available`).

### `PUT /api/manager/menu/{item_id}`
Updates an existing menu item without altering historical `order_items` snapshots. Returns `404 menu_item_not_found` if unknown or soft-deleted.

### `PATCH /api/manager/menu/{item_id}/availability`
Request: `{ "available": false }`. Toggles availability immediately reflected on `GET /api/menu` and `POST /api/orders`.

### `DELETE /api/manager/menu/{item_id}`
Soft-deletes (`is_deleted = 1, available = 0`) the item so historical order snapshots and foreign keys remain intact.

### `GET /api/manager/orders`
Query parameters: `status` (`all`, `active`, `completed`, `cancelled`, or specific `OrderStatus`), `date` (`YYYY-MM-DD` in `Asia/Kolkata`), `search` (matches order ID, pickup code, or customer name).

### `GET /api/manager/sales`
Returns `today_sales_paise`, `total_collected_orders`, `total_collected_revenue_paise`, `average_order_value_paise`, `daily_sales` (7-day IST buckets), and `top_items` across `COLLECTED` orders only (excluding `CANCELLED` and in-progress orders).

### `GET /api/manager/slots`
Returns `{ slot_capacity_units, slot_duration_minutes, slots }`.

### `PATCH /api/manager/settings/capacity`
Request: `{ "slot_capacity_units": 10 }` (`1..100`). Persists in SQLite `canteen_settings` without changing existing order slots.

### `PATCH /api/manager/slots/status`
Request: `{ "slot_start": "2026-11-12T12:50:00+05:30", "is_closed": true, "reason": "Equipment cleaning" }`. Closes or reopens a 5-minute slot without modifying existing orders.

---

## 6. Hackathon Demo Reset (Non-Production Only)

### `POST /api/demo/reset` *(Requires `MANAGER` + CSRF, Non-Production Only)*

Deletes all rows in `order_items` and `orders` inside an atomic SQLite transaction while preserving seeded `menu_items`, `users`, and `sessions`.

**Response `200 OK`:**
```json
{
  "status": "ok",
  "deleted_orders": 2,
  "deleted_order_items": 3,
  "available_menu_items": 11,
  "message": "Demo reset complete. Removed 2 orders and restored a clean queue with 11 available menu items."
}
```

**Error:** `403 Forbidden` (`demo_reset_disabled`) when `ENABLE_DEMO_RESET=false` or `ENVIRONMENT=production`.

