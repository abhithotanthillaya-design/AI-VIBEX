# QUEUELESS — Project Overview

## 1. Problem

Campus canteens experience intense, short-duration demand spikes between lectures. Students spend limited break time queuing twice (once to order, once to collect), while kitchen staff manage verbal or unbatched orders without visibility into upcoming workload.

---

## 2. Proposed Solution

**QUEUELESS** is a role-authenticated campus pre-ordering and kitchen queue orchestration web application with three workspaces:

- **Student Interface (`STUDENT` role):** Self-registered student account with live menu browsing (Veg/Non-Veg, Vegan, Jain-Friendly, and manager-verified allergen disclosure), **"Order in your own words"** plain-language input with confirmation preview, chronological **Pickup Window** selector (`Available`, `Limited availability`, `Full`, `Closed`), cart & special instruction requests, simulated Demo UPI / Counter Cash flow, pickup-code & cryptographic QR issuance, live status tracking, and account-owned **Order History** (`GET /api/orders/mine`).
- **Kitchen Interface (`CANTEEN_STAFF` & `MANAGER` roles):** Slot-grouped live order queue, preparation notes visibility, sequential status controls, camera/manual QR pickup verification (`POST /api/kitchen/verify-pickup`), and pickup-slot workload meters.
- **Manager Interface (`MANAGER` role):** Initialized securely via CLI bootstrap (`python -m app.bootstrap_manager`), offering real-time operational KPIs in IST, full menu CRUD with snapshot-safe soft deletion, searchable order oversight, collected-only 7-day sales summary, DB-backed slot capacity/closure controls, staff/manager provisioning & deactivation, and Manager-only non-production demo reset.

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

- Prototype operates with simulated demo payments (`Demo UPI` / `Cash at Counter`) and without SMS/WhatsApp push notifications or institutional OAuth/SSO.
- Self-service password reset / email verification is not implemented; account deactivation or password updates for locked accounts require manual admin action or logged-in profile updates.
- Login rate limiting (`LOGIN_RATE_LIMIT_MAX_ATTEMPTS`) is in-memory per Python worker process (single-instance deployment).
- Camera-based QR scanning uses `getUserMedia`, which requires **HTTPS** outside `localhost`/`127.0.0.1`; manual token entry and manual counter pickup codes remain available as fallbacks.
- `SESSION_COOKIE_SECURE` auto-enables in `ENVIRONMENT=production`, so production deployments must serve over **HTTPS** for session cookies and camera scanning to work.
- Preparation unit weights (`prep_minutes`) and default slot capacity (`12` units, configurable via Manager Slot Settings) are prototype values rather than calibrated against historical kitchen throughput.
- Single-canteen scope; multi-counter kitchen routing is not modeled.
- Demo reset (`POST /api/demo/reset`) is restricted strictly to authenticated `MANAGER` users in non-production environments with `ENABLE_DEMO_RESET=true` and preserves `users` and `sessions`.
- **Plain-language ordering** uses a deterministic local parser matched against the live SQLite menu rather than a cloud LLM; unrecognized phrasing is flagged for confirmation/manual selection, and valid extracted pickup times preselect a matching 5-minute checkout slot within the 2-hour bookable window (`MAX_EXTENSION_SLOTS = 24`) subject to atomic server re-validation at checkout.

---

## 7. Future Improvements

- Calibrate preparation unit weights and slot capacities using observed timestamp deltas (`ACCEPTED → PREPARING → READY`).
- Support multiple preparation stations (e.g., beverages vs. hot grill) with independent capacity pools.
- Add institutional campus SSO, email verification / forgot-password flows, digital campus wallet/UPI payment integration, and live push/WebSocket notifications.
- Replace in-process login rate limiting with a distributed store (e.g. Redis) for multi-worker horizontal scaling.

