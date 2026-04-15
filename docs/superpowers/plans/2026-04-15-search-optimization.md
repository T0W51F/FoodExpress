# Search Engine Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live autocomplete dropdown to the hero search on `index.html` and improve search ranking on `restaurants.html` with fuzzy matching and scored relevance.

**Architecture:** All logic is client-side in `main.js`. A `fuzzyMatch()` helper powers both the dropdown and the improved `scoreRestaurantMatch()` scorer. Data is fetched once and cached in `window.searchCache`. The dropdown is injected into the DOM by JS — no HTML changes needed.

**Tech Stack:** Vanilla JS, HTML, CSS. No libraries. No backend changes.

---

## File Map

| File | Change |
|---|---|
| `frontend/assets/js/main.js` | Add `fuzzyMatch()`, `scoreRestaurantMatch()`, `initSearchAutocomplete()`. Update `filterRestaurants()` to use scorer. Call `initSearchAutocomplete()` in `DOMContentLoaded`. |
| `frontend/assets/css/style.css` | Add `.search-suggestions` dropdown styles. Add `position: relative` to `.search-box`. |

---

## Task 1: Add `fuzzyMatch` and `scoreRestaurantMatch` helpers

**Files:**
- Modify: `frontend/assets/js/main.js` — insert after line 322 (after `restaurantMatchesSearch`)

- [ ] **Step 1: Add `fuzzyMatch` function**

Insert this block immediately after the closing brace of `restaurantMatchesSearch` (after line 322):

```javascript
// Returns true if all chars of query appear in target in order (case-insensitive)
function fuzzyMatch(query, target) {
    if (!query || !target) return false;
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
        if (t[i] === q[qi]) qi++;
    }
    return qi === q.length;
}
```

- [ ] **Step 2: Add `scoreRestaurantMatch` function**

Insert this block immediately after `fuzzyMatch`:

```javascript
// Returns a numeric relevance score for a restaurant against a query.
// Higher = better match. 0 = no match.
function scoreRestaurantMatch(restaurant, query, foods) {
    const q = query.toLowerCase().trim();
    if (!q) return 0;

    const name = (restaurant.name || '').toLowerCase();
    const cuisine = (restaurant.cuisine || '').toLowerCase();
    const serviceArea = (restaurant.service_area || '').toLowerCase();
    const categories = (restaurant.categories || []).map(c => c.toLowerCase());
    const restaurantFoods = (foods || []).filter(f => String(f.restaurant_id) === String(restaurant.id));

    let score = 0;

    // Name matches
    if (name === q) score += 100;
    else if (name.includes(q)) score += 80;
    else if (fuzzyMatch(q, name)) score += 20;

    // Cuisine / category matches
    if (cuisine === q || categories.includes(q)) score += 60;
    else if (cuisine.includes(q) || categories.some(c => c.includes(q))) score += 40;
    else if (fuzzyMatch(q, cuisine) || categories.some(c => fuzzyMatch(q, c))) score += 20;

    // Service area match
    if (serviceArea.includes(q)) score += 15;

    // Food item matches
    for (const food of restaurantFoods) {
        const fname = (food.name || '').toLowerCase();
        const fdesc = (food.description || '').toLowerCase();
        const fcat  = (food.category || '').toLowerCase();
        if (fname.includes(q)) { score += 40; break; }
        if (fcat.includes(q))  { score += 30; break; }
        if (fdesc.includes(q)) { score += 10; break; }
        if (fuzzyMatch(q, fname)) { score += 20; break; }
    }

    return score;
}
```

- [ ] **Step 3: Commit**

```bash
cd X:/FDP
git add frontend/assets/js/main.js
git commit -m "feat(search): add fuzzyMatch and scoreRestaurantMatch helpers"
```

---

## Task 2: Update `filterRestaurants` to use scoring

**Files:**
- Modify: `frontend/assets/js/main.js` — replace the search-filter block inside `filterRestaurants()` (lines ~553-556)

