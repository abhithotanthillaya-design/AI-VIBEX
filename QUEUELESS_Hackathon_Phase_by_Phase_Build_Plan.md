# QUEUELESS --- 4-Hour Hackathon Build Plan

## Problem 6: Canteen Queue & Pre-Order \| Web Application

**Goal:** Build a working campus canteen pre-order web app that accepts
orders, allocates pickup slots according to kitchen capacity, and gives
kitchen staff a live order-management view.

**Build principle:** A small, reliable end-to-end product beats a large
collection of unfinished features. Build the complete student → kitchen
→ pickup flow first. Add polish and optional intelligence only after
that flow works.

------------------------------------------------------------------------

## 1. Product definition

### The problem

Students lose time standing in canteen queues and may miss classes.
Canteen staff face order confusion and sudden rushes.

### Our solution

**QUEUELESS** lets students: 1. Browse a small live menu. 2. Add items
to a cart. 3. Place a pre-order in a few clicks (or enter a
plain-language order). 4. Receive a pickup slot allocated using kitchen
workload and slot capacity. 5. Track order status. 6. Show an order
number / QR-style pickup token at collection.

Kitchen staff can: 1. See incoming orders in a live queue. 2. View each
order's items, pickup slot and notes. 3. Accept an order and move it
through preparation. 4. Mark it ready and collected. 5. See workload
grouped by pickup slot.

### The differentiator

**Capacity-aware pickup allocation**, not just online ordering.

The allocator should distribute orders across available slots using: -
Current number of active orders in each slot. - Estimated preparation
effort of the new order. - Maximum workload allowed per slot. - The
earliest feasible pickup time.

For the prototype, use deterministic rules that can be explained to
judges. Do not claim machine learning or real-world prediction unless it
is genuinely implemented and validated.

### Demo story

A student orders two items during the lunch rush. The system assigns a
realistic pickup slot. A second student places a larger order and
receives a later slot because the earlier slot is nearly full. The
kitchen dashboard updates, staff mark the first order as preparing and
ready, and the student sees the status change.

------------------------------------------------------------------------

## 2. Scope: must-have vs. optional

### Must-have (finish these first)

-   Responsive student menu page.
-   Cart with quantity controls and total.
-   Place-order API with server-side validation.
-   Menu data and availability.
-   Capacity-aware pickup slot assignment.
-   Unique order ID / pickup code.
-   Student order confirmation and status tracking.
-   Kitchen dashboard showing all active orders.
-   Kitchen status updates:
    `PLACED → ACCEPTED → PREPARING → READY → COLLECTED`.
-   Automatic refresh or live updates.
-   Seed/demo data and a reliable demo reset.

### Optional (only after the full flow works)

-   Plain-language ordering parser.
-   QR code rendering/scanning (a pickup code is enough for MVP).
-   Low-stock indicator.
-   Sales / rush-hour analytics.
-   Sound or visual alert for new kitchen orders.
-   Admin menu editor.
-   Authentication and role management.

### Explicitly out of scope for a 4-hour prototype

-   Real payment gateway.
-   Real college identity integration.
-   Production deployment with guaranteed uptime.
-   Multiple canteens or complex inventory procurement.
-   Actual machine-learning model training.
-   Real SMS/WhatsApp notifications.

Use a clearly labelled **demo mode** if authentication or payment is
simulated. Never present simulated functionality as a real integration.

------------------------------------------------------------------------

## 3. Recommended free technology stack

Choose tools the team already knows. Avoid spending hackathon time
learning a new framework.

  -----------------------------------------------------------------------
  Layer                   Recommended choice      Why
  ----------------------- ----------------------- -----------------------
  Frontend                React + Vite +          Fast development,
                          TypeScript              reusable components

  Styling                 Tailwind CSS, or        Consistent responsive
                          existing CSS setup      UI

  Icons                   Lucide                  Clean, consistent icons

  Backend                 Python + FastAPI        Quick API development
                                                  and clear validation

  Database                Supabase Postgres free  Persistent shared data
                          tier, if already        or zero-setup local
                          accessible; otherwise   demo
                          SQLite                  

  Live updates            Poll active orders      Reliable and simple; no
                          every 3--5 seconds      WebSocket setup needed

  Backend hosting         Run locally on a        Avoid Colab dependency
                          teammate's laptop; use  during a short event
                          a free tunnel only if   
                          network rules permit    

  Version control         GitHub                  Parallel work and
                                                  integration
  -----------------------------------------------------------------------

