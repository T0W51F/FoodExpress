# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FDP is a full-stack food delivery platform (similar to UberEats/DoorDash). Monorepo:
- **Backend**: Node.js + Express + MongoDB (Mongoose ODM)
- **Frontend**: Vanilla JavaScript + HTML/CSS (no framework, no build step)

## Development Commands

```bash
# Backend
cd backend && npm run dev     # http://localhost:5000/api
npm run seed                  # seed DB from frontend/data/

# Frontend
python -m http.server 5500    # serve frontend/ on port 5500
```

Environment: copy `backend/.env.example` → `backend/.env` (PORT=5000, MONGODB_URI, JWT secrets, FRONTEND_ORIGIN).

## Architecture

### Backend (`backend/src/`)
- `store.js` — central data layer; all routes call this, never query models directly
- `counters.js` — auto-increment integer IDs (`getNextId(key)`)
- `formatters.js` — serializes Mongoose docs; never send raw docs to client
- `middleware/auth.js` — `requireAuth`, `requireAdmin`, `requireRestaurantAdmin`
- Routes: `auth.js`, `restaurants.js`, `orders.js`, `admin.js`, `partner.js`, `restaurant-admin.js`

### Authentication
- Access token: 1-day JWT in `Authorization: Bearer` header
- Refresh token: 7-day JWT in MongoDB `RefreshToken` collection

### Frontend Structure
```
pages/         index.html, menu.html, restaurants.html, cart.html, orders.html,
               login.html, register.html, settings.html, partner-apply.html,
               partner-dashboard.html, superadmin.html
assets/js/     api.js, main.js, auth.js, cart.js, partner-dashboard.js,
               superadmin.js, settings.js
assets/css/    per-page CSS + add-to-cart.css (modal, scoped to body.site-dark)
images/foods/  food images + delivery-hero.jpg/1/2/3/4 (hero slideshow)
```

## Key Design Decisions
- Integer IDs over ObjectIds (Counter model tracks sequences)
- Cart in localStorage, synced to backend at checkout only
- Shared delivery pool across all restaurant admins
- No test suite or linter configured

## Role Hierarchy
- `user` → `restaurant_admin` → `superadmin`
- `admin` role retired — do not recreate

Default seed credentials:
- `admin@pizzaburg.com` / `Admin123!`
- `admin@peyaritehari.com` / `Admin123!`
- `superadmin@fdp.com` / `superadmin123`

## UI Overhaul Status (2026-04-30)

All pages use **Space Grotesk** (headings) + **Inter** (body). Dark OLED theme, FDP orange `#e85c2c`.

### Fully Overhauled (self-contained inline CSS, no style.css dependency)
| Page | Notes |
|------|-------|
| `index.html` | Hero slideshow (5 images), scroll animations, card glow, search |
| `menu.html` | Category strip sticky, food grid, scroll offset = 130px in main.js |
| `orders.html` | Glass cards, fixed navbar padding-top fix |
| `restaurants.html` | Inline CSS navbar |
| `cart.html` | Inline CSS navbar + checkout modal |
| `partner-dashboard.html` | 9-tab sidebar dashboard |
| `superadmin.html` | Stats, tabs, modals |

### Still on style.css
`login.html`, `register.html`, `settings.html`, `partner-apply.html`

### Shared CSS
- `add-to-cart.css` — fully redesigned frosted glass modal (scoped `body.site-dark`)
- `style.css` — `.site-dark .navbar` synced to `rgba(6,7,10,0.78)` + `blur(24px) saturate(180%)`

## Navbar Standard (all pages)
```css
background: rgba(6,7,10,0.78);
backdrop-filter: blur(24px) saturate(180%);
border-bottom: 1px solid rgba(255,255,255,0.07);
height: 68px;
```
- Fixed pages (orders, restaurants, cart): `position: fixed` + padding-top compensation
- menu.html: `position: sticky` (category strip requires it)
- style.css pages: `position: sticky` via `.site-dark .navbar`

## menu.html Scroll Sync
- Navbar = 68px, category strip = 54px → total sticky = 122px
- `stickyOffset = 130` in `main.js` lines 946 + 1023 (gives breathing room)
- `scroll-margin-top: 130px` on `.menu-section`

## Search (index.html + restaurants.html)
Client-side only. `initHeroSearch` in `main.js` — dropdown appended to `body`, `position:fixed`, repositioned on scroll/resize. `scoreRestaurantMatch()` for ranked results.

## Superadmin Features
**Built**: partner approval/rejection, restaurant restrict/delete, user ban/unban/reset-password, platform analytics, audit log, global promotions, category management.
**Roadmap**: announcements, commission/billing config.

## Orange Top Strip — REMOVED
Do not re-add `::before { height:2px; background: gradient orange }` to:
stat cards, summary cards, modals in `partner-dashboard.html` and `superadmin.html`.
