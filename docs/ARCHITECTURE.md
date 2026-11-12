# QUEUELESS — System Architecture

## 1. High-Level Architecture

QUEUELESS follows a clean three-tier local web architecture:

1. **Presentation Layer (`frontend/`):** React 19 + TypeScript single-page application built with Vite and Tailwind CSS v4. Provides URL-guarded routes (`/`, `/login`, `/register`, `/student`, `/kitchen`, `/manager`, `/profile`, `/unauthorized`) and role-filtered navigation in `AppShell`.
2. **Application, Auth & Scheduling Layer (`backend/app/`):** Python FastAPI service enforcing Argon2id hashing + `HttpOnly` cookie sessions (`security.py`, `auth_service.py`, `auth_deps.py`), strict RBAC & CSRF guards, request validation (`schemas.py`), core/kitchen/demo logic (`models.py`), manager analytics & menu CRUD (`manager_service.py`), and deterministic pickup-slot scheduling (`allocator.py`).
3. **Persistence Layer (`SQLite`):** Local SQLite database configured with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) and foreign-key enforcement (`PRAGMA foreign_keys = ON`). Safe additive migrations in `init_db()` upgrade existing databases without dropping data (`users`, `sessions`, `orders.user_id`, etc.).

---

## 2. Frontend / Backend Communication

- All HTTP communication is centralized in `frontend/src/api/client.ts` using `VITE_API_BASE_URL` (default `http://localhost:8000`) with `credentials: 'include'` so browser requests send the `HttpOnly` session cookie.
- FastAPI configures `CORSMiddleware` with `allow_credentials=True` for explicit trusted `CORS_ORIGINS` (`http://localhost:5173,http://127.0.0.1:5173`).
- `csrf_token` is held strictly in JavaScript memory (`activeCsrfToken`, never `localStorage`) and attached as `X-CSRF-Token` on authenticated mutations. Any `401` response clears in-memory auth and browser-local student order/QR tokens and redirects to `/login`.
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
| `pickup_token_hash` | `TEXT` | Unique SHA-256 hex digest of one-time pickup QR token (nullable for legacy rows) |
| `pickup_token_used_at` | `TEXT` | ISO-8601 timestamp recorded upon collection (QR or manual) |
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

---

## 6. QR Code Generation & Pickup Verification Security

1. **Order Placement:** `create_order()` generates `qlp_<secrets.token_urlsafe(24)>` inside `write_transaction()`, hashes it with SHA-256 (`pickup_token_hash`), saves only the hash in `orders`, and returns `pickup_token` once to the client.
2. **Student Persistence & Rendering:** The frontend stores `order_id -> pickup_token` in `localStorage` so refreshing/reopening tracking re-renders the same QR code locally via `qrcode`. `GET /api/orders/{id}`, `GET /api/kitchen/orders`, and `GET /api/manager/orders` never return raw or hashed tokens.
3. **Atomic Verification:** `POST /api/kitchen/verify-pickup` hashes the submitted token, locates the order inside `write_transaction()`, validates the hash via `hmac.compare_digest()`, verifies `status == 'READY'` and `pickup_token_used_at IS NULL`, and calls the shared `_apply_status_transition_in_tx(..., 'COLLECTED')` helper so capacity is released once and concurrent duplicate scans fail with `409 order_already_collected`.
4. **Camera & Fallback:** `KitchenQrScannerModal` scans via `jsqr` on a `<canvas>` fed by `navigator.mediaDevices.getUserMedia` (rear camera default, stopped immediately on close/unmount), with a 3-second duplicate-scan cooldown and manual token paste fallback. Camera access requires HTTPS outside `localhost`.

---

## 7. Plain-Language Order Parsing Architecture