**Important hosting decision:** Google Colab is not the preferred
production-style host for this demo. Notebook runtimes can disconnect or
change URLs. If the event network permits it, run FastAPI on one
teammate's laptop and expose it with a permitted tunnel. If the rules
require a public endpoint, verify the event's network policy before
choosing a free host. Keep a local demo fallback.

**No-cost rule:** Do not add paid APIs, paid hosting, paid database
plans, or paid AI services. Confirm free-tier limits and account access
before depending on any hosted service.

------------------------------------------------------------------------

## 4. Architecture

``` text
Student Web App (React)
  ├── Menu and cart
  ├── Place order
  └── Track order
          |
          | HTTP / JSON
          v
FastAPI Backend
  ├── Menu API
  ├── Order API
  ├── Pickup-slot allocator
  ├── Kitchen status API
  └── Demo/reset API
          |
          v
Database
  ├── menu_items
  ├── orders
  ├── order_items
  └── pickup_slots (or calculated slot capacity)
          ^
          |
Kitchen Dashboard (React)
  ├── Active order queue
  ├── Slot workload
  └── Status controls
```

### Suggested repository structure

``` text
queueless/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── components/
│   │   │   ├── MenuCard.tsx
│   │   │   ├── CartPanel.tsx
│   │   │   ├── OrderCard.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── pages/
│   │   │   ├── StudentPage.tsx
│   │   │   ├── OrderTrackingPage.tsx
│   │   │   └── KitchenPage.tsx
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── .env.example
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── allocator.py
│   │   └── routes/
│   │       ├── menu.py
│   │       ├── orders.py
│   │       └── kitchen.py
│   └── requirements.txt
├── README.md
└── .gitignore
```

If the team already has a repository or starter project, adapt this
structure rather than replacing working code.

------------------------------------------------------------------------

## 5. Data model

Keep the model small.

### `menu_items`

  Field          Type               Notes
  -------------- ------------------ -----------------------------------
  id             string / UUID      Primary key
  name           string             Display name
  description    string             Short description
  price          integer            Store paise, e.g. ₹40 = 4000
  prep_minutes   integer            Estimated preparation effort
  available      boolean            Whether students can order it
  image_url      string, optional   Use local/static images if needed

### `orders`

  Field               Type               Notes
  ------------------- ------------------ ---------------------------
  id                  string / UUID      Primary key
  pickup_code         string             Short human-readable code
  customer_name       string             Demo name is acceptable
  status              enum/string        Order lifecycle
  pickup_slot_start   timestamp          Assigned slot start
  pickup_slot_end     timestamp          Assigned slot end
  total_amount        integer            Paise
  total_prep_units    integer            Estimated workload
  notes               string, optional   Customer instructions
  created_at          timestamp          Creation time

### `order_items`

  Field          Type            Notes
  -------------- --------------- ----------------------------------
  id             string / UUID   Primary key
  order_id       string / UUID   Parent order
  menu_item_id   string / UUID   Menu reference
  item_name      string          Snapshot for display
  quantity       integer         Must be positive
  unit_price     integer         Snapshot in paise
  prep_minutes   integer         Snapshot of preparation estimate

For a very short prototype, storing order items as a validated JSON
array inside an order record is acceptable if that is faster. Keep the
API response consistent.

------------------------------------------------------------------------

## 6. API contract --- agree before parallel coding

Use the same field names in frontend and backend. Do not let each
teammate invent their own payload shape.

### Menu

-   `GET /api/menu` --- return available menu items.

Example response:

``` json
[
  {
    "id": "item_1",
    "name": "Veg Sandwich",
    "description": "Grilled vegetable sandwich",
    "price": 5000,
    "prep_minutes": 4,
    "available": true
  }
]
```

### Place an order

-   `POST /api/orders`

Request:

``` json
{
  "customer_name": "Demo Student",
  "items": [
    { "menu_item_id": "item_1", "quantity": 2 },
    { "menu_item_id": "item_2", "quantity": 1 }
  ],
  "notes": "No extra spicy"
}
```

Response:

``` json
{
  "id": "order_demo_001",
  "pickup_code": "Q7K2",
  "status": "PLACED",
  "pickup_slot_start": "2026-11-12T12:50:00+05:30",
  "pickup_slot_end": "2026-11-12T12:55:00+05:30",
  "total_amount": 12500,
  "message": "Order placed. Please arrive during your pickup window."
}
```

The backend must calculate prices from the menu database. Never trust a
total price sent by the browser.

### Student tracking

-   `GET /api/orders/{order_id}` --- return order details, items, status
    and pickup slot.

### Kitchen

-   `GET /api/kitchen/orders?status=active` --- return active orders
    ordered by pickup time and creation time.
-   `PATCH /api/kitchen/orders/{order_id}/status`

Request:

``` json
{ "status": "PREPARING" }
```

Allowed transitions: - `PLACED → ACCEPTED` - `ACCEPTED → PREPARING` -
`PREPARING → READY` - `READY → COLLECTED`

Reject invalid transitions on the backend.

### Slot workload

-   `GET /api/kitchen/slots` --- return upcoming slots, assigned
    workload, capacity and remaining capacity.

### Demo reset (optional)

-   `POST /api/demo/reset` --- restore seeded menu and clear demo
    orders. Protect this from accidental use outside demo mode.

------------------------------------------------------------------------

## 7. Pickup-slot allocation logic

This is the main technical differentiator. Implement it on the backend
so every client uses the same allocation decision.

### Simple, explainable model

1.  Divide the next 30--45 minutes into 5-minute pickup slots.
2.  Give each slot a maximum workload, for example **12 preparation
    units**. This is a prototype tuning value, not a real canteen
    measurement.
3.  Estimate an order's workload by adding each item's preparation
    estimate multiplied by quantity.
4.  Consider slots from earliest to latest.
5.  Choose the earliest slot where
    `current_workload + new_order_workload ≤ slot_capacity`.
6.  If no slot has room, extend the schedule by another slot or return a
    clear "busy" message with the next available time.
7.  Save the chosen slot and workload with the order.

### Pseudocode

``` python
def allocate_slot(order_workload, slots):
    for slot in slots:  # earliest first
        if slot.workload + order_workload <= slot.capacity:
            slot.workload += order_workload
            return slot

    return create_next_available_slot(order_workload)
```

### Important edge cases

-   Reject quantities less than 1.
-   Reject unavailable or unknown menu items.
-   Prevent an order larger than one slot's capacity from being silently
    accepted; either allocate a dedicated slot with a clear rule or ask
    the user to reduce the order.
-   Make allocation atomic/transaction-safe so two simultaneous orders
    cannot overbook the same slot. For a single-process in-memory demo,
    use a lock; for a database, use a transaction and appropriate row
    locking.
-   Cancelled orders should release their slot workload if cancellation
    is implemented.
-   Use the server's local configured timezone consistently.

### What to tell judges

"Our allocator is capacity-aware. It estimates preparation workload from
the items, checks existing active workload, and assigns the earliest
slot that stays within the configured kitchen capacity. The rule is
transparent and can later be calibrated using actual preparation-time
data."

Do not call this AI unless an actual AI component is implemented. A
deterministic optimization rule is a legitimate algorithmic
contribution.

------------------------------------------------------------------------

## 8. UI/UX direction

### Product feel

Make it look like a polished campus product, not a generic admin
template.

**Suggested visual direction** - Warm off-white background. - Deep
charcoal text. - One strong accent such as fresh green or orange. -
Large food photography, clean cards, generous spacing. - Clear
pickup-time emphasis. - Strong status colours with accessible
contrast. - Mobile-first student ordering; desktop-friendly kitchen
dashboard.

### Student screens

1.  **Menu:** canteen name, open/closed state, menu categories, item
    cards, price, prep estimate and add button.
2.  **Cart:** item quantities, subtotal, notes and place-order CTA.
3.  **Confirmation:** prominent pickup window, pickup code, order
    summary and tracking link.
4.  **Tracking:** clear progress timeline and current status.

### Kitchen screen

-   Header with "Kitchen Live Queue" and connection/last-updated
    indicator.
-   Summary: new orders, preparing, ready, workload by slot.
-   Order cards grouped by pickup time.
-   Large action buttons for the next valid status.
-   Highlight orders approaching their pickup window.
-   Avoid dense tables on small screens.

### Accessibility and usability

