---
name: Partner Onboarding System
description: Full restaurant partner onboarding feature implemented in April 2026 — roles, models, routes, and frontend dashboards
type: project
---

Full restaurant partner onboarding system implemented 2026-04-11.

**Why:** Platform needed a self-service path for restaurants to join and manage their presence without requiring admin intervention for every menu change.

**New roles added to User model:**
- `restaurant_admin` — manages their own restaurant (menu, orders, profile)
- `superadmin` — approves/rejects partner applications, manages all restaurants

**New Mongoose model:** `PartnerApplication` in `backend/src/models/PartnerApplication.js`
- `application_id` auto-incremented via counters.js key `'applications'`
- Status enum: pending / approved / rejected

**Restaurant model changes:**
- Added `restricted` (Boolean, default false) — filters from public listings when true
- Added `description` (String) — for partner-created restaurants

**New backend routes:**
- `POST /api/partner/apply` — public, submit application
- `GET /api/partner/status/:email` — public, check status
- `GET|POST|PUT|DELETE /api/restaurant/*` — requireRestaurantAdmin middleware
- Superadmin routes added to `/api/admin/*` — requireSuperAdmin middleware

**Key store.js function:** `approveApplication(id)` — atomically creates Restaurant + User(restaurant_admin) + updates application, returns temp_password in response (shown once to superadmin).

**Middleware addition:** `requireRestaurantAdmin` (restaurant_admin or superadmin) and `requireSuperAdmin` in `backend/src/middleware/auth.js`

**admin.js router guard changed** from `router.use(requireAdmin)` to allow both `admin` and `superadmin` roles through, since superadmin needs access to application routes.

**Frontend pages:**
- `frontend/pages/partner-apply.html` + `partner-apply.css` — public application form + status check
- `frontend/pages/partner-dashboard.html` + `partner-dashboard.css` + `partner-dashboard.js` — restaurant admin dashboard (menu CRUD, orders, profile)
- `frontend/pages/superadmin.html` + `superadmin.css` + `superadmin.js` — superadmin dashboard (approve/reject apps, restrict/delete restaurants)

**Seed account:** `superadmin@fdp.com` / `superadmin123` added to `seedAdminBootstrapData()`

**How to apply:** Navigate to `partner-apply.html`, which is linked as "Partner with us" in nav of index.html, restaurants.html, menu.html.

**How to apply:** `cd backend && npm run seed` will create the superadmin account.