- [ ] **Step 1: Replace the filter block**

Find this exact block in `filterRestaurants()`:

```javascript
    const searchTerm = (DOM.restaurantSearch?.value || getRestaurantSearchTermFromUrl() || '').trim().toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(restaurant => restaurantMatchesSearch(restaurant, searchTerm));
    }
```

Replace it with:

```javascript
    const searchTerm = (DOM.restaurantSearch?.value || getRestaurantSearchTermFromUrl() || '').trim();
    if (searchTerm) {
        filtered = filtered
            .map(restaurant => ({
                restaurant,
                score: scoreRestaurantMatch(restaurant, searchTerm, window.allFoods || [])
            }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score || b.restaurant.rating - a.restaurant.rating)
            .map(({ restaurant }) => restaurant);
    }
```

- [ ] **Step 2: Verify on restaurants.html**

1. Start backend: `cd X:/FDP/backend && npm run dev`
2. Serve frontend: `cd X:/FDP/frontend && python -m http.server 5500`
3. Open `http://localhost:5500/pages/restaurants.html`
4. Type `"pizza"` in the search box → Pizzaburg should appear at top
5. Type `"burgr"` (typo) → should still find Pizzaburg via fuzzy
6. Type `"tehari"` → should find Peyari Tehari

- [ ] **Step 3: Commit**

```bash
cd X:/FDP
git add frontend/assets/js/main.js
git commit -m "feat(search): use scored ranking in filterRestaurants"
```

---

## Task 3: Add dropdown CSS

**Files:**
- Modify: `frontend/assets/css/style.css` — add after the `.search-box input:focus` block (after line 445)

- [ ] **Step 1: Add `position: relative` to `.search-box`**

Find:

```css
.search-box {
    display: flex;
    gap: 10px;
    margin-bottom: 2rem;
    max-width: 600px;
}
```

Replace with:

```css
.search-box {
    display: flex;
    gap: 10px;
    margin-bottom: 2rem;
    max-width: 600px;
    position: relative;
}
```

- [ ] **Step 2: Add dropdown styles**

Insert this block immediately after the `.search-box input:focus` rule (after line 445):

```css
/* Search autocomplete dropdown */
.search-suggestions {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: #1e2330;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: var(--radius-sm);
    box-shadow: 0 8px 32px rgba(0,0,0,0.45);
    z-index: 1000;
    overflow: hidden;
    max-height: 380px;
    overflow-y: auto;
}

.search-suggestions-section {
    padding: 6px 0;
    border-bottom: 1px solid rgba(255,255,255,0.07);
}

.search-suggestions-section:last-child {
    border-bottom: none;
}

.search-suggestions-label {
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.35);
    padding: 4px 14px 2px;
}

.search-suggestion-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    cursor: pointer;
    font-size: 0.92rem;
    color: rgba(255,255,255,0.85);
    transition: background 0.15s;
}

.search-suggestion-item:hover,
.search-suggestion-item.active {
    background: rgba(255,255,255,0.08);
    color: #fff;
}

.search-suggestion-item i {
    width: 16px;
    text-align: center;
    color: var(--primary-color);
    flex-shrink: 0;
}

.search-suggestion-sub {
    font-size: 0.78rem;
    color: rgba(255,255,255,0.4);
    margin-left: auto;
    white-space: nowrap;
}
```

- [ ] **Step 3: Commit**

```bash
cd X:/FDP
git add frontend/assets/css/style.css
git commit -m "feat(search): add autocomplete dropdown styles"
```

---

## Task 4: Implement `initSearchAutocomplete`

**Files:**
- Modify: `frontend/assets/js/main.js` — replace existing `initHeroSearch()` function (lines ~336-347)

- [ ] **Step 1: Replace `initHeroSearch` with full autocomplete implementation**

Find and replace the entire `initHeroSearch` function:

```javascript
function initHeroSearch() {
    if (!DOM.heroSearchForm || !DOM.heroSearchInput) return;
    DOM.heroSearchForm.addEventListener('submit', event => {
        event.preventDefault();
        const query = DOM.heroSearchInput.value.trim();
        const nextUrl = new URL('restaurants.html', window.location.href);
        if (query) {
            nextUrl.searchParams.set('search', query);
        }
        window.location.href = nextUrl.toString();
    });
}
```

Replace with:

```javascript
function initHeroSearch() {
    if (!DOM.heroSearchForm || !DOM.heroSearchInput) return;

    let suggestionsEl = null;
    let activeIndex = -1;
    let suggestionItems = [];

    // --- data cache ---
    async function getSearchCache() {
        if (window.searchCache) return window.searchCache;
        const [rRes, fRes] = await Promise.all([
            apiCall('/restaurants/restaurants/'),
            apiCall('/restaurants/foods/')
        ]);
        const [rData, fData] = await Promise.all([rRes.json(), fRes.json()]);
        const restaurants = rData.results || [];
        const foods = fData.results || fData || [];
        // Collect unique categories from all restaurants
        const categorySet = new Set();
        restaurants.forEach(r => {
            if (r.cuisine) categorySet.add(r.cuisine);
            (r.categories || []).forEach(c => categorySet.add(c));
        });
        window.searchCache = { restaurants, foods, categories: [...categorySet] };
        return window.searchCache;
    }

    // --- build suggestions ---
    function buildSuggestions(restaurants, foods, categories, query) {
        const q = query.toLowerCase();
        const matchStr = s => s && (s.toLowerCase().includes(q) || fuzzyMatch(q, s));

        const matchedRestaurants = restaurants
            .filter(r => matchStr(r.name) || matchStr(r.cuisine) || (r.categories || []).some(matchStr))
            .slice(0, 3);

        const matchedCategories = categories
            .filter(c => matchStr(c))
            .slice(0, 3);

        const matchedFoods = foods
            .filter(f => matchStr(f.name))
            .slice(0, 2);

        return { matchedRestaurants, matchedCategories, matchedFoods };
    }

    // --- render dropdown ---
    function renderDropdown(matchedRestaurants, matchedCategories, matchedFoods) {
        closeSuggestions();
        const total = matchedRestaurants.length + matchedCategories.length + matchedFoods.length;
        if (total === 0) return;

        suggestionsEl = document.createElement('div');
        suggestionsEl.className = 'search-suggestions';
        suggestionItems = [];

        function addSection(label, items, renderItem) {
            if (!items.length) return;
            const section = document.createElement('div');
            section.className = 'search-suggestions-section';
            const labelEl = document.createElement('div');
            labelEl.className = 'search-suggestions-label';
            labelEl.textContent = label;
            section.appendChild(labelEl);
            items.forEach(item => {
                const el = renderItem(item);
                el.classList.add('search-suggestion-item');
                el.setAttribute('role', 'option');
                section.appendChild(el);
                suggestionItems.push(el);
            });
            suggestionsEl.appendChild(section);
        }

        addSection('Restaurants', matchedRestaurants, r => {
            const el = document.createElement('div');
            el.innerHTML = `<i class="fas fa-utensils"></i><span>${r.name}</span><span class="search-suggestion-sub">${r.cuisine}</span>`;
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                window.location.href = `menu.html?restaurant_id=${r.id}`;
            });
            return el;
        });

        addSection('Categories', matchedCategories, cat => {
            const el = document.createElement('div');
            el.innerHTML = `<i class="fas fa-tag"></i><span>${cat}</span>`;
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                const url = new URL('restaurants.html', window.location.href);
                url.searchParams.set('cuisine', cat);
                window.location.href = url.toString();
            });
            return el;
        });

        addSection('Foods', matchedFoods, food => {
            const el = document.createElement('div');
            el.innerHTML = `<i class="fas fa-hamburger"></i><span>${food.name}</span>`;
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                const url = new URL('restaurants.html', window.location.href);
                url.searchParams.set('search', food.name);
                window.location.href = url.toString();
            });
            return el;
        });

        DOM.heroSearchForm.appendChild(suggestionsEl);
        activeIndex = -1;
    }

    function closeSuggestions() {
        if (suggestionsEl) {
            suggestionsEl.remove();
            suggestionsEl = null;
        }
        activeIndex = -1;
        suggestionItems = [];
    }

    function setActiveItem(index) {
        suggestionItems.forEach((el, i) => el.classList.toggle('active', i === index));
        activeIndex = index;
    }

    // --- debounce helper ---
    let debounceTimer;
    function debounceInput(fn, delay) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fn, delay);
    }

    // --- events ---
    DOM.heroSearchInput.addEventListener('input', () => {
        const query = DOM.heroSearchInput.value.trim();
        if (query.length < 2) { closeSuggestions(); return; }
        debounceInput(async () => {
            try {
                const { restaurants, foods, categories } = await getSearchCache();
                const { matchedRestaurants, matchedCategories, matchedFoods } =
                    buildSuggestions(restaurants, foods, categories, query);
                renderDropdown(matchedRestaurants, matchedCategories, matchedFoods);
            } catch (e) {
                console.error('Autocomplete error:', e);
            }
        }, 200);
    });

    DOM.heroSearchInput.addEventListener('keydown', e => {
        if (!suggestionsEl) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveItem(Math.min(activeIndex + 1, suggestionItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveItem(Math.max(activeIndex - 1, 0));
        } else if (e.key === 'Escape') {
            closeSuggestions();
        } else if (e.key === 'Enter' && activeIndex >= 0) {
            e.preventDefault();
            suggestionItems[activeIndex].dispatchEvent(new MouseEvent('mousedown'));
        }
    });

    DOM.heroSearchInput.addEventListener('blur', () => {
        // Small delay so mousedown on item fires first
        setTimeout(closeSuggestions, 150);
    });

    DOM.heroSearchForm.addEventListener('submit', event => {
        event.preventDefault();
        closeSuggestions();
        const query = DOM.heroSearchInput.value.trim();
        const nextUrl = new URL('restaurants.html', window.location.href);
        if (query) nextUrl.searchParams.set('search', query);
        window.location.href = nextUrl.toString();
    });

    document.addEventListener('click', e => {
        if (!DOM.heroSearchForm.contains(e.target)) closeSuggestions();
    });
}
```