-   Buttons must have clear labels and visible focus states.
-   Do not rely on colour alone to communicate status.
-   Show loading, empty, error and success states.
-   Disable the place-order button while submitting to prevent duplicate
    orders.
-   Make touch targets comfortable on phones.

------------------------------------------------------------------------

## 9. Four-hour execution plan

The event brief says five hours, but this plan intentionally targets a
**four-hour build** and leaves any extra time as contingency.

  -----------------------------------------------------------------------
  Time                    Milestone               Required result
  ----------------------- ----------------------- -----------------------
  00:00--00:15            Lock scope and roles    One-page feature
                                                  agreement, API
                                                  contract, repo ready

  00:15--00:35            Project foundation      Frontend and backend
                                                  start; seeded menu;
                                                  CORS working

  00:35--01:20            Parallel core           Student menu/cart and
                          development             backend
                                                  menu/order/allocator

  01:20--02:00            Complete order flow     Student can place order
                                                  and see assigned slot

  02:00--02:40            Kitchen dashboard       Kitchen can see orders
                                                  and update statuses

  02:40--03:10            End-to-end integration  Student and kitchen
                                                  screens use the same
                                                  backend data

  03:10--03:35            Test and stabilize      No blocking bugs; reset
                                                  and fallback ready

  03:35--04:00            Polish and pitch        Responsive UI, demo
                                                  script, architecture
                                                  explanation
  -----------------------------------------------------------------------

**Hard rule:** At 02:40, stop adding features. Only integrate, test, fix
and polish.

------------------------------------------------------------------------

## 10. Team split

Adapt to the actual number of teammates. Assign one person as
integration owner.

### Person A --- Frontend student experience

-   Menu, item cards, categories.
-   Cart and quantity controls.
-   Order confirmation and tracking.
-   Connect to agreed API contract.

### Person B --- Backend and allocator

-   FastAPI setup and CORS.
-   Menu and order endpoints.
-   Server-side price calculation and validation.
-   Pickup-slot allocation and status transitions.

### Person C --- Kitchen dashboard

-   Live order list.
-   Slot workload display.
-   Status update controls.
-   Polling and loading/error states.

### Person D --- UI/UX, integration and demo

-   Visual system and responsive layout.
-   Seed data and realistic demo scenario.
-   API integration support and testing.
-   Pitch, screenshots and judge Q&A.

If there are only three people, Person D's integration and demo
responsibilities should be shared, with one person explicitly owning the
final merge.

------------------------------------------------------------------------

## 11. Git and integration rules

1.  One teammate creates the repository and pushes the working starter
    project to `main`.
2.  Each teammate creates a feature branch:
    -   `feature/student-ui`
    -   `feature/backend-api`
    -   `feature/kitchen-dashboard`
3.  Agree on API types and endpoint names before parallel
    implementation.
4.  Commit small working increments, not one giant final commit.
5.  Push early so integration problems appear early.
6.  The integration owner merges completed branches into `main`.
7.  Do not let multiple people edit the same files unless coordinated.
8.  Never commit `.env`, API keys, passwords or personal credentials.
9.  Keep `main` runnable. Test the app after every merge.

Suggested commands:

``` bash
git clone https://github.com/ YOUR-ORG / queueless.git
cd queueless
git checkout -b feature/your-task

git add .
git commit -m "Build student menu and cart"
git push -u origin feature/your-task
```

Replace the placeholder repository URL with the team's actual URL.
Create pull requests or merge through GitHub after checking the changes.

------------------------------------------------------------------------

## 12. Testing checklist

### Student flow

-   [ ] Menu loads from backend.
-   [ ] Unavailable item cannot be ordered.
-   [ ] Quantity and total update correctly.
-   [ ] Empty cart cannot be submitted.
-   [ ] Duplicate submission is prevented.
-   [ ] Order is saved and returns a pickup code.
-   [ ] Assigned slot is visible.
-   [ ] Student tracking shows kitchen status changes.

### Backend and allocator

-   [ ] Unknown menu item is rejected.
-   [ ] Quantity 0 or negative is rejected.
-   [ ] Price is calculated server-side.
-   [ ] Slot workload increases after an order.
-   [ ] A full slot causes a later slot to be selected.
-   [ ] Invalid status transition is rejected.
-   [ ] Two rapid orders do not overbook a slot.
-   [ ] API errors are readable and do not crash the server.

### Kitchen flow

