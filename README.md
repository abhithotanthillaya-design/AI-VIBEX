# QUEUELESS

Campus canteen pre-ordering and capacity-aware pickup-slot management web application.

---

## 1. Project Overview

**QUEUELESS** coordinates campus canteen pre-orders between students and kitchen staff through a shared FastAPI + SQLite backend. Instead of allowing unbounded simultaneous orders to flood the pickup counter, QUEUELESS calculates each order's preparation workload and assigns an earliest feasible 5-minute pickup window within configurable kitchen capacity.

> **Important technical note:** Pickup-slot allocation is a **deterministic, explainable, capacity-aware scheduling algorithm**—not machine learning or AI prediction.

---

## 2. Problem Statement

- **Student bottleneck:** During peak lunch and break rushes, students wait in long canteen queues and risk arriving late to classes.
- **Kitchen overload:** Canteen staff receive sudden bursts of unscheduled orders, leading to counter crowding, missed notes, and unpredictable preparation delays.

---

## 3. Solution Explanation

QUEUELESS connects three focused web interfaces:

1. **Student Experience:** Browse live available menu items (with Veg/Non-Veg indicators), search and filter by category, build a cart, enter student name and kitchen notes, receive a server-verified total, unique pickup code, and capacity-assigned 5-minute pickup window, and track live preparation progress.
2. **Kitchen Operations Dashboard:** Monitor live 5-minute pickup slot capacities, view incoming active orders grouped by pickup window, advance orders sequentially (`PLACED → ACCEPTED → PREPARING → READY → COLLECTED`), and reset demo data safely between presentations.
3. **Manager Console (Demo Prototype Access):** View real-time KPIs in `Asia/Kolkata`, perform full menu CRUD (add, edit, toggle sold-out, soft-delete preserving historical order snapshots), filter/inspect all orders, review 7-day finalized sales and top items, and adjust DB-backed slot capacity or close/reopen pickup windows.

---

## 4. Key Features

- **Student Menu & Dietary Safety:** Live menu catalog seeded in SQLite with local Indian canteen food photography, category filters (`Meals`, `Fast Food`, `Snacks`, `Beverages`), dietary filters (`Veg`, `Vegan`, `Jain-Friendly`, `Non-Veg`), and manager-verified allergen disclosure (`"Not listed — confirm at counter"` when unverified).
- **Order in Your Own Words (Phase 8):** Local deterministic plain-language parser (`POST /api/natural-order/parse`) matching live SQLite items/prices with confirmation preview and optional pickup-time matching before adding to cart.
- **Cart, Special Instructions & Simulated Demo Payment:** Sanitized preparation/allergy instructions (max 300 chars, with non-guarantee counter notice), clearly labelled simulated payment methods (`Cash at Counter` / `Demo UPI` with no real money charged), duplicate-submission prevention, and server-side paise calculation.
- **Capacity-Aware Slot Selection & Allocation (Phase 9):** Chronological upcoming 5-minute pickup-slot selector (`Available`, `Limited availability`, `Full`, `Closed`) plus atomic SQLite transaction locking (`BEGIN IMMEDIATE` + `_WRITE_LOCK`) without silent slot shifting.
- **QR & Pickup Code Tracking + Order History:** One-time cryptographic QR pickup token + 4-character pickup code, 5-stage live tracking timeline (4s polling), and honest browser-local Order History with individual backend `GET /api/orders/{order_id}` sync and manual Order ID lookup (no open list endpoint).
- **Kitchen Operations Dashboard:** Live slot-grouped queue, Special Instructions visibility, sequential status updates, camera + manual QR verification (`POST /api/kitchen/verify-pickup`), slot workload meters, and guarded Demo Reset.
- **Manager Console (Demo Prototype Access):** Real-time operational KPIs (`Asia/Kolkata`), full menu CRUD with dietary & allergen fields, snapshot-safe soft deletion, order oversight, collected-only 7-day sales summary, and DB-backed slot capacity/closure controls.

---

## 5. Architecture

