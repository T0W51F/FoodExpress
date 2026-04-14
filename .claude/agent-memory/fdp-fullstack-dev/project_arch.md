---
name: Architecture Patterns and Quirks
description: Key architectural decisions, ID conventions, naming mismatches, and data flow patterns in FDP
type: project
---

## ID Conventions
- All business entities use integer IDs: user_id, food_id, restaurant_id, order_id (EXCEPTION: Order uses UUID string from crypto.randomUUID(), not an integer from getNextSequence)
- getNextSequence(key) in counters.js self-heals if Counter collection is behind the actual max in the collection
- Orders are intentionally UUID to avoid sequential guessing; other resources use sequential integers

## Data Flow
- Frontend → apiCall() in main.js (raw fetch with auth header) OR API.service methods in api.js
- Both exist in parallel; main.js uses its own apiCall() wrapper, not API.service
- api.js exports window.API with service (APIService instance) and config
- Admin uses its own adminRequest() fetch wrapper directly (not api.js)
- Cart: localStorage-first, server-side /orders/cart/ endpoint exists but frontend only calls it optionally
- Orders: created via POST /api/orders/orders/ on backend, but checkout currently bypasses this

## Store.js Patterns
- All DB queries must go through store.js (admin.js violates this — queries models directly)
- serializeOrder() is defined separately in both store.js and admin.js (duplication)
- publicUser() is a private helper in store.js — not exported, used internally

## Formatters
- serializeRestaurant() emits both 'id' and 'restaurant_id' (same value) for compatibility
- serializeFood() spreads raw food doc and adds 'id' alias — raw Mongoose fields leak through (_id is excluded by .lean())
- image_url is a constructed path — frontend does NOT use this; it constructs its own path: '../assets/images/foods/' + item.image

## Frontend Quirks
- main.js is used on EVERY page (loaded universally) — contains page-specific logic gated by DOM element existence checks
- Pages that need page-specific behavior call their init functions from DOMContentLoaded in main.js at the bottom
- showNotification() is defined in main.js and referenced as window.showNotification in cart.js and admin.js
- auth.js defines its own showNotification stub that is empty — notifications on login/register pages are broken
- Currency: backend stores Taka (Tk), frontend uses 'Tk' prefix consistently EXCEPT placeOrder() uses '$' signs (bug)
- main.recovery.js exists as a file — appears to be a backup/recovery copy of main.js

## Admin Architecture
- admin.js is aggressively minified (33 lines, each ~800-2000 chars) — hard to read/edit
- Admin violates the store.js rule: admin.js route queries Food, Order, User, etc. directly
- Admin auth check is done client-side in ensureAdminAccess() and server-side via requireAdmin middleware (double protection is good)

## Seed Data
- Only 1 restaurant exists in seed data (Pizzaburg / "FoodExpress Kitchen")
- Multi-restaurant UI is fully implemented and ready
- foods.json has 80+ items all with restaurant_id matching the single restaurant
