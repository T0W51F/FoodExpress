# FoodExpress

FoodExpress is a full-stack food delivery platform built as a monorepo with a Node.js/Express/MongoDB backend and a vanilla HTML/CSS/JavaScript frontend.

## Project Overview

FoodExpress provides restaurant discovery, menu browsing, cart and checkout flows, user authentication, order history, review submission, partner applications, and admin dashboards. The backend exposes a REST API under `/api/` and the frontend is served as a static site under `frontend/pages/`.

## Features

- User authentication with email/password registration and login
- JWT-based access and refresh tokens for session handling
- Profile view and update endpoints
- Restaurant listing, featured restaurants, category browsing, and restaurant search
- Menu item detail retrieval and restaurant-specific food menus
- Cart save/load sync for logged-in users
- Order creation, order history, and individual order retrieval
- Promotion code validation API route
- Review submission for authenticated users
- Partner application submission and status lookup
- Admin and superadmin dashboard support for restaurants, orders, promotions, categories, partner applications, users, and analytics
- Role-based access control for `customer`, `restaurant_admin`, `admin`, and `superadmin`
- Docker deployment with MongoDB, backend service, and frontend Nginx service
- Static frontend deploy-ready configuration via `frontend/vercel.json`

## Technologies Used

- Node.js
- Express
- MongoDB
- Mongoose
- JSON Web Tokens (JWT)
- bcryptjs
- dotenv
- cors
- nodemon
- Vanilla JavaScript
- HTML5
- CSS3
- Nginx (frontend container)
- Docker
- Docker Compose

## Folder Structure

```
FoodExpress/
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config.js
│   │   ├── database.js
│   │   ├── data/
│   │   │   └── store.js
│   │   ├── middleware/
│   │   │   └── auth.js
│   │   ├── models/
│   │   │   ├── AuditLog.js
│   │   │   ├── Cart.js
│   │   │   ├── Category.js
│   │   │   ├── Counter.js
n│   │   │   ├── DeliveryPerson.js
│   │   │   ├── Food.js
│   │   │   ├── GlobalPromotion.js
│   │   │   ├── Order.js
│   │   │   ├── PartnerApplication.js
│   │   │   ├── Promotion.js
│   │   │   ├── RefreshToken.js
│   │   │   ├── Restaurant.js
│   │   │   ├── Review.js
│   │   │   └── User.js
│   │   ├── routes/
│   │   │   ├── admin.js
│   │   │   ├── auth.js
│   │   │   ├── orders.js
│   │   │   ├── partner.js
│   │   │   ├── restaurant-admin.js
│   │   │   └── restaurants.js
│   │   ├── scripts/
│   │   │   └── seed.js
│   │   └── utils/
│   │       ├── counters.js
│   │       └── formatters.js
├── docker/
│   ├── backend.Dockerfile
│   ├── frontend.Dockerfile
│   ├── docker-compose.yml
│   └── nginx.conf
├── frontend/
│   ├── pages/
│   │   ├── about-us.html
│   │   ├── cart.html
│   │   ├── effects-demo.html
│   │   ├── help.html
│   │   ├── index.html
│   │   ├── ios.html
│   │   ├── login.html
│   │   ├── menu.html
│   │   ├── orders.html
│   │   ├── partner-apply.html
│   │   ├── partner-dashboard.html
│   │   ├── playstore.html
│   │   ├── privacy.html
│   │   ├── register.html
│   │   ├── restaurants.html
│   │   ├── safety.html
│   │   ├── settings.html
│   │   ├── superadmin.html
│   │   └── terms.html
│   ├── assets/
│   │   ├── css/
│   │   │   ├── add-to-cart.css
│   │   │   ├── auth.css
│   │   │   ├── cart.css
│   │   │   ├── checkout-modal.css
│   │   │   ├── login-redesign.css
│   │   │   ├── orders.css
│   │   │   ├── partner-apply.css
│   │   │   ├── partner-dashboard.css
│   │   │   ├── responsive.css
│   │   │   ├── settings.css
│   │   │   ├── style.css
│   │   │   └── superadmin.css
│   │   ├── images/
│   │   └── js/
│   │       ├── api.js
│   │       ├── auth.js
│   │       ├── cart.js
│   │       ├── main.js
│   │       ├── main.recovery.js
│   │       ├── partner-dashboard.js
│   │       ├── settings.js
│   │       └── superadmin.js
│   ├── data/
│   │   ├── foods.json
│   │   └── restaurants.json
│   └── vercel.json
├── images/
│   └── foods/
├── CLAUDE.md
└── CODEX.md
```

## Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd FoodExpress
   ```
2. Install backend dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Copy environment example:
   ```bash
   cp .env.example .env
   ```
4. Set up MongoDB and configure `backend/.env`.

## Local Setup

- Start MongoDB locally.
- Seed initial restaurant and food data from `frontend/data/`:
  ```bash
  cd backend
  npm run seed
  ```
- Start the backend server in development mode:
  ```bash
  npm run dev
  ```
- Serve frontend files locally from `frontend/`:
  ```bash
  cd frontend
  python -m http.server 5500
  ```
- Open the frontend in your browser at `http://localhost:5500/pages/index.html`.

## Docker Instructions

The repository includes a Docker Compose setup that launches MongoDB, the backend service, and the static frontend site.

- Build and run all services:
  ```bash
  docker compose up --build
  ```

- Services exposed:
  - Backend API: `http://localhost:5000`
  - Frontend: `http://localhost:5500`

- Docker assets:
  - `docker/docker-compose.yml`
  - `docker/backend.Dockerfile`
  - `docker/frontend.Dockerfile`
  - `docker/nginx.conf`

## Deployment

- The backend runs from `backend/src/server.js` and reads configuration from `backend/.env`.
- Frontend deployment is configured to redirect `/` to `frontend/pages/index.html` via `frontend/vercel.json`.
- In Docker deployment, `frontend/` is served by `nginx:alpine` and backend runs on `node:20-alpine`.

## Website Pages

The static frontend includes the following pages:

- `pages/index.html` — landing/home page
- `pages/menu.html` — restaurant menu browsing and categories
- `pages/restaurants.html` — restaurant discovery
- `pages/cart.html` — active cart and checkout flow
- `pages/orders.html` — customer order history
- `pages/login.html` — login view
- `pages/register.html` — registration page
- `pages/settings.html` — user account settings
- `pages/partner-apply.html` — restaurant partner application
- `pages/partner-dashboard.html` — restaurant admin dashboard
- `pages/superadmin.html` — superadmin management dashboard
- `pages/about-us.html`, `pages/help.html`, `pages/privacy.html`, `pages/terms.html`, `pages/safety.html`, `pages/ios.html`, `pages/playstore.html`, `pages/effects-demo.html`

## Future Scope

Based on the current codebase, the platform can be extended with:

- stronger frontend routing and SPA-style navigation
- full payment gateway integration beyond cash/credit inference
- richer restaurant-admin menu management workflows
- push notifications and delivery tracking
- unit/e2e tests for API and UI flows
- progressive web app or mobile app packaging

## Developer Information

- Backend entry point: `backend/src/server.js`
- Main Express app: `backend/src/app.js`
- Authentication middleware: `backend/src/middleware/auth.js`
- API data layer: `backend/src/data/store.js`
- Frontend static pages: `frontend/pages/`
- Frontend script entrypoints: `frontend/assets/js/`
- Frontend styles: `frontend/assets/css/`

> Note: This README is generated from the actual repository contents and reflects the current available backend routes, frontend pages, assets, and Docker deployment files.