```text
Student Web App (React + TypeScript + Vite + Tailwind CSS v4)
  ├── Menu Catalog, Search & Category Filters
  ├── Cart & Checkout Form
  ├── Order Confirmation Receipt
  └── Live Order Tracking (4s polling)
          │
          │ REST / JSON (CORS)
          ▼
FastAPI Backend (Python)
  ├── /api/health               -> Readiness & SQLite check
  ├── /api/menu                 -> Available menu items
  ├── /api/orders               -> Validation, server pricing, slot allocation
  ├── /api/orders/{order_id}    -> Student live tracking lookup
  ├── /api/kitchen/orders       -> Active/filtered queue sorted by slot
  ├── /api/kitchen/orders/{id}/status -> Validated status progression
  ├── /api/kitchen/slots        -> Slot capacity & active load metrics
  └── /api/demo/reset           -> Transactional demo reset (non-production)
          ▲
          │ REST / JSON (4s polling)
Kitchen Dashboard (React + TypeScript + Vite + Tailwind CSS v4)
  ├── Status Summary Cards
  ├── Pickup Slot Capacity Meters
  ├── Slot-Grouped Ticket Queue & Next-Action Controls
  └── Confirmation Modals (Collection & Demo Reset)
```

Detailed diagrams and lifecycle flows are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 6. Technology Stack

| Layer | Choice | Purpose |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite | Fast modular UI and strict type safety |
| Styling & Icons | Tailwind CSS v4, Lucide React | Consistent design tokens and crisp iconography |
| Backend | Python 3.13, FastAPI, Pydantic v2 | Typed REST endpoints and request/response validation |
| Database | SQLite (WAL mode) | Zero-setup persistent storage with `BEGIN IMMEDIATE` transactions |
| Live Sync | Periodic HTTP polling (4s) | Simple, reliable updates without WebSocket complexity |
| Testing | `pytest`, `httpx`, Node `node:test`, `oxlint`, `tsc` | Backend API/concurrency tests and frontend logic/lint/build checks |

---

## 7. Folder Structure

```text
AI-VIBEX/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app, lifespan seeding, CORS, error handlers
│   │   ├── config.py            # Environment-backed Settings via pydantic-settings
│   │   ├── database.py          # SQLite WAL connections, write_transaction, init_db
│   │   ├── schemas.py           # Pydantic request/response contracts
│   │   ├── seed.py              # Idempotent canteen menu seeding (12 items)
│   │   ├── allocator.py         # Deterministic capacity-aware pickup-slot scheduler
│   │   ├── models.py            # DB queries, order creation, transitions, demo reset
│   │   └── routes/
│   │       ├── health.py        # GET /api/health
│   │       ├── menu.py          # GET /api/menu
│   │       ├── orders.py        # POST /api/orders, GET /api/orders/{order_id}
│   │       ├── kitchen.py       # Kitchen queue, status updates, slot workload
│   │       └── demo.py          # POST /api/demo/reset
│   ├── tests/                   # Backend pytest suites
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── public/images/menu/      # Local food photography for seeded dishes
│   ├── src/
│   │   ├── api/client.ts        # Centralized fetch API client
│   │   ├── components/          # Modular cards, filters, timeline, modals, layout
│   │   ├── pages/               # StudentPage, OrderTrackingPage, KitchenPage
│   │   ├── types/index.ts       # Shared TypeScript interfaces
│   │   └── utils/               # Cart math, currency/time formatting, kitchen & reset helpers
│   ├── tests/                   # Frontend Node unit tests
│   ├── .env.example
│   └── package.json
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── DEMO_SCRIPT.md
│   └── PROJECT_OVERVIEW.md
└── README.md
```

---

## 8. Installation & Startup Instructions

### Prerequisites

- **Python:** 3.11+ (tested on Python 3.13.7)
- **Node.js:** 20+ (tested on Node v24.11.1)

### Backend Setup & Startup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
copy .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- Health check: `http://127.0.0.1:8000/api/health`
- Interactive OpenAPI docs: `http://127.0.0.1:8000/docs`

### Frontend Setup & Startup

```powershell
cd frontend
npm.cmd install
copy .env.example .env
npm.cmd run dev
```

*(Use `npm install` / `npm run dev` on macOS/Linux, or `npm.cmd` on Windows PowerShell if `.ps1` script execution is restricted.)*

