# QUEUELESS — System Architecture

## 1. High-Level Architecture

QUEUELESS follows a clean three-tier local web architecture:

1. **Presentation Layer (`frontend/`):** React 19 + TypeScript single-page application built with Vite and Tailwind CSS v4. Provides a unified `AppShell` switching between **Student** (`StudentPage`, `OrderTrackingPage`), **Kitchen** (`KitchenPage`), and **Manager** (`ManagerPage`) workspaces.
2. **Application & Scheduling Layer (`backend/app/`):** Python FastAPI service enforcing request validation (`schemas.py`), core/kitchen/demo logic (`models.py`), manager analytics & menu CRUD (`manager_service.py`), and deterministic pickup-slot scheduling (`allocator.py`).
3. **Persistence Layer (`SQLite`):** Local SQLite database configured with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) and foreign-key enforcement (`PRAGMA foreign_keys = ON`). Safe additive migrations in `init_db()` upgrade existing databases without dropping data.

---

## 2. Frontend / Backend Communication

- All HTTP communication is centralized in `frontend/src/api/client.ts` using `VITE_API_BASE_URL` (default `http://localhost:8000`).
- FastAPI configures `CORSMiddleware` from `CORS_ORIGINS` (`http://localhost:5173,http://127.0.0.1:5173`).
- Standardized error envelopes (`{"error": "...", "message": "..."}`) are returned for HTTP, validation, and database errors and parsed into `ApiClientError` instances on the frontend.
- Prices are stored and transmitted as **integer paise** (e.g., `₹50` = `5000`) to avoid floating-point rounding drift.
- **Live updates:** Both `OrderTrackingPage` and `KitchenPage` poll the backend every **4 seconds** with in-flight request guards (`inFlightRef`) and interval cleanup on unmount.

---

## 3. Database Design

Defined in `backend/app/database.py`:

### `menu_items`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key (e.g., `item_1`) |
| `name` | `TEXT` | Dish display name |
| `description` | `TEXT` | Short description |
| `category` | `TEXT` | `Meals`, `Fast Food`, `Snacks`, `Beverages` |
| `price` | `INTEGER` | Non-negative integer paise |
| `prep_minutes` | `INTEGER` | Positive preparation effort unit (`> 0`) |
| `available` | `INTEGER` | `1` (available) or `0` (unavailable) |
| `is_veg` | `INTEGER` | `1` (Vegetarian) or `0` (Non-Vegetarian) |
| `is_deleted` | `INTEGER` | `1` (soft-deleted/archived) or `0` (active catalog item) |
| `image_url` | `TEXT` | Local path under `/images/menu/...` or `http(s)://` URL |

### `canteen_settings`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `key` | `TEXT` | Primary key (e.g., `slot_capacity_units`) |
| `value` | `TEXT` | Persisted setting value |
| `updated_at` | `TEXT` | ISO-8601 timestamp |

### `closed_slots`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `slot_start` | `TEXT` | Primary key (`YYYY-MM-DDTHH:MM:00+05:30`) |
| `reason` | `TEXT` | Optional manager closure note |
| `closed_at` | `TEXT` | ISO-8601 timestamp |

### `orders`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key (`ord_<hex>`) |
| `pickup_code` | `TEXT` | Unique 4-char unambiguous token (e.g., `Q7K2`) |
| `customer_name` | `TEXT` | Student display name |
| `status` | `TEXT` | `PLACED`, `ACCEPTED`, `PREPARING`, `READY`, `COLLECTED`, `CANCELLED` |
| `pickup_slot_start` | `TEXT` | ISO-8601 timestamp with local offset |
| `pickup_slot_end` | `TEXT` | ISO-8601 timestamp with local offset |
| `total_amount` | `INTEGER` | Server-calculated total in paise |
| `total_prep_units` | `INTEGER` | Sum of `prep_minutes * quantity` |
| `notes` | `TEXT` | Optional kitchen instructions |
| `created_at` | `TEXT` | ISO-8601 timestamp |
| `updated_at` | `TEXT` | ISO-8601 timestamp |

### `order_items`
| Column | Type | Constraints / Notes |
| --- | --- | --- |
| `id` | `TEXT` | Primary key (`oi_<hex>`) |
| `order_id` | `TEXT` | FK → `orders.id` (`ON DELETE CASCADE`) |
| `menu_item_id` | `TEXT` | FK → `menu_items.id` |
| `item_name` | `TEXT` | Snapshotted dish name |
| `quantity` | `INTEGER` | Positive integer (`> 0`) |
| `unit_price` | `INTEGER` | Snapshotted price in paise |
| `prep_minutes` | `INTEGER` | Snapshotted prep estimate |

---

## 4. Order Lifecycle

```text
PLACED ──► ACCEPTED ──► PREPARING ──► READY ──► COLLECTED
  │            │            │           │            │
  └────────────┴────────────┴───────────┘            │
        Consumes pickup-slot workload        Releases slot workload
```

Valid transitions are enforced server-side in `backend/app/models.py` (`ALLOWED_STATUS_TRANSITIONS`) inside `write_transaction()`.

---

## 5. Capacity-Aware Pickup-Slot Allocation Algorithm

Implemented in `backend/app/allocator.py`:

1. **Atomic Serialization:** Every order placement runs inside `write_transaction()`, acquiring both a process-level `threading.Lock` (`_WRITE_LOCK`) and a SQLite `BEGIN IMMEDIATE` write lock so concurrent requests cannot double-book a slot.
2. **Database-Backed Capacity & Closed Slots:** `get_effective_slot_capacity()` reads `canteen_settings` (falling back to `SLOT_CAPACITY_UNITS`), and `get_closed_slots_map()` reads `closed_slots`.
3. **Slot Grid:** `align_to_slot_start()` rounds the reference timestamp up to the next `SLOT_DURATION_MINUTES` (5-minute) boundary.
4. **Active Workload Query:** `get_active_slot_workloads()` aggregates `total_prep_units` from all orders whose status is not `COLLECTED` or `CANCELLED`.
5. **Allocation Rule:**
   - Closed slots (`candidate_start in closed_slots`) are skipped unconditionally; existing orders already assigned to a closed slot remain untouched.
   - Standard orders ($\text{workload} \le C$, default $C = 12$): take the earliest open slot where $\text{prior\_units} + \text{workload} \le C$.
   - Oversized orders ($C < \text{workload} \le 3C$): require an empty open slot ($\text{prior\_units} = 0$) and return a dedicated-window explanation message.
   - Extreme batches ($\text{workload} > 3C$): rejected (`400 order_too_large`) so kitchen batches remain bounded.
   - If all slots in a 2-hour horizon (`MAX_EXTENSION_SLOTS = 24`) are closed or occupied, returns `409 kitchen_full`.

