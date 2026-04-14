# Partner Dashboard Unification Design

**Date:** 2026-04-14  
**Status:** Approved

## Summary

Unify all per-restaurant management into `partner-dashboard.html`. Deprecate `admin.html` entirely. Every restaurant (Pizzaburg, Peyari Tehari, Milano Express) uses the same partner dashboard. The `admin` role is retired.

---

## Section 1 — Architecture

### Frontend
- `partner-dashboard.html` — top-tab nav replaced with grouped sidebar; 5 new tab sections added
- `partner-dashboard.js` — extended in-place with all new tab logic
- `admin.html`, `admin.js`, `admin.css` — deleted

### Backend
- `restaurant-admin.js` — new endpoints for deliveries, promotions, customers, analytics, payments, order status
- `store.js` — new data-layer functions for all new sections
- `admin.js` route file — deleted
- Delivery and promotions routes migrate from `/api/admin/*` → `/api/restaurant/*` with `requireRestaurantAdmin`

### Role changes
- `admin` role becomes obsolete — no new routes require it
- Seed stops creating `admin@fdp.com`
- Pizzaburg and Peyari Tehari get `restaurant_admin` accounts created via the existing superadmin approval flow

### Food model
- `addons` field added: `[{ name: String, price: Number }]`

---

## Section 2 — Navigation Structure

Grouped sidebar replacing the existing top-tab nav. Uses exact partner-dashboard frosted-glass styling (`rgba(232,92,44,...)` accent, `backdrop-filter: blur`).

```
[Overview]            ← always visible, no group label

RESTAURANT
  Menu
  Profile

OPERATIONS
  Orders              ← badge shows active order count
  Deliveries

BUSINESS
  Promotions
  Customers
  Analytics
  Payments
```

Stats sidebar card below nav gains one extra row: **Active Orders**.

---

## Section 3 — Features Per Tab

### Overview (new)
- 3 summary cards: Total Orders, Revenue, Active Orders
- Recent orders activity feed (last 10 orders)
- Popular items this week (top 5)

### Menu (enhanced)
- Existing food card grid + add/edit/delete — unchanged
- Food modal gains **add-ons section**: dynamic list of `{ name, price }` rows, add/remove buttons
- Add-ons saved as `addons` array on the Food document

### Orders (enhanced)
- Existing table — unchanged columns
- Each row gains a **status dropdown**: `pending → confirmed → preparing → out_for_delivery → delivered`
- Each row gains a **Cancel** button that sets status to `cancelled`
- `cancelled` and `delivered` are terminal states — no further transitions allowed
- Status update hits `PUT /api/restaurant/orders/:id/status`

### Profile (unchanged)
- No changes

### Deliveries (new — shared pool)
- All restaurant admins see and manage the same driver list
- Add/edit form: name, phone, email, zone, status (available/busy/offline), rating
- Table: name, phone, zone, status, rating, edit/delete actions

### Promotions (new)
- Add/edit form: code, title, description, type (percentage/flat), discount value, active toggle
- Table: code, title, type, value, active status, edit/delete actions
- Full CRUD

### Customers (read-only)
- Table: customer name, orders placed from this restaurant, total spent, joined date
- Scoped to customers who have ordered from this restaurant
- No edit controls — data reflects live order history

### Analytics (read-only)
- Summary cards: total orders, total revenue, avg order value, most popular category
- Popular items table: name, category, qty sold, revenue
- No edit controls — computed from order history

### Payments (read-only)
- Transaction list: order ID, amount, payment method, date
- Scoped to this restaurant's orders only
- No edit controls — reflects completed order payments

---

## Section 4 — Backend Routes

### New routes in `restaurant-admin.js`

```
PUT    /api/restaurant/orders/:id/status

GET    /api/restaurant/deliveries
POST   /api/restaurant/deliveries
PUT    /api/restaurant/deliveries/:id
DELETE /api/restaurant/deliveries/:id

GET    /api/restaurant/promotions
POST   /api/restaurant/promotions
PUT    /api/restaurant/promotions/:id
DELETE /api/restaurant/promotions/:id

GET    /api/restaurant/customers
GET    /api/restaurant/analytics
GET    /api/restaurant/payments
```

### New `store.js` functions

```
updateOrderStatus(orderId, status)
getDeliveryPersonnel()
createDeliveryPerson(data)
updateDeliveryPerson(id, data)
deleteDeliveryPerson(id)
getRestaurantPromotions()
createPromotion(data)
updatePromotion(id, data)
deletePromotion(id)
getRestaurantCustomers(restaurantId)
getRestaurantAnalytics(restaurantId)
getRestaurantPayments(restaurantId)
```

### Deleted
- `backend/src/routes/admin.js`
- `/api/admin/delivery/*` endpoints
- `/api/admin/promotions/*` endpoints

---

## Out of Scope

- Per-restaurant delivery pool (drivers remain shared)
- Editing customer records or payment entries
- Superadmin analytics (separate roadmap item)
- Mobile responsive improvements