- Web app URL: `http://localhost:5173`

---

## 9. Environment Configuration

### Backend (`backend/.env.example`)

| Variable | Default | Description |
| --- | --- | --- |
| `APP_NAME` | `QUEUELESS API` | Service display name |
| `ENVIRONMENT` | `development` | Set to `production` to disable demo reset |
| `DATABASE_PATH` | `./queueless.db` | SQLite database file path |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed frontend origins |
| `TIMEZONE` | `Asia/Kolkata` | Local timezone used for slot windows |
| `SLOT_DURATION_MINUTES` | `5` | Duration of each pickup window |
| `SLOT_CAPACITY_UNITS` | `12` | Max preparation workload units per standard slot |
| `SLOT_LOOKAHEAD_MINUTES` | `45` | Default lookahead window shown in kitchen slots |
| `ENABLE_DEMO_RESET` | `true` | Enables `POST /api/demo/reset` when non-production |

### Frontend (`frontend/.env.example`)

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |

---

## 10. API Endpoint Summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service and SQLite connectivity check |
| `GET` | `/api/menu` | List available menu items (`category`, `dietary`, `search`, `include_unavailable`) |
| `GET` | `/api/slots/available` | List chronological upcoming pickup slots (`workload_units` feasibility) |
| `POST` | `/api/natural-order/parse` | Parse plain-language text against live SQLite menu & slots for preview |
| `POST` | `/api/orders` | Validate items, notes, payment method, optional slot, reserve atomically |
| `POST` | `/api/orders/{order_id}/demo-payment` | Process simulated Demo UPI / Counter Cash state transition (demo only) |
| `GET` | `/api/orders/{order_id}` | Fetch live order status, items, pickup code, and pickup window |
| `GET` | `/api/kitchen/orders` | List kitchen orders (`status=active` default or specific status) |
| `PATCH` | `/api/kitchen/orders/{order_id}/status` | Advance order (`PLACED → ACCEPTED → PREPARING → READY → COLLECTED`) |
| `POST` | `/api/kitchen/verify-pickup` | Verify one-time QR pickup token and atomically collect a `READY` order |
| `GET` | `/api/kitchen/slots` | List upcoming and active pickup slots with occupied/remaining units and closure status |
| `GET` | `/api/manager/dashboard` | Real-time manager KPIs in `Asia/Kolkata` timezone |
| `GET` | `/api/manager/menu` | List all non-deleted menu items (available and sold out) |
| `POST` | `/api/manager/menu` | Create a new menu item (paise price, Veg/Non-Veg, category validation) |
| `PUT` | `/api/manager/menu/{item_id}` | Edit a menu item without changing historical order snapshots |
| `PATCH` | `/api/manager/menu/{item_id}/availability` | Mark an item available or sold out |
| `DELETE` | `/api/manager/menu/{item_id}` | Soft-delete/archive a menu item while keeping order history intact |
| `GET` | `/api/manager/orders` | List/filter/search all orders (status, `YYYY-MM-DD` date, ID/code/name) |
| `GET` | `/api/manager/sales` | Finalized 7-day sales & top items (collected orders only) |
| `GET` | `/api/manager/slots` | Current capacity settings and upcoming/active slot controls |
| `PATCH` | `/api/manager/settings/capacity` | Persist updated default slot capacity in SQLite |
| `PATCH` | `/api/manager/slots/status` | Close or reopen a 5-minute pickup slot |
| `POST` | `/api/demo/reset` | Clear demo orders/items transactionally while preserving menu (demo mode only) |

Full request/response contracts and error payloads are documented in [docs/API.md](docs/API.md).

---

## 11. Database Explanation

SQLite (`queueless.db`, WAL mode, foreign keys enabled) stores five core tables with idempotent additive migrations:

- `menu_items`: Catalog items with integer `price` (in paise), `prep_minutes` workload estimate, `available`, `is_veg`, `is_vegan`, `is_jain`, manager-verified `allergen_info`, soft-delete flag `is_deleted`, category, and `image_url`.
- `orders`: Order metadata including unique `pickup_code`, `customer_name`, `status`, `pickup_slot_start`, `pickup_slot_end`, server-calculated `total_amount` (paise), `total_prep_units`, sanitized `notes`, simulated `payment_method`/`payment_status`/`payment_reference`, SHA-256 `pickup_token_hash` & `pickup_token_used_at`, `created_at`, and `updated_at`.
- `order_items`: Snapshotted line items (`item_name`, `quantity`, `unit_price`, `prep_minutes`) referencing `orders.id` (`ON DELETE CASCADE`) and `menu_items.id`.
- `canteen_settings` & `closed_slots`: Manager-configured slot capacity (`slot_capacity_units`) and closed pickup windows.

Slot workload is derived transactionally from active rows in `orders` (`status NOT IN ('COLLECTED', 'CANCELLED')`) so slot capacity never drifts out of sync with order states.

---

## 12. Pickup-Slot Allocation Algorithm

Implemented in [backend/app/allocator.py](backend/app/allocator.py):

1. Align the current timestamp up to the nearest `SLOT_DURATION_MINUTES` (5-minute) boundary.
2. Compute the incoming order's workload: $\sum (\text{prep\_minutes} \times \text{quantity})$.
3. Aggregate active workload per slot across all non-`COLLECTED`, non-`CANCELLED` orders inside a serialized write transaction (`_WRITE_LOCK` + SQLite `BEGIN IMMEDIATE`).
4. For standard orders ($\text{workload} \le 12$ units), select the earliest slot where $\text{current\_workload} + \text{new\_workload} \le 12$. Full slots automatically overflow to later windows.
5. For larger orders ($13$–$36$ units), require an empty slot ($\text{current\_workload} = 0$) so active slots are never overbooked, and clearly note the dedicated window in the confirmation message. Orders above $36$ units are rejected (`400 order_too_large`).

This is a **deterministic, explainable capacity-aware scheduling rule**, not machine learning.

---

## 13. Testing Instructions

```powershell
# Backend API, allocator, concurrency, manager, and reset suite
cd backend
.\.venv\Scripts\python.exe -m pytest -v

# Frontend TypeScript check, production build, lint, and unit tests
cd ..\frontend
npm.cmd run build
npm.cmd run lint
node --test tests/cart.test.ts tests/kitchen.test.ts tests/demo_reset.test.ts tests/manager.test.ts tests/qr.test.ts tests/natural_order.test.ts tests/slot_selection.test.ts tests/phase10.test.ts
```

---

## 14. QR Pickup Verification & Security

- **Token generation & storage:** Each new order receives a cryptographically random bearer token (`secrets.token_urlsafe(24)` prefixed with `qlp_`). Only its SHA-256 hex digest (`pickup_token_hash`) is stored in SQLite (`orders`); raw tokens are returned once in `POST /api/orders`, persisted client-side in `localStorage` for tracking page refreshes, and never exposed in `GET /api/kitchen/orders`, `GET /api/manager/orders`, or `GET /api/orders/{order_id}`.
- **QR rendering & fallback:** `PickupQrCard` renders the token locally using `qrcode` (zero external network calls) with an enlarge modal. If a token is unavailable in the browser session or QR rendering fails, the student's 4-character `pickup_code` and `order_id` remain visible with a **Retry QR** action.
- **Kitchen scanner & camera permissions:** `KitchenQrScannerModal` uses `jsqr` + `navigator.mediaDevices.getUserMedia` (defaulting to the rear camera `{ facingMode: { ideal: 'environment' } }`), requests camera access only when opened, stops all camera tracks immediately on close/unmount, prevents rapid duplicate scans with a 3-second cooldown, and includes a **Manual Token Fallback** input calling `POST /api/kitchen/verify-pickup`.
- **HTTPS note:** Browser camera access (`getUserMedia`) works on `http://localhost` / `http://127.0.0.1` and requires **HTTPS** when served over a LAN or public hostname.
- **Production auth requirement:** Kitchen and Manager endpoints are open in hackathon demo mode and require authentication and role-based authorization before production deployment.

---

## 15. Plain-Language / Natural-Language Ordering

