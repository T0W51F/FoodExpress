# FoodExpress

FoodExpress is a full-stack food delivery platform built as a monorepo with a Node.js/Express/MongoDB backend and a vanilla HTML/CSS/JavaScript frontend.

---

## 🚀 Live Demo

- 🌐 Frontend: https://foodexpress-five.vercel.app/pages/index.html   

---



## 💡 Project Overview

FoodExpress is a scalable food delivery system that supports:

- Customer food ordering  
- Restaurant management  
- Admin control panel  
- Partner onboarding system  

The backend exposes a RESTful API (`/api`) while the frontend is served as a static multi-page application.

---

## ✨ Key Features

### 👤 User Features
- User registration & login  
- JWT-based authentication (access + refresh tokens)  
- Profile management  
- Cart system (save/load)  
- Order placement & history  
- Review & rating system  

### 🍽️ Restaurant Features
- Restaurant listing & search  
- Menu browsing by category  
- Featured restaurants  

### 🛒 Order System
- Add to cart  
- Checkout flow  
- Promotion code validation  
- Order tracking (basic)  

### 🤝 Partner System
- Restaurant partner application  
- Partner dashboard  
- Application status tracking  

### 🛠️ Admin System
- Admin & superadmin dashboards  
- Manage:
  - Restaurants  
  - Orders  
  - Promotions  
  - Categories  
  - Users  
  - Partner applications  

- Role-based access control:
  - `customer`  
  - `restaurant_admin`  
  - `admin`  
  - `superadmin`  

---

## 🛠️ Tech Stack

### Backend
- Node.js  
- Express.js  
- MongoDB + Mongoose  
- JWT (Authentication)  
- bcryptjs  

### Frontend
- HTML5  
- CSS3  
- Vanilla JavaScript  

### DevOps
- Docker  
- Docker Compose  
- Nginx (frontend serving)  

---



## Installation

1. Clone the repository:
   ```bash
   git clone [https://github.com/T0W51F/FoodExpress/]
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