- [ ] **Step 2: Commit**

```bash
cd X:/FDP
git add frontend/assets/js/main.js
git commit -m "feat(search): implement hero search autocomplete with fuzzy suggestions"
```

---

## Task 5: Wire up `initSearchAutocomplete` in `DOMContentLoaded` (index.html inline script)

**Files:**
- Modify: `frontend/pages/index.html` — inline `<script>` at bottom, add `initHeroSearch()` call

Note: `initHeroSearch()` already handles the `DOM.heroSearchForm` guard, so it's safe to call on every page. But on `index.html`, we need to ensure it's called.

- [ ] **Step 1: Check existing DOMContentLoaded in index.html**

The inline script in `index.html` (around line 259) calls `checkLoginStatus()`, `loadFeaturedRestaurants()`, `loadPopularFoods()`, `updateCartCount()`, and wires the hero form submit. The form submit listener in the inline script duplicates `initHeroSearch()`.

Find this block in `frontend/pages/index.html`:

```javascript
        const heroSearchForm = document.getElementById('hero-search-form');
        const heroSearchInput = document.getElementById('address-input');
        if (heroSearchForm && heroSearchInput) {
            heroSearchForm.addEventListener('submit', function(event) {
                event.preventDefault();
                const query = heroSearchInput.value.trim();
                const nextUrl = new URL('restaurants.html', window.location.href);
                if (query) {
                    nextUrl.searchParams.set('search', query);
                }
                window.location.href = nextUrl.toString();
            });
        }
```

