---
name: Platform Status Snapshot
description: Completeness audit of FDP as of 2026-04-03 — what is fully working, partially working, and missing/broken
type: project
---

## Fully Implemented and Working

**Backend:**
- Auth: register, login, logout, refresh token (dual endpoint: /login/refresh/ and /token/refresh/), profile GET/PUT
- Restaurant CRUD: list, featured, by-id, foods by restaurant, food by id, search
- Orders: create, list by user, get by id — all properly auth-gated
- Cart: server-side GET and POST (sync endpoint exists, though frontend doesn't use it)
- Reviews: POST with auth (no GET endpoint for listing reviews yet)
- Admin dashboard: full CRUD for orders, restaurants, menu items, delivery personnel, promotions, payments/refunds
- Admin analytics: sales_trend, order breakdown, popular items
- Delivery workload management: assign-delivery updates active_orders/status on DeliveryPerson
- Seeder: restaurants, foods, admin user, demo customer, delivery people, promotions

**Frontend:**
- 8 HTML pages all present: index, restaurants, menu, cart, orders, login, register, settings, admin
- auth.js: real API login/register with JWT storage, password strength meter
- settings.js: profile update via real API
- admin.js: full CRUD dashboard wired to all 9 admin endpoints (minified but complete)
- cart.js: localStorage cart with quantity controls, remove, promo codes (hardcoded), order summary
- main.js: featured restaurants, popular foods, menu browsing, add-to-cart modal with addons

## Partially Implemented / Has Critical Gaps

**Checkout (CRITICAL BUG):**
- placeOrder() in main.js (line 1253) saves orders to localStorage ONLY — never calls the backend API
- Order IDs are generated as 'ORD' + timestamp on the client — not the UUID the backend expects
- Cart totals use hardcoded values ($2.99 delivery fee, dollar signs) instead of Tk and real backend values
- The backend /orders/orders/ POST endpoint is fully built but never called from checkout

**Orders Page:**
- loadOrders() reads from localStorage ('orders' key) — not the backend API
- Orders placed via checkout exist only in the browser; they disappear on other devices/browsers
- Backend orders (created via API directly) would never appear on the orders page
- Reorder function works but reads stale localStorage orders

**Promo Codes:**
- cart.js validates against a hardcoded object: {WELCOME10, SAVE20, FREEDELIVERY, FOODHUB15}
- Backend has a full Promotion model and CRUD, but frontend never queries /admin/promotions/ to validate
- Promo discount is applied only to the DOM total — not included in the order payload at all

**Reviews:**
- POST /restaurants/reviews/ exists and works
- No GET endpoint to list reviews for a restaurant or food item
- No frontend UI to display reviews anywhere (no review section on menu page)
- No trigger after order delivery to prompt a review

**Token Refresh:**
- api.js has no automatic token refresh logic — when access token expires (1 day), user gets silent 401 errors
- handleAPIError() detects 401 and redirects to login, but does not attempt refresh first

**Auth Registration Flow:**
- Register shows a "verification modal" with a fake resend button (setTimeout, no real email)
- Register response includes access/refresh tokens but they are NOT saved to localStorage
- User must manually log in after registering

**auth.js showNotification:**
- The function is defined as a stub with a comment "omitted for brevity, reuse from main.js" — it's empty
- Notifications on login.html and register.html do not render (function body is missing)

## Missing / Not Built

- No public GET endpoint for reviews (cannot display reviews on restaurant/food pages)
- No promotion validation endpoint (POST /promotions/validate/ or similar) for use at checkout
- No order cancellation from the customer side (only admin can cancel)
- No real-time order tracking (polling or WebSocket)
- No password change endpoint (settings page only updates name/phone)
- No user address management (addresses typed fresh every checkout)
- No payment gateway integration (card fields exist in modal but are fake)
- No image upload — admin image fields expect a filename string
- No rate limiting on auth endpoints
- No input sanitization middleware
- loadCategories() in main.js is empty — the function body is just a comment stub
- Search hero on index.html has an address input that does nothing
- "Details" button on order cards links to nothing (type="button", no handler)

**Why:** This was noted during the initial full-platform audit on 2026-04-03.
**How to apply:** Prioritize connecting placeOrder() to the backend API and fixing the orders page to load from /api/orders/orders/ — this is the most impactful gap.
