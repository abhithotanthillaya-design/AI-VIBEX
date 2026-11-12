# QUEUELESS — Project Overview

## 1. Problem

Campus canteens experience intense, short-duration demand spikes between lectures. Students spend limited break time queuing twice (once to order, once to collect), while kitchen staff manage verbal or unbatched orders without visibility into upcoming workload.

---

## 2. Proposed Solution

**QUEUELESS** is a dual-interface web application for campus pre-ordering and kitchen queue orchestration:

- **Student Interface:** Fast mobile-friendly menu browsing with Veg/Non-Veg indicators, cart management, server-validated checkout, pickup-code issuance, and live status tracking.
- **Kitchen Interface:** Slot-grouped live order queue, preparation notes visibility, sequential status controls, pickup-slot workload meters, and demo reset control.
- **Manager Interface (Demo Prototype Access):** Real-time operational KPIs in IST, full menu CRUD with snapshot-safe soft deletion, searchable order oversight, collected-only 7-day sales summary, and DB-backed slot capacity/closure controls.

---

## 3. Core Innovation

Rather than acting as a plain online order form, QUEUELESS enforces **capacity-aware pickup-slot allocation** on the backend:

- Every menu item carries a preparation workload estimate (`prep_minutes`).
- Active orders are scheduled into 5-minute windows capped at a configurable kitchen capacity (`12` preparation units per window by default).
- Concurrent orders are serialized via SQLite `BEGIN IMMEDIATE` transactions and an in-process write lock so rush traffic overflows cleanly to later windows instead of overbooking the counter.

---

## 4. Benefits

- **For Students:** Predictable 5-minute collection windows and transparent preparation progress from `PLACED` to `READY`.
- **For Kitchen Staff:** Smoothed workload distribution across 5-minute intervals, clear ticket prioritization by pickup window, and fewer counter bottlenecks.
- **For Campus Operations:** Configurable slot duration and capacity parameters requiring zero specialized hardware.

---

## 5. Technology Choices

- **Frontend:** React + TypeScript + Vite + Tailwind CSS v4 + Lucide icons for rapid, accessible, responsive UI development.
- **Backend:** Python + FastAPI + Pydantic v2 for strict request validation, clean separation of concerns, and automatic OpenAPI docs.
- **Database:** SQLite in WAL mode for reliable local persistence and serialized transactions without external hosted dependencies.
- **Live Updates:** 4-second HTTP polling with duplicate-request guards for predictable behavior across unstable event Wi-Fi.

---

## 6. Current Limitations

- Prototype operates in **demo mode** without real payment processing, institutional SSO authentication, or SMS/WhatsApp push notifications.
- Manager endpoints (`/api/manager/*`) and the Manager console are intentionally open for hackathon demonstration (**Demo Prototype Access**) and require authentication + role-based authorization before production deployment.
- Preparation unit weights (`prep_minutes`) and default slot capacity (`12` units, configurable via Manager Slot Settings) are prototype values rather than calibrated against historical kitchen throughput.
- Single-canteen scope; multi-counter kitchen routing is not modeled.
- Demo reset (`POST /api/demo/reset`) is intended strictly for non-production hackathon demonstrations.

---

## 7. Future Improvements

- Calibrate preparation unit weights and slot capacities using observed timestamp deltas (`ACCEPTED → PREPARING → READY`).
- Support multiple preparation stations (e.g., beverages vs. hot grill) with independent capacity pools.
- Add role-based campus authentication, digital campus wallet/UPI payment integration, and live push/WebSocket notifications.
- Provide an admin menu availability & capacity tuning panel for canteen managers.

