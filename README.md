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

- Responsive student menu catalog seeded in SQLite with local Indian canteen food photography.
- Live search, category filtering (`Meals`, `Fast Food`, `Snacks`, `Beverages`), and unavailable-item protection.
- Interactive cart with quantity controls, estimated kitchen workload preview, duplicate-submission prevention, and server-side paise price calculation.
- Deterministic capacity-aware 5-minute pickup-slot allocator with atomic SQLite transaction locking (`BEGIN IMMEDIATE` + process lock).
- Order confirmation receipt with unique Order ID, 4-character pickup code, and assigned pickup window.
- Dedicated student order tracking page with 5-stage progress timeline, Order ID lookup, and 4-second live polling.
- Kitchen live queue grouped by pickup slot, interactive status summary cards, slot capacity meters, collection confirmation dialog, and 4-second polling.
- Manager dashboard (`Overview`, `Menu`, `Orders`, `Sales`, `Slot Settings`) with Veg/Non-Veg menu CRUD, soft deletion preserving order snapshots, collected-only sales analytics, DB-backed capacity updates, and pickup-slot close/reopen controls.
- Guarded `POST /api/demo/reset` endpoint and UI confirmation workflow for hackathon demonstrations.

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
| `GET` | `/api/menu` | List available menu items (supports `category`, `search`, `include_unavailable`) |
| `POST` | `/api/orders` | Validate items, compute server total, allocate slot, create order |
| `GET` | `/api/orders/{order_id}` | Fetch live order status, items, pickup code, and pickup window |
| `GET` | `/api/kitchen/orders` | List kitchen orders (`status=active` default or specific status) |
| `PATCH` | `/api/kitchen/orders/{order_id}/status` | Advance order (`PLACED → ACCEPTED → PREPARING → READY → COLLECTED`) |
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

SQLite (`queueless.db`, WAL mode, foreign keys enabled) stores three core tables:

- `menu_items`: Catalog items with integer `price` (in paise), `prep_minutes` workload estimate, `available` boolean (`0`/`1`), category, and `image_url`.
- `orders`: Order metadata including unique `pickup_code`, `customer_name`, `status`, `pickup_slot_start`, `pickup_slot_end`, server-calculated `total_amount` (paise), `total_prep_units`, optional `notes`, `created_at`, and `updated_at`.
- `order_items`: Snapshotted line items (`item_name`, `quantity`, `unit_price`, `prep_minutes`) referencing `orders.id` (`ON DELETE CASCADE`) and `menu_items.id`.

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
node --test tests/cart.test.ts tests/kitchen.test.ts tests/demo_reset.test.ts tests/manager.test.ts
```

---

## 14. Demo Workflow

Follow [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for a 3-minute judge walkthrough covering:
1. Clean queue verification (or **Reset Demo** in Kitchen).
2. Student placing Order 1 (10 prep units) → assigned earliest slot.
3. Student placing Order 2 (6 prep units) → overflows to next 5-minute slot (`10 + 6 > 12`).
4. Kitchen accepting, preparing, marking ready, and confirming collection while Student Tracking updates automatically and slot capacity resets to `0 / 12`.

---

## 15. Known Limitations

- **Demo mode scope & security transparency:** No real payment gateway, campus SSO authentication, or SMS/WhatsApp notifications. The **Manager** interface is labelled **Demo Prototype Access** and is unauthenticated; production deployment requires authentication and role-based authorization before exposing `/api/manager/*`.
- **Single-canteen prototype:** Tuned for one canteen with a static seeded menu (`backend/app/seed.py`) and configurable prototype capacity (`12` units / `5`-minute slot).
- **Polling sync:** Live updates poll every `4` seconds rather than using WebSockets or Server-Sent Events.
- **Demo Reset protection:** `POST /api/demo/reset` is blocked when `ENVIRONMENT=production` or `ENABLE_DEMO_RESET=false`, and requires explicit confirmation in the Kitchen UI.