- **Deterministic backend parsing:** `POST /api/natural-order/parse` (`backend/app/natural_order.py`) splits student requests into food clauses and an optional pickup time note, matching only against live SQLite `menu_items` (available, unavailable, and soft-deleted) using exact matching, controlled canteen synonyms (e.g. `tea` → `Masala Chai`), and bounded fuzzy matching.
- **Zero invented items or unsafe substitutions:** Sold-out, soft-deleted, unknown, invalid-quantity (`<= 0`, fractional, or `> 20`), or ambiguous phrases (e.g. generic `"masala"`) are surfaced clearly instead of being guessed or silently replaced.
- **Confirmation before cart & slot preselection:** Students preview matched items, adjust quantities, resolve ambiguous candidates from clickable options, and preselect a matching valid pickup window in Cart (`matched_slot_start` or clear unavailability explanation) before confirming checkout via `POST /api/orders`.

---

## 16. Student Pickup-Slot Selection

- **Live slot selector (`PickupSlotSelector`):** Checkout fetches `GET /api/slots/available?workload_units=<units>` in `Asia/Kolkata`, displaying upcoming 5-minute windows chronologically with remaining workload and badges (`Available`, `Limited availability`, `Full`, `Closed`, `Not enough space`).
- **Default & explicit selection:** Defaults to the earliest feasible window while allowing students to choose any open feasible window manually (or via Phase 8 natural-language time preselection).
- **Atomic backend validation & no silent shifting:** `POST /api/orders` accepts optional `requested_pickup_slot_start` and validates capacity, closure status, and horizon inside the serialized SQLite transaction (`_WRITE_LOCK` + `BEGIN IMMEDIATE`). If the selected slot became full, closed, or too small before submission, checkout rejects with HTTP `409`/`400`, explains why, and refreshes available slots instead of silently reassigning another slot.

---

## 17. Demo Workflow

Follow [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for a 3-minute judge walkthrough covering:
1. Clean queue verification (or **Reset Demo** in Kitchen).
2. Student placing Order 1 (via menu cards or **Order in your own words** confirmation preview + slot selection, 10 prep units) → assigned/reserved slot.
3. Student placing Order 2 (6 prep units) → overflows to next 5-minute slot (`10 + 6 > 12`).
4. Kitchen accepting, preparing, marking ready, and confirming collection while Student Tracking updates automatically and slot capacity resets to `0 / 12`.

---

## 18. Security & Known Limitations

- **No authentication / RBAC (Demo Prototype Access):** Kitchen (`/api/kitchen/*`) and Manager (`/api/manager/*`) routes are unauthenticated in hackathon demo mode, and student order history relies on browser `localStorage` Order ID references plus manual Order ID lookup (`GET /api/orders/{order_id}`) with **no open order-listing endpoint** for students. Production deployment requires institutional auth (SSO/JWT), role-based authorization, and customer ownership checks.
- **Simulated Payment Only:** `Demo UPI` and `Cash at Counter` are strictly simulated demo controls (`"Demo Payment — No real money is charged"`). No real UPI PINs, card numbers, banking credentials, or payment gateways are collected or integrated.
- **Dietary & Allergy Disclaimer:** Vegan, Jain-friendly, and allergen fields show only manager-entered values (`"Not listed — confirm at counter"` when blank). Special instructions (`notes`) are preparation requests, not a guarantee of allergen-free preparation.
- **QR & HTTPS Constraints:** Raw `pickup_token` is returned only at creation time (`localStorage`-persisted for student refresh; SQLite holds SHA-256 hash only). Device camera scanning via `getUserMedia` requires HTTPS outside `localhost`/`127.0.0.1`; manual token entry and manual counter collection remain fallbacks.
- **Plain-language parser boundaries:** Runs a local deterministic phrase/synonym/fuzzy parser rather than an external LLM. Complex multi-clause grammar or slang outside the live menu & synonym table is flagged as unmatched for manual selection, and natural-language pickup time preselection remains constrained to the 2-hour (`MAX_EXTENSION_SLOTS = 24`) bookable window and requires checkout confirmation.
- **Single-canteen & polling prototype:** Tuned for one canteen with SQLite WAL single-instance write locking, 4-second polling instead of WebSockets/SSE, and `POST /api/demo/reset` restricted to non-production environments with `ENABLE_DEMO_RESET=true`.
