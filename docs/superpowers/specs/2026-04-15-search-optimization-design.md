# Search Engine Optimization — Design Spec

**Date:** 2026-04-15  
**Scope:** `frontend/pages/index.html`, `frontend/assets/js/main.js`  
**Approach:** Pure client-side, no backend changes

---

## Overview

Enhance the hero search box on `index.html` with a live autocomplete dropdown, and improve search result ranking on `restaurants.html` with fuzzy matching and scored relevance.

---

## Feature 1: Hero Search Autocomplete Dropdown

### Trigger
- Fires on `input` event, debounced 200ms
- Minimum 2 characters before showing suggestions

### Data
- Fetch all restaurants + foods once on first keystroke
- Cache in `window.searchCache = { restaurants, foods, categories }`
- Subsequent keystrokes use cache (no repeated API calls)
- API calls: `GET /restaurants/restaurants/` and `GET /restaurants/foods/`

### Dropdown Structure
- Appended as a sibling `<div class="search-suggestions">` inside `.search-box`
- Positioned absolute below the input
- Max 8 total suggestions, grouped into up to 3 sections:
  - **Restaurants** (max 3) — matched by name, cuisine, service_area, categories
  - **Categories** (max 3) — unique cuisine/category values matched by query
  - **Foods** (max 2) — matched food items by name

### Click Behavior
| Suggestion type | Action |
|---|---|
| Restaurant | `window.location.href = menu.html?restaurant_id=X` |
| Category | `window.location.href = restaurants.html?cuisine=X` |
| Food | `window.location.href = restaurants.html?search=X` |

### Keyboard Navigation
- `↑` / `↓` — move active item
- `Enter` — navigate to active item (or submit form if none active)
- `Esc` — close dropdown
- Click outside — close dropdown

### Styling
- Dropdown styled in existing `style.css` (dark theme consistent with site)
- Active item highlighted with accent color
- Section headers in muted color
- No external libraries

---

## Feature 2: Improved Search Ranking on restaurants.html

### Fuzzy Matching
Replace the current `includes()` check with a subsequence matcher:
- Query characters must appear in order within the target string
- Case-insensitive
- Example: `"burgr"` matches `"Burger"` ✓, `"bgr"` matches `"Burger"` ✓

### Scoring System
`scoreRestaurantMatch(restaurant, query, allFoods)` returns a numeric score:

| Match condition | Score |
|---|---|
| Exact name match (case-insensitive) | 100 |
| Name contains query as substring | 80 |
| Cuisine or category exact match | 60 |
| Food name contains query | 40 |
| Fuzzy match on name/cuisine/category | 20 |
| Food description contains query | 10 |

- Multiple conditions can stack (a restaurant can score 80 + 40 = 120)
- Ties broken by `restaurant.rating` descending

### Integration
- `filterRestaurants()` replaces `restaurantMatchesSearch()` call with score-based filter
- Restaurants with score > 0 are kept, sorted by score desc then rating desc
- Existing cuisine filter + sort filter still work (applied after search filter)

---

## Implementation Scope

### Files changed
- `frontend/assets/js/main.js` — add `initSearchAutocomplete()`, `scoreRestaurantMatch()`, `fuzzyMatch()`, update `filterRestaurants()`
- `frontend/pages/index.html` — no structural changes needed (dropdown injected by JS)
- `frontend/assets/css/style.css` — add `.search-suggestions` styles

### Files NOT changed
- Backend routes, models, store.js — no changes
- `restaurants.html` — no structural changes

---

## Out of Scope
- Server-side search endpoint
- Full-text search index (MongoDB)
- Search analytics / query logging
- Pagination of suggestions
- Mobile-specific suggestion UI (responsive via existing CSS)