-   [ ] New order appears without manual page refresh (polling is
    acceptable).
-   [ ] Staff can move an order through valid statuses.
-   [ ] Student tracking reflects the update.
-   [ ] Ready orders are visually obvious.
-   [ ] Empty queue has a useful empty state.

### Demo readiness

-   [ ] Frontend and backend both start reliably.
-   [ ] Demo menu is seeded.
-   [ ] Demo reset works.
-   [ ] Internet failure has a fallback plan.
-   [ ] No broken images or dead buttons.
-   [ ] Demo can be completed in under 3 minutes.

------------------------------------------------------------------------

## 13. Three-minute judge demonstration

**0:00--0:25 --- Show the problem** "During lunch breaks, students lose
time in queues and canteens receive unpredictable rushes. QUEUELESS
coordinates orders before students reach the counter."

**0:25--1:05 --- Student orders** - Open the student menu. - Add two
items. - Place the order. - Point out the generated pickup code and
assigned time window.

**1:05--1:40 --- Demonstrate intelligent allocation** - Place another
order with a larger preparation workload. - Show that the allocator
considers the first order's slot workload and chooses a feasible slot. -
Explain the capacity rule briefly.

**1:40--2:25 --- Kitchen view** - Open the kitchen dashboard. - Show
both orders and their pickup slots. - Accept and prepare the first
order. - Mark it ready.

**2:25--3:00 --- Close with impact and technical credibility** "The
prototype connects student ordering, a capacity-aware scheduling
algorithm, and a kitchen operations dashboard through a shared backend.
The next step would be calibrating capacity with real canteen
preparation data and piloting it during peak hours."

Only demonstrate features that actually work in the build.

------------------------------------------------------------------------

## 14. Likely judge questions

**Q: How is this different from a normal food-ordering app?**\
A: The central feature is kitchen-capacity-aware pickup scheduling. It
is designed to reduce simultaneous arrivals and kitchen overload, not
merely collect orders.

**Q: How do you calculate pickup time?**\
A: Each menu item has a configurable preparation estimate. We calculate
order workload, compare it with active workload in each time slot, and
assign the earliest slot within capacity.

**Q: Is this really AI?**\
A: The MVP uses an explainable scheduling algorithm rather than
pretending a rule-based system is machine learning. AI-based demand
forecasting could be explored after collecting real data.

**Q: What if many students order at once?**\
A: The backend must perform slot allocation atomically to avoid
overbooking. The prototype demonstrates this with a lock or database
transaction.

**Q: What happens if the kitchen is delayed?**\
A: Staff can update order status. A production version could estimate
delays from actual preparation times and notify affected students.

**Q: How will a real canteen use it?**\
A: Start with one canteen, a small menu, configurable slot capacity and
a kitchen tablet or laptop. Run a pilot and tune preparation estimates
from observed data.

------------------------------------------------------------------------

## 15. Final priority order

If time becomes tight, build in this exact order:

1.  Backend starts and returns menu data.
2.  Student can place a valid order.
3.  Backend assigns a pickup slot.
4.  Kitchen sees that order.
5.  Kitchen updates status.
6.  Student sees updated status.
7.  UI polish and demo reset.
8.  Optional plain-language ordering or QR display.

**Do not sacrifice steps 1--6 to build optional AI features.** A
complete, tested flow is the strongest prototype.

------------------------------------------------------------------------

## 16. First 15 minutes: exact kickoff checklist

-   [ ] Create or open the shared GitHub repository.
-   [ ] Confirm how many teammates are coding and who owns integration.
-   [ ] Choose React/Vite and FastAPI only if the team can work with
    them immediately.
-   [ ] Decide database: Supabase if already configured, otherwise
    SQLite for the fastest shared-backend prototype.
-   [ ] Agree on the API contract in Section 6.
-   [ ] Seed 6--8 realistic menu items with preparation estimates.
-   [ ] Start the frontend and backend and verify they communicate.
-   [ ] Keep a working fallback demo path.

**Definition of done:** A student can place an order, receive a
capacity-aware pickup slot, kitchen staff can update it, and the student
can see the update. Everything else is enhancement.

------------------------------------------------------------------------

*Prepared for a short, no-cost hackathon web-app prototype. Tune slot
duration, workload units and capacity with the canteen's actual
operating constraints if those are provided by the organizers.*
