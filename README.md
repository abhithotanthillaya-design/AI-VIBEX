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

Open `http://localhost:5173` in your browser.

## Current Build Status

- **Phase 1 (Foundation):** Complete — project structure, environment templates, SQLite schema setup, FastAPI `/api/health` + CORS, React + Tailwind + Lucide design system shell, and verified frontend/backend startup.
- **Upcoming Phases:** Seeded menu & read endpoints, capacity-aware slot allocator & order flow, kitchen live dashboard & polling, end-to-end verification & demo polish.
