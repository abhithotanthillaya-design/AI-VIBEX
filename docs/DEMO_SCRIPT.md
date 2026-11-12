# QUEUELESS — 3-Minute Judge Demonstration Script

## Preparation Before Judges Arrive

1. Ensure the initial Manager account has been bootstrapped once via CLI (`cd backend; .\.venv\Scripts\python.exe -m app.bootstrap_manager`), and create at least one `CANTEEN_STAFF` account inside the Manager Console's **Staff** tab (or register a fresh Student account during the demo). Never embed hardcoded passwords in code or slides.
2. Start the backend (`uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`) and frontend (`npm.cmd run dev`).
3. Sign in across two browser contexts (e.g. a normal window and a private/secondary profile) because cookies are origin-scoped per browser profile:
   - **Window A (`/student`):** Signed in as a **Student** account (`Register` or `Sign In`).
   - **Window B (`/kitchen` or `/manager`):** Signed in as **Canteen Staff** (`CANTEEN_STAFF`) or **Manager** (`MANAGER`).
4. As **Manager**, if previous test orders exist, click **Reset Demo** in Kitchen (available to `MANAGER` only; preserves user accounts and sessions) and confirm to start with an empty queue and `0 / 12` capacity across all pickup slots.

---

## 0:00 – 0:25 | Frame the Problem

**Action:** Show the **Student** menu page with `API Connected` active.

**Say:**
> "During campus lunch breaks, students lose 15–20 minutes in canteen lines while the kitchen gets hit with unscheduled rushes. QUEUELESS coordinates pre-orders before students reach the counter using capacity-aware pickup-slot scheduling."

---

## 0:25 – 1:05 | Place First Student Order

**Action (Window A — Student):**
1. *(Optional quick highlight)* In **Order in your own words**, click an example prompt or enter `"One masala dosa and two teas"`, click **Parse Order** to show the server-validated confirmation preview (live DB prices, warnings, pickup note), and click **Confirm & Add to Cart** (or add directly from menu cards).
2. Alternatively, filter by **Fast Food** or search `"Sandwich"`, add **2× Veg Grilled Sandwich** (`4` prep units each = `8`), then switch to **Beverages** and add **1× Masala Chai** (`2` prep units).
3. Point out the **Pickup Window (IST)** selector in the Cart (`10` prep units, earliest open slot highlighted automatically, or click any upcoming available slot) and Cart summary (`3 items`, `₹120`).
4. Enter Student Name `"Aarav Sharma"` and note `"Less spicy"`.
5. Click **Place Order**.

**Expected Output:**
- Confirmation card displays unique Order ID, 4-character pickup code (e.g. `Q7K2`), `₹120` verified total, and the earliest 5-minute pickup window (Slot 1).
- Click **Track Live Order** to leave Window A on the live tracking timeline (`PLACED`).

---

## 1:05 – 1:45 | Demonstrate Capacity-Aware Overflow

**Action (Open menu in a new tab or click Back to Menu briefly, or show Window B Kitchen slots first):**
1. Show **Window B (Kitchen)** **Pickup Slot Capacity**: Slot 1 now displays `10 / 12 units` (`2 left`, `1 order`).
2. Place a second student order for **1× Masala Dosa** (`6` prep units, `₹65`).

**Expected Output:**
- Because `10 + 6 = 16 > 12` slot capacity, the backend allocator automatically assigns **Slot 2** (the next 5-minute window) instead of overloading Slot 1.

**Say:**
> "Our scheduler is deterministic and explainable—not black-box AI. It calculates preparation units per item, checks active slot workload inside an atomic SQLite transaction, and shifts new orders to the next open window when a slot nears capacity."

---

## 1:45 – 2:30 | Kitchen Operations & Live Student Sync

**Action (Window B — Kitchen, with Window A Tracking visible):**
1. Show both orders grouped under their respective pickup windows in **Kitchen Live Queue**, including Aarav's `"Less spicy"` preparation note.
2. On Aarav's order, click **Accept Order** → **Start Preparing** → **Mark Ready**.
3. Watch **Window A (Student Tracking)** update automatically within 4 seconds across the timeline, displaying the student's **Counter Pickup QR** (clickable to enlarge) alongside fallback pickup code `Q7K2`.
4. In **Window B (Kitchen)**, click **Scan Pickup QR** to scan the QR via camera (or click **Copy verification token** on Student and paste into **Manual Token Fallback**), then verify collection!

**Expected Output:**
- Aarav's order transitions atomically to `COLLECTED`, displays verified items & pickup slot in the scanner modal, and **Pickup Slot Capacity** for Slot 1 drops from `10 / 12` back to `0 / 12`. Attempting to scan or paste the same token again returns `"already been collected"`.

---

## 2:30 – 3:00 | Manager Console, Menu Control & Reset

**Action (Switch to Manager tab):**
1. Show **Overview** KPIs (real-time `Today's Total Sales`, `Orders Today`, `Available / Total Menu Items`, `Current Pickup Slot Workload`) and **Sales** summary (7-day IST breakdown & top items).
2. Under **Menu**, toggle an item **Sold Out** or edit its price, dietary flags (`Vegan`, `Jain-Friendly`), and `Allergen Information`, and show that **Student** menu updates immediately while past orders retain their original snapshots.
3. Under **Student**, show account-linked **Order History** (`GET /api/orders/mine`) and **Demo Payment** simulator (`Cash at Counter` / `Demo UPI`, clearly labeled no real money charged).
4. Under **Slot Settings** and **Staff**, demonstrate closing/reopening a pickup slot and provisioning or deactivating a `CANTEEN_STAFF` account—then optionally click **Reset Demo** in Kitchen (visible to `MANAGER` only; user accounts and sessions stay intact) for the next judge.

**Say:**
> "QUEUELESS connects role-authenticated student pre-ordering, atomic capacity-aware slot scheduling, live kitchen operations, and manager menu, slot, and staff controls through one shared backend backed by Argon2id, HttpOnly cookies, CSRF checks, and student order ownership."