Replace it with a single call:

```javascript
        initHeroSearch();
```

- [ ] **Step 2: Commit**

```bash
cd X:/FDP
git add frontend/pages/index.html
git commit -m "feat(search): wire initHeroSearch in index.html DOMContentLoaded"
```

---

## Task 6: Handle `?cuisine=` param on restaurants.html

The category suggestions navigate to `restaurants.html?cuisine=X`. Currently `filterRestaurants()` reads from `DOM.cuisineFilter` (a `<select>`), not from the URL. Add URL param support.

**Files:**
- Modify: `frontend/assets/js/main.js` — update `loadRestaurants()` to pre-select cuisine from URL

- [ ] **Step 1: Read `cuisine` param and pre-select the filter**

Find `loadRestaurants()`. It currently reads `initialSearch` from URL and sets the search input. Add cuisine param reading immediately after that block.

Find:

```javascript
        const initialSearch = getRestaurantSearchTermFromUrl();
        if (DOM.restaurantSearch && initialSearch) {
            DOM.restaurantSearch.value = initialSearch;
        }
```

Replace with:

```javascript
        const initialSearch = getRestaurantSearchTermFromUrl();
        if (DOM.restaurantSearch && initialSearch) {
            DOM.restaurantSearch.value = initialSearch;
        }

        const params = new URLSearchParams(window.location.search);
        const initialCuisine = params.get('cuisine') || '';
        if (DOM.cuisineFilter && initialCuisine) {
            // Try to select matching option; if not present, add it temporarily
            const existing = Array.from(DOM.cuisineFilter.options).find(
                o => o.value.toLowerCase() === initialCuisine.toLowerCase()
            );
            if (existing) {
                DOM.cuisineFilter.value = existing.value;
            } else {
                const opt = document.createElement('option');
                opt.value = initialCuisine;
                opt.textContent = initialCuisine;
                DOM.cuisineFilter.appendChild(opt);
                DOM.cuisineFilter.value = initialCuisine;
            }
        }
```

- [ ] **Step 2: Verify end-to-end**

1. Open `http://localhost:5500/pages/index.html`
2. Type `"pizza"` in hero search box
3. Dropdown should show Pizzaburg under Restaurants and Pizza under Categories
4. Click Pizzaburg → should navigate to `menu.html?restaurant_id=1`
5. Go back, click Pizza category → should navigate to `restaurants.html?cuisine=Pizza` and show only pizza restaurants
6. Type `"burgr"` → fuzzy should still show Pizzaburg
7. Press ↑↓ to navigate, Enter to select, Esc to close

- [ ] **Step 3: Commit**

```bash
cd X:/FDP
git add frontend/assets/js/main.js
git commit -m "feat(search): read cuisine URL param on restaurants.html"
```

---

## Self-Review Checklist (done)

- [x] Spec: autocomplete dropdown → Task 4
- [x] Spec: restaurant click → menu page → Task 4 (`menu.html?restaurant_id`)
- [x] Spec: category click → filtered restaurants → Task 4 + Task 6
- [x] Spec: food click → search results → Task 4
- [x] Spec: keyboard nav → Task 4
- [x] Spec: close on outside click + blur → Task 4
- [x] Spec: data cache `window.searchCache` → Task 4
- [x] Spec: fuzzy matching → Task 1
- [x] Spec: scored ranking on restaurants.html → Task 2
- [x] Spec: CSS for dropdown → Task 3
- [x] `fuzzyMatch` defined in Task 1, used in Tasks 2 and 4 — consistent name
- [x] `scoreRestaurantMatch` defined in Task 1, called in Task 2 — consistent signature
- [x] No TBDs or placeholders
