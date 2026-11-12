# QUEUELESS

Campus canteen pre-ordering and capacity-aware pickup-slot management web application.

## Architecture Overview

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Lucide icons (`frontend/`)
- **Backend:** Python FastAPI + SQLite (`backend/`)
- **Primary Differentiator:** Deterministic, capacity-aware pickup-slot allocation based on active kitchen workload and preparation estimates.

## Prerequisites

- Node.js 20+ (with `npm`)
- Python 3.11+

## Quick Start (Development)

### 1. Backend (FastAPI)

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Verify backend health:
- Open `http://127.0.0.1:8000/api/health`
- Swagger API docs: `http://127.0.0.1:8000/docs`

Run backend tests:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest
```

### 2. Frontend (React + Vite)

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

*(Note: On Windows PowerShell with restricted script execution policies, run `npm.cmd install` and `npm.cmd run dev`.)*

Run frontend unit tests:

```powershell
cd frontend
node --test tests/cart.test.ts
```

Open `http://localhost:5173` in your browser.

## Current Build Status

- **Phase 1 (Foundation):** Complete — project structure, environment templates, SQLite schema setup, FastAPI `/api/health` + CORS, React + Tailwind + Lucide design system shell, and verified startup.
- **Phase 2 (Student Menu & Shopping Cart):** Complete — idempotent seeded Indian canteen menu (`backend/app/seed.py`), `GET /api/menu` endpoint, responsive student menu cards with local food images, live search, category filters, and interactive shopping cart panel.
- **Phase 3 (Order Placement, Slot Allocation & Student Tracking):** Complete — deterministic capacity-aware pickup-slot scheduler (`backend/app/allocator.py`), `POST /api/orders` & `GET /api/orders/{order_id}`, student checkout confirmation with pickup code & slot window, and live polling order tracker.
- **Upcoming Phases:** Kitchen live dashboard & status controls (Phase 4), demo reset & end-to-end QA (Phase 5).
