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

## 3. Orders

### `POST /api/orders`

Validates menu items and quantities, computes total price in paise server-side, assigns an atomic capacity-aware pickup slot, and persists the order.

**Request Body:**
```json
{
  "customer_name": "Aarav Sharma",
  "items": [
    { "menu_item_id": "item_1", "quantity": 2 },
    { "menu_item_id": "item_9", "quantity": 1 }
  ],
  "notes": "No extra spicy"
}
```

**Response `201 Created`:**
```json
{
  "id": "ord_a1b2c3d4e5",
  "pickup_code": "Q7K2",
  "status": "PLACED",
  "pickup_slot_start": "2026-11-12T12:20:00+05:30",
  "pickup_slot_end": "2026-11-12T12:25:00+05:30",
  "total_amount": 12000,
  "message": "Order placed. Please arrive during your pickup window."
}
```

**Error Responses:**
- `400 Bad Request` (`unknown_menu_item`, `unavailable_menu_item`, `order_too_large`)
- `409 Conflict` (`kitchen_full`)
- `422 Unprocessable Content` (`validation_error`, e.g. blank name, empty items, quantity `<= 0`)

---

### `GET /api/orders/{order_id}`

Returns full order details, snapshotted items, pickup window, and live status for student tracking.

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

## 5. Manager Operations (Demo Prototype Access — Requires Auth in Production)

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

### `POST /api/demo/reset`

Deletes all rows in `order_items` and `orders` inside an atomic SQLite transaction while preserving seeded `menu_items`.

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

