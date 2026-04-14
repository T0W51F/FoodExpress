---
name: Category Management Feature
description: Category management implemented 2026-04-13 — superadmin-managed categories replace free-text food category field
type: project
---

Category Management feature was fully implemented on 2026-04-13 as roadmap item #4.

**Why:** Centralized category control prevents free-text sprawl and gives restaurant admins a consistent taxonomy when adding food items.

**How to apply:** When working on food-related features, note that foods now carry both `category` (string, always set for backwards compat) and `category_id` (integer, nullable). Seeded/legacy foods have `category_id: null`. Always serialize both fields.

## Files added
- `backend/src/models/Category.js` — schema: `category_id`, `name`, `slug`, `active`, `created_at`

## Files modified
- `backend/src/models/Food.js` — added `category_id: Number` field (nullable)
- `backend/src/models/index.js` — exports Category
- `backend/src/utils/counters.js` — added `categories` sequence source
- `backend/src/utils/formatters.js` — added `serializeCategory()`
- `backend/src/data/store.js` — added `createCategory`, `listCategories`, `listActiveCategories`, `updateCategory`, `toggleCategory`, `deleteCategory`, `getCategoryFoodCount`; updated `createFood`/`updateFood` to accept `category_id`
- `backend/src/routes/admin.js` — added 5 superadmin routes under `/api/admin/superadmin/categories`
- `backend/src/routes/restaurants.js` — added public `GET /api/restaurants/categories/` (active only, no auth)
- `frontend/pages/superadmin.html` — added Categories tab button + full panel with create form and table
- `frontend/assets/js/superadmin.js` — added `loadCategories`, `submitCreateCategory`, `handleRenameCategory`, `handleToggleCategory`, `handleDeleteCategory`; wired tab; added audit log labels
- `frontend/pages/partner-dashboard.html` — category input changed from `<input>` to `<select>`
- `frontend/assets/js/partner-dashboard.js` — `populateCategoryDropdown()` fetches active categories; `openAddFoodModal`/`openEditFoodModal` made async; `saveFoodItem` sends `category_id`
- `frontend/assets/css/superadmin.css` — `.cat-*` CSS appended matching gp-* promo style patterns

## API summary
- `GET /api/admin/superadmin/categories` — all categories + foods_count (superadmin only)
- `POST /api/admin/superadmin/categories` — create; audit logged as `create_category`
- `PATCH /api/admin/superadmin/categories/:id` — rename
- `PATCH /api/admin/superadmin/categories/:id/toggle` — flip active
- `DELETE /api/admin/superadmin/categories/:id` — blocked if foods_count > 0; audit logged as `delete_category`
- `GET /api/restaurants/categories/` — active categories only, public, used by partner dashboard

## Backwards compatibility
Legacy foods (seeded before categories existed) have `category: "Pizza"`, `category_id: null`. The partner dashboard tries to match by name when editing such foods. The card display always falls back to `food.category || 'Uncategorized'`.
