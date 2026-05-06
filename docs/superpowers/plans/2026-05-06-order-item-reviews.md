# Order Item Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow customers to rate and review individual food items in completed (delivered) orders, with inline star picker + comment box per item, editable after submission.

**Architecture:** `order_id: String` added to the Review model enables per-order-per-item uniqueness. `listOrders` embeds reviews in delivered order responses (one extra DB query, not N). Frontend builds review UI inline in the history order card; star/save handlers attached after render in `renderOrderHistoryCollection`.

**Tech Stack:** Node.js/Express/MongoDB (Mongoose), Vanilla JS, CSS — no build step.

---

## File Map

| File | Change |
|------|--------|
| `backend/src/models/Review.js` | Add `order_id: String` field |
| `backend/src/store.js` | Add `serializeReview`, `getReviewsByOrder`, `upsertOrderReviews`; modify `listOrders` |
| `backend/src/routes/orders.js` | Import new store fns; add `POST /orders/:id/reviews/` |
| `frontend/assets/js/api.js` | Add `submitOrderReviews(orderId, reviews)` to `APIService` |
| `frontend/assets/css/orders.css` | Append `.order-review-section` styles |
| `frontend/assets/js/main.js` | Add `buildReviewSectionHTML`; modify `buildOrderCardHTML`; modify `renderOrderHistoryCollection` |

---

## Task 1: Review Model + Store Functions

**Files:**
- Modify: `backend/src/models/Review.js`
- Modify: `backend/src/store.js`

- [ ] **Step 1.1 — Add `order_id` to Review schema**

Open `backend/src/models/Review.js`. Replace the entire file with:

```javascript
import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    review_id: { type: Number, required: true, unique: true, index: true },
    user_id: { type: Number, required: true, index: true },
    order_id: { type: String, index: true },
    restaurant_id: { type: Number },
    food_id: { type: Number },
    rating: { type: Number, default: 0 },
    comment: { type: String, default: '' }
  },
  { timestamps: true }
);

export const Review = mongoose.model('Review', reviewSchema);
```

- [ ] **Step 1.2 — Add `serializeReview` to store.js**

Open `backend/src/store.js`. Find the `serializeOrder` function (line ~91). Directly **above** it, insert this new function:

```javascript
function serializeReview(review) {
  return {
    review_id: review.review_id,
    food_id: review.food_id,
    order_id: review.order_id,
    rating: review.rating,
    comment: review.comment,
    created_at: review.createdAt,
    updated_at: review.updatedAt
  };
}
```

- [ ] **Step 1.3 — Add `getReviewsByOrder` to store.js**

In `backend/src/store.js`, find the `addReview` export function (line ~323). Directly **above** it, insert:

```javascript
export async function getReviewsByOrder(userId, orderId) {
  const reviews = await Review.find({
    user_id: Number(userId),
    order_id: String(orderId)
  }).lean();
  return reviews.map(serializeReview);
}
```

- [ ] **Step 1.4 — Add `upsertOrderReviews` to store.js**

Directly **below** `getReviewsByOrder`, insert:

```javascript
export async function upsertOrderReviews(userId, orderId, reviews) {
  const order = await Order.findOne({
    order_id: String(orderId),
    user_id: Number(userId)
  }).lean();

  if (!order) {
    const err = new Error('Order not found');
    err.status = 404;
    throw err;
  }
  if (order.status !== 'delivered') {
    const err = new Error('Can only review delivered orders');
    err.status = 400;
    throw err;
  }

  const results = [];
  for (const item of reviews) {
    const ratingNum = Number(item.rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      const err = new Error('rating must be an integer between 1 and 5');
      err.status = 422;
      throw err;
    }

    const existing = await Review.findOne({
      user_id: Number(userId),
      order_id: String(orderId),
      food_id: Number(item.food_id)
    });

    if (existing) {
      existing.rating = ratingNum;
      existing.comment = item.comment || '';
      await existing.save();
      results.push(serializeReview(existing));
    } else {
      const created = await Review.create({
        review_id: await getNextSequence('reviews'),
        user_id: Number(userId),
        order_id: String(orderId),
        food_id: Number(item.food_id),
        rating: ratingNum,
        comment: item.comment || ''
      });
      results.push(serializeReview(created));
    }
  }

  return { reviews: results };
}
```

- [ ] **Step 1.5 — Modify `listOrders` to embed reviews for delivered orders**

Find `listOrders` in `backend/src/store.js` (line ~372). Replace it entirely with:

```javascript
export async function listOrders(userId) {
  const results = await Order.find({ user_id: Number(userId) }).sort({ createdAt: -1 }).lean();

  const deliveredIds = results
    .filter(o => o.status === 'delivered')
    .map(o => o.order_id);

  const reviewsByOrder = {};
  if (deliveredIds.length > 0) {
    const allReviews = await Review.find({
      user_id: Number(userId),
      order_id: { $in: deliveredIds }
    }).lean();
    allReviews.forEach(r => {
      if (!reviewsByOrder[r.order_id]) reviewsByOrder[r.order_id] = [];
      reviewsByOrder[r.order_id].push(serializeReview(r));
    });
  }

  return {
    count: results.length,
    results: results.map(order => ({
      ...serializeOrder(order),
      reviews: reviewsByOrder[order.order_id] || []
    }))
  };
}
```

- [ ] **Step 1.6 — Verify backend starts without errors**

```bash
cd backend && npm run dev
```

Expected: Server starts on port 5000, no import or schema errors in console.

- [ ] **Step 1.7 — Commit**

```bash
git add backend/src/models/Review.js backend/src/store.js
git commit -m "feat: add order_id to Review model and add order review store functions"
```

---

## Task 2: Orders Route

**Files:**
- Modify: `backend/src/routes/orders.js`

- [ ] **Step 2.1 — Import new store functions**

Open `backend/src/routes/orders.js`. The current import block (lines 1–10) is:

```javascript
import { Router } from 'express';
import {
  createOrder,
  deleteOrderById,
  getCart,
  getOrderById,
  listOrders,
  saveCart,
  validatePromoCode
} from '../data/store.js';
import { requireAuth } from '../middleware/auth.js';
```

Replace it with:

```javascript
import { Router } from 'express';
import {
  createOrder,
  deleteOrderById,
  getCart,
  getOrderById,
  listOrders,
  saveCart,
  upsertOrderReviews,
  validatePromoCode
} from '../data/store.js';
import { requireAuth } from '../middleware/auth.js';
```

- [ ] **Step 2.2 — Add POST /orders/:id/reviews/ route**

In `backend/src/routes/orders.js`, find the `router.delete('/orders/:id/', ...)` block (line ~64). Insert the following **after** it, before `export default router;`:

```javascript
router.post('/orders/:id/reviews/', requireAuth, async (req, res, next) => {
  try {
    const { reviews } = req.body;
    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ error: 'reviews must be a non-empty array' });
    }
    const result = await upsertOrderReviews(req.user.user_id, req.params.id, reviews);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 2.3 — Verify route with curl**

With the backend running, mark an order as delivered via MongoDB (or use the existing seed data). Then:

```bash
curl -s -X POST http://localhost:5000/api/orders/orders/<ORDER_UUID>/reviews/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"reviews":[{"food_id":1,"rating":4,"comment":"Great!"}]}'
```

Expected: JSON response `{ "reviews": [{ "review_id": ..., "food_id": 1, "rating": 4, "comment": "Great!" }] }`

- [ ] **Step 2.4 — Commit**

```bash
git add backend/src/routes/orders.js
git commit -m "feat: add POST /orders/:id/reviews/ route for order item reviews"
```

---

## Task 3: Frontend API Method

**Files:**
- Modify: `frontend/assets/js/api.js`

- [ ] **Step 3.1 — Add `submitOrderReviews` to APIService**

Open `frontend/assets/js/api.js`. Find the `createReview` method in the `APIService` class. Directly **after** it, insert:

```javascript
async submitOrderReviews(orderId, reviews) {
    return this.request(`/orders/orders/${orderId}/reviews/`, {
        method: 'POST',
        body: JSON.stringify({ reviews })
    });
}
```

- [ ] **Step 3.2 — Commit**

```bash
git add frontend/assets/js/api.js
git commit -m "feat: add submitOrderReviews method to APIService"
```

---

## Task 4: Review Section CSS

**Files:**
- Modify: `frontend/assets/css/orders.css`

- [ ] **Step 4.1 — Append review section styles**

Open `frontend/assets/css/orders.css`. At the very end of the file (after line 315), append:

```css

/* ── Order Review Section ───────────────────────────────── */
.order-review-section {
    border-top: 1px solid rgba(255, 255, 255, 0.07);
    margin-top: 16px;
    padding-top: 16px;
}

.review-section-header {
    margin-bottom: 12px;
}

.review-section-title {
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(237, 232, 227, 0.45);
}

.review-items-list {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.review-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.review-item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
}

.review-item-name {
    font-size: 0.88rem;
    font-weight: 500;
    color: rgba(237, 232, 227, 0.8);
    min-width: 0;
    flex: 1;
}