1. **Authoritative Backend Parser:** `POST /api/natural-order/parse` delegates to `backend/app/natural_order.py` (`parse_natural_order()`), querying live SQLite `menu_items` (`available`, `unavailable`, and `is_deleted`) and current `get_kitchen_slot_workloads()` in `Asia/Kolkata`. No paid external API or second pickup-slot allocator is created.
2. **Matching & Safety Rules:** Extracts optional pickup time phrases (`around 1:30 PM`, `at 14:15`, etc.), splits multi-item clauses (`and`, `,`, `&`, `;`, newlines), parses digit/number-word quantities (`1..20`, flagging `<= 0`, fractional, or `> 20`), and resolves names via exact, controlled synonym, and bounded fuzzy matching. Sold-out/deleted, ambiguous, or unknown phrases are never substituted silently.
3. **Preview & Checkout Reuse:** `NaturalOrderPanel` displays a structured confirmation preview (**Edit Request**, **Cancel**, quantity adjustment, ambiguous candidate buttons, and **Confirm & Add to Cart**) before calling `mergeParsedItemsIntoCart()` and passing `requested_pickup_time` (`matched_slot_start` when feasible, or an explanation banner when unavailable) into checkout's `PickupSlotSelector`.

---

## 8. Student Pickup-Slot Selection Architecture

1. **Unified Capacity & Closure Source of Truth:** `list_available_pickup_slots()` in `backend/app/allocator.py` shares the exact same `get_effective_slot_capacity()`, `get_closed_slots_map()`, `get_active_slot_workloads()`, and `is_slot_feasible_for_workload()` helpers used by `allocate_pickup_slot()` and manager/kitchen views.
2. **Exact-Slot Reservation Without Silent Reassignment:** When `CreateOrderRequest.requested_pickup_slot_start` is sent to `POST /api/orders`, `_normalize_slot_timestamp()` parses ISO timestamps into `Asia/Kolkata`, verifies 5-minute grid alignment, bookable horizon, closure state, and live workload inside `write_transaction()`. Conflicts return HTTP `409`/`400` instead of moving the student silently.
3. **Frontend Selector & Natural-Language Preselection:** `PickupSlotSelector` renders inside `CartPanel`, defaulting to the earliest feasible window (`recommended_slot_start`), allowing manual selection across upcoming windows (`Available`, `Limited availability`, `Full`, `Closed`), preselecting valid NL-matched times, and surfacing clear conflict notices + slot refresh on concurrent full/closed transitions.

---

## 9. Dietary Safety, Order Ownership & Simulated Demo Payment Architecture

1. **Dietary & Allergen Metadata:** `menu_items` stores manager-maintained `is_veg`, `is_vegan`, `is_jain`, and optional `allergen_info`. Unverified values are never inferred or advertised as `"allergen-free"` (`"Not listed — confirm at counter"` when blank).
2. **Sanitized Special Instructions:** `CreateOrderRequest` strips ASCII control characters from `customer_name` and `notes` (`max_length=300`) while preserving instructions end-to-end across confirmation, tracking, kitchen cards, and manager orders with explicit non-guarantee disclaimers.
3. **Student Order Ownership & History:** Every student order persists `orders.user_id` referencing `users.id`. `GET /api/orders/mine` lists only the authenticated student's orders, and `GET /api/orders/{order_id}` / `POST /api/orders/{order_id}/demo-payment` enforce `order.user_id == current_user.id` (returning `404` for unauthorized or legacy unowned orders).
4. **Simulated Demo Payment State Machine:** `POST /api/orders/{order_id}/demo-payment` transitions unpaid orders (`PENDING`, `DEMO_FAILED`, `DEMO_CANCELLED`, `PAY_AT_COUNTER`) atomically inside `write_transaction()`, enforces `409 already_demo_paid` against duplicate clicks, never requests real PINs/cards/credentials, and isolates `payment_status` from `order.status`.

---

## 10. Authentication, Sessions & Role-Based Access Control (Phase 10.1)

1. **`users` & `sessions` Tables:** Passwords use Argon2id (`argon2-cffi`); sessions generate `qls_<secrets.token_urlsafe(32)>` stored strictly as a SHA-256 hex digest (`session_token_hash`) paired with `csrf_token`, `expires_at`, and `revoked_at`.
2. **Defense Against Privilege Escalation & CSRF:** `StudentRegisterRequest` forbids `role` via Pydantic `extra="forbid"` and creates only `STUDENT`. Every state-changing authenticated route depends on `require_csrf`, validating `X-CSRF-Token` (`hmac.compare_digest`) plus trusted `Origin`/`Referer`.
3. **Initial Manager Bootstrap:** `python -m app.bootstrap_manager` provisions the first `MANAGER` via CLI flags, interactive hidden `getpass` prompt, or environment variables—never hardcoded credentials. Further staff/managers are created exclusively via `/api/manager/staff`.




