# Order Item Reviews — Design Spec
**Date:** 2026-05-06
**Status:** Approved

## Overview

Allow customers to rate and review individual food items in completed (delivered) orders. Ratings are 1–5 stars with an optional text comment. Reviews are editable after submission. The UI lives inline inside the delivered order card on the orders page.

---

## Data Layer

### Review Model (`backend/src/models/Review.js`)

Add one new field:
```js
order_id: { type: Number, index: true }
```

Upsert uniqueness key: `user_id + order_id + food_id` — ensures one review per item per order, independent across multiple orders of the same food.

Existing fields retained: `review_id`, `user_id`, `restaurant_id`, `food_id`, `rating` (1–5), `comment`, `createdAt`, `updatedAt`.

### store.js — New / Modified Functions

**`upsertOrderReviews(userId, orderId, reviews[])`**
- Input: `reviews` = array of `{ food_id, rating, comment }`
- For each item: `Review.findOneAndUpdate({ user_id, order_id, food_id }, payload, { upsert: true, new: true })`
- Skips items with no rating provided
- Returns array of upserted review documents

**`getReviewsByOrder(userId, orderId)`**
- Finds all Review documents matching `user_id + order_id`
- Returns array of serialized reviews: `{ review_id, food_id, rating, comment }`

**`listOrders(userId)` — modified**
- After fetching delivered orders, calls `getReviewsByOrder` for each
- Attaches result as `order.reviews` in the serialized order
- Active/cancelled orders get `reviews: []`

### Review serializer
```js
{ review_id, food_id, rating, comment, created_at, updated_at }
```

---

## API

### New Route — `orders.js`

**`POST /orders/:id/reviews/`**
- Auth: `requireAuth`
- Guard: order must belong to `req.user.id`, status must be `'delivered'`
- Body: `{ reviews: [{ food_id, rating, comment }] }`
- Validates: `rating` is integer 1–5 for each item provided
- Calls: `store.upsertOrderReviews(userId, orderId, reviews)`
- Returns: `{ reviews: [...] }` (upserted)
- Errors: 403 if wrong user, 400 if not delivered, 422 if rating out of range

No separate GET endpoint — reviews are embedded in `listOrders` response.

---

## Frontend

### `buildOrderCardHTML(order, options)` — `main.js`

For orders where `order.status === 'delivered'`, append a review section after the items list. The section is always visible (not hidden behind a button).

**Review section HTML structure:**
```html
<div class="order-review-section">
  <div class="review-section-header">
    <h4>Rate your items</h4>
  </div>
  <div class="review-items-list">
    <!-- one per order item -->
    <div class="review-item" data-food-id="${item.id}" data-review-id="${existingReview?.review_id || ''}">
      <span class="review-item-name">${item.name}</span>
      <div class="star-picker" data-selected="${existingReview?.rating || 0}">
        <button class="star-btn" data-value="1" type="button">★</button>
        <button class="star-btn" data-value="2" type="button">★</button>
        <button class="star-btn" data-value="3" type="button">★</button>
        <button class="star-btn" data-value="4" type="button">★</button>
        <button class="star-btn" data-value="5" type="button">★</button>
      </div>
      <textarea class="review-comment" placeholder="Add a comment (optional)">${existingReview?.comment || ''}</textarea>
    </div>
  </div>
  <button class="btn btn-primary save-reviews-btn" data-order-id="${order.id}" disabled>
    ${hasExistingReviews ? 'Update Reviews' : 'Save Reviews'}
  </button>
</div>
```

### Star Interaction — `main.js`

Event delegation on `#orders-history-list`:
- **hover** `.star-btn`: highlight all stars ≤ hovered value (preview)
- **mouseleave** `.star-picker`: revert to selected state
- **click** `.star-btn`: set `data-selected` on parent `.star-picker`, enable Save button
- Stars with index ≤ selected value get class `filled` (orange), rest get `empty` (outline)

### Save Handler — `main.js`

On click `.save-reviews-btn`:
1. Collect all `.review-item` elements in the card
2. For each: read `data-food-id`, `data-selected` from `.star-picker`, textarea value
3. Filter to only items where rating > 0
4. POST to `/orders/:id/reviews/` with `{ reviews: [...] }`
5. On success: show notification "Reviews saved!", change button text to "Update Reviews", store returned `review_id`s in `data-review-id` attributes
6. On error: show error notification

### Pre-population

When `order.reviews` is non-empty (existing reviews from `listOrders`), `buildOrderCardHTML` sets:
- `data-selected="${review.rating}"` on the `.star-picker`
- Star buttons get `filled` class pre-applied up to the rating value
- Textarea content set to `review.comment`
- Save button starts enabled, labelled "Update Reviews"

### `api.js` — new method

```js
async submitOrderReviews(orderId, reviews) {
  return this.request(`/orders/orders/${orderId}/reviews/`, {
    method: 'POST',
    body: JSON.stringify({ reviews })
  });
}
```

---

## Styles — `orders.css`

Scoped entirely to `.order-review-section`:

- Section has top border separator, `padding-top: 16px`, `margin-top: 16px`
- Header "Rate your items" in small caps, muted color
- Each `.review-item`: flex row — name left, stars center, textarea below (column for textarea)
- `.star-btn`: 1.4rem, default color `--text3`, cursor pointer, no background/border
- `.star-btn.filled`: color `#e85c2c` (FDP orange)
- `.star-picker:hover .star-btn` up to hovered: preview orange
- `.review-comment`: full width, dark surface background, 2 rows, resize vertical only
- `.save-reviews-btn`: right-aligned, width auto, margin-top 12px
- Button `disabled` state: reduced opacity, cursor not-allowed

---

## Constraints & Guards

- Review section only renders when `order.status === 'delivered'`
- Save button disabled until at least one star is clicked
- Backend rejects review POST if order is not delivered or doesn't belong to user
- `restaurant_admin` and `superadmin` roles cannot access orders page (already blocked)
- `food_id` in review matches items in `order.items` — no validation needed beyond what DB enforces

---

## Out of Scope

- Displaying reviews on restaurant/menu pages (separate feature)
- Aggregate rating display changes on food cards
- Admin moderation of reviews