.star-picker {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
}

.star-btn {
    background: none;
    border: none;
    font-size: 1.35rem;
    line-height: 1;
    padding: 2px;
    cursor: pointer;
    color: rgba(237, 232, 227, 0.2);
    transition: color 0.15s ease, transform 0.1s ease;
}

.star-btn:hover,
.star-btn.filled {
    color: #e85c2c;
}

.star-btn:active {
    transform: scale(0.88);
}

.review-comment {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    color: rgba(237, 232, 227, 0.8);
    font-family: 'Inter', sans-serif;
    font-size: 0.85rem;
    padding: 8px 12px;
    resize: vertical;
    min-height: 40px;
    transition: border-color 0.2s;
}

.review-comment:focus {
    outline: none;
    border-color: rgba(232, 92, 44, 0.35);
}

.review-comment::placeholder {
    color: rgba(237, 232, 227, 0.25);
}

.review-section-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
}

.save-reviews-btn {
    font-size: 0.85rem !important;
    padding: 8px 20px !important;
}

.save-reviews-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none !important;
}
```

- [ ] **Step 4.2 — Commit**

```bash
git add frontend/assets/css/orders.css
git commit -m "feat: add order review section styles to orders.css"
```

---

## Task 5: Review Section HTML in Order Card

**Files:**
- Modify: `frontend/assets/js/main.js`

- [ ] **Step 5.1 — Add `buildReviewSectionHTML` helper**

Open `frontend/assets/js/main.js`. Find the `buildOrderCardHTML` function (line ~1392). Directly **above** it, insert this new helper function:

```javascript
function buildReviewSectionHTML(order) {
    const items = Array.isArray(order.items) ? order.items : [];
    const existingReviews = Array.isArray(order.reviews) ? order.reviews : [];
    const hasExistingReviews = existingReviews.length > 0;

    const reviewItemsHTML = items.map(item => {
        const existing = existingReviews.find(r => Number(r.food_id) === Number(item.id));
        const selectedRating = existing ? Number(existing.rating) : 0;
        const starsHTML = [1, 2, 3, 4, 5].map(val =>
            `<button class="star-btn${selectedRating >= val ? ' filled' : ''}" data-value="${val}" type="button" aria-label="${val} star${val > 1 ? 's' : ''}">★</button>`
        ).join('');

        return `
            <div class="review-item" data-food-id="${item.id}" data-review-id="${existing ? existing.review_id : ''}">
                <div class="review-item-header">
                    <span class="review-item-name">${item.name}</span>
                    <div class="star-picker" data-selected="${selectedRating}">${starsHTML}</div>
                </div>
                <textarea class="review-comment" placeholder="Add a comment (optional)" rows="2">${existing ? (existing.comment || '') : ''}</textarea>
            </div>
        `;
    }).join('');

    return `
        <div class="order-review-section">
            <div class="review-section-header">
                <span class="review-section-title">Rate your items</span>
            </div>
            <div class="review-items-list">${reviewItemsHTML}</div>
            <div class="review-section-footer">
                <button class="btn btn-primary save-reviews-btn"
                        data-order-id="${order.id}"
                        ${hasExistingReviews ? '' : 'disabled'}
                        type="button">
                    ${hasExistingReviews ? 'Update Reviews' : 'Save Reviews'}
                </button>
            </div>
        </div>
    `;
}
```

- [ ] **Step 5.2 — Call `buildReviewSectionHTML` inside `buildOrderCardHTML`**

In `buildOrderCardHTML` (line ~1392), find the closing `</article>` tag at the end of the returned template string. It looks like:

```javascript
            <div class="order-actions">
                <button class="btn btn-outline reorder-btn" data-order-id="${order.id}"><i class="fas fa-redo"></i> Reorder</button>
                ${allowDelete ? `<button class="btn btn-outline delete-history-btn" data-order-id="${order.id}" type="button"><i class="fas fa-trash"></i> Delete</button>` : ''}
                <button class="btn btn-outline" type="button"><i class="fas fa-location-dot"></i> Details</button>
            </div>
        </article>
```

Replace it with:

```javascript
            <div class="order-actions">
                <button class="btn btn-outline reorder-btn" data-order-id="${order.id}"><i class="fas fa-redo"></i> Reorder</button>
                ${allowDelete ? `<button class="btn btn-outline delete-history-btn" data-order-id="${order.id}" type="button"><i class="fas fa-trash"></i> Delete</button>` : ''}
                <button class="btn btn-outline" type="button"><i class="fas fa-location-dot"></i> Details</button>
            </div>
            ${order.status === 'delivered' ? buildReviewSectionHTML(order) : ''}
        </article>
