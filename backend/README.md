# FDP Express Backend

This backend keeps the existing frontend contract and is prepared for MongoDB with Mongoose.

## Run

1. Install dependencies:
   npm install
2. Copy .env.example to .env
3. Start MongoDB locally
4. Seed restaurant and food data:
   npm run seed
5. Start the server:
   npm run dev

Default API base URL:
http://localhost:5000/api

## Notes

- Auth, carts, orders, reviews, restaurants, and foods use MongoDB models.
- The seed script loads restaurants and foods from X:/FDP/frontend/data.
- The frontend API contract remains the same as the existing pages and scripts expect.