```

- [ ] **Step 5.3 — Check `normalizeOrderForUI` preserves `reviews`**

In `main.js`, search for `normalizeOrderForUI`. Read the function body. If it builds a new object with explicit fields (e.g., `return { id: order.id, status: order.status, ... }`), add `reviews: order.reviews || []` to that object. If it spreads the order (e.g., `return { ...order, ... }`), the `reviews` field is already preserved — no change needed.

- [ ] **Step 5.4 — Commit**

```bash
git add frontend/assets/js/main.js
git commit -m "feat: add review section HTML to delivered order cards"
```

---

## Task 6: Star Interaction + Save Handler

**Files:**
- Modify: `frontend/assets/js/main.js`

- [ ] **Step 6.1 — Add star + save handlers in `renderOrderHistoryCollection`**

In `main.js`, find `renderOrderHistoryCollection` (line ~1525). After the existing `historyList.querySelectorAll('.delete-history-btn')...` block (after its closing `});`), insert the following two blocks:

```javascript
    // ── Star picker interaction ─────────────────────────────
    historyList.querySelectorAll('.star-picker').forEach(picker => {
        const stars = Array.from(picker.querySelectorAll('.star-btn'));

        function applyStarState(upTo) {
            stars.forEach(s => {
                const val = Number(s.dataset.value);
                s.classList.toggle('filled', val <= upTo);
            });
        }

        stars.forEach(star => {
            star.addEventListener('mouseenter', () => {
                applyStarState(Number(star.dataset.value));
            });
        });

        picker.addEventListener('mouseleave', () => {
            applyStarState(Number(picker.dataset.selected || 0));
        });

        stars.forEach(star => {
            star.addEventListener('click', () => {
                const val = Number(star.dataset.value);
                picker.dataset.selected = val;
                applyStarState(val);
                const saveBtn = picker.closest('.order-card')?.querySelector('.save-reviews-btn');
                if (saveBtn) saveBtn.disabled = false;
            });
        });
    });

    // ── Save reviews handler ────────────────────────────────
    historyList.querySelectorAll('.save-reviews-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const orderId = btn.dataset.orderId;
            const card = btn.closest('.order-card');
            if (!card) return;

            const reviewItems = card.querySelectorAll('.review-item');
            const reviews = [];
            reviewItems.forEach(item => {
                const foodId = Number(item.dataset.foodId);
                const picker = item.querySelector('.star-picker');
                const rating = Number(picker?.dataset.selected || 0);
                const comment = (item.querySelector('.review-comment')?.value || '').trim();
                if (rating > 0) {
                    reviews.push({ food_id: foodId, rating, comment });
                }
            });

            if (reviews.length === 0) {
                showNotification('Please rate at least one item', 'warning');
                return;
            }

            const originalLabel = btn.textContent.trim();
            btn.disabled = true;
            btn.textContent = 'Saving…';

            try {
                await api.submitOrderReviews(orderId, reviews);
                showNotification('Reviews saved!', 'success');
                btn.textContent = 'Update Reviews';
                btn.disabled = false;
            } catch (error) {
                showNotification(error.message || 'Failed to save reviews', 'error');
                btn.textContent = originalLabel;
                btn.disabled = false;
            }
        });
    });
```

- [ ] **Step 6.2 — Verify `api` variable has `submitOrderReviews`**

In `main.js`, find where the `api` variable is declared (search for `const api` or `let api` or `window.api`). Confirm it refers to the `APIService` instance (`window.API.service` or `dataService`). The `submitOrderReviews` method added in Task 3 will be available on it.

- [ ] **Step 6.3 — Manual end-to-end test**

1. Start backend: `cd backend && npm run dev`
2. Serve frontend: `cd frontend && python -m http.server 5500`
3. Log in as a customer who has a delivered order
4. Navigate to `http://localhost:5500/pages/orders.html`
5. Scroll to order history — delivered order cards should show "Rate your items" section
6. Click stars on one or more items — stars should fill orange, Save button should enable
7. Type a comment in the textarea
8. Click "Save Reviews" — expect "Reviews saved!" notification, button changes to "Update Reviews"
9. Refresh the page — stars and comments should pre-populate from saved data
10. Change a star rating and click "Update Reviews" — should save updated values

- [ ] **Step 6.4 — Commit and push**

```bash
git add frontend/assets/js/main.js
git commit -m "feat: add star interaction and save handler for order item reviews"
git push
```
