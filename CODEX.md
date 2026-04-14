# FDP Project Context

## Project
- Root: `X:\FDP`
- Stack: static frontend + Node/Express backend + MongoDB
- Database URI: `mongodb://127.0.0.1:27017/fdp`

## Important Paths
- Frontend pages: `X:\FDP\frontend\pages`
- Frontend scripts: `X:\FDP\frontend\assets\js`
- Frontend styles: `X:\FDP\frontend\assets\css`
- Backend app: `X:\FDP\backend\src`
- Food images: `X:\FDP\frontend\assets\images\foods`
- Mirror image storage: `X:\FDP\images\foods`

## Admin Panel State
The admin panel was heavily refined and is now in a usable state.

### Menu Item Management
- Restaurant selector is hidden from the menu form.
- Category uses a normal styled `select`.
- Image field now works like this:
  - text input accepts typing/selecting existing image filenames from a datalist
  - `Upload Image` button opens file explorer
  - uploaded files are saved by backend admin upload route
- Add-ons are structured rows with:
  - add-on name
  - add-on price
  - remove button
- Add-on layout was fixed after missing CSS caused stacked fields.

### Admin UI fixes completed
- Removed the old view restaurant dropdown.
- Menu list now shows one category at a time with category tabs.
- Order history had previously been reset to zero.
- Admin select/dropdown styling was normalized to dark readable UI.
- Spacing across restaurant/menu/delivery/promotion panels was improved.
- Extra spacing was added below the add-ons block.

## Backend Admin Upload Support
Backend supports menu image upload.

### Relevant files
- `X:\FDP\backend\src\app.js`
- `X:\FDP\backend\src\routes\admin.js`

### Notes
- `express.json({ limit: '10mb' })` is in use.
- Admin route includes `POST /api/admin/uploads/menu-image/`.
- Uploaded images are written to both:
  - `X:\FDP\images\foods`
  - `X:\FDP\frontend\assets\images\foods`

## Homepage Search
Homepage search was made operational.

### Current behavior
- Hero search on `index.html` is now a real form.
- Searching redirects to:
  - `restaurants.html?search=<query>`
- Restaurants page search now considers:
  - restaurant name
  - cuisine
  - service area
  - restaurant categories
  - food name
  - food description
  - food category

### Relevant files
- `X:\FDP\frontend\pages\index.html`
- `X:\FDP\frontend\assets\js\main.js`

## Notable Frontend Files Changed Recently
- `X:\FDP\frontend\pages\index.html`
- `X:\FDP\frontend\pages\admin.html`
- `X:\FDP\frontend\assets\js\main.js`
- `X:\FDP\frontend\assets\js\admin.js`
- `X:\FDP\frontend\assets\css\admin.css`

## Notable Backend Files Changed Recently
- `X:\FDP\backend\src\app.js`
- `X:\FDP\backend\src\routes\admin.js`

## Cautions
- Seed data still exists in frontend JSON files. If reseeded, live MongoDB edits may be overwritten depending on the seed path used.
- Browser caching affected CSS/JS during admin work. If UI looks stale, hard refresh first.
- Some work was done through direct file patching on `X:\FDP`, so keep an eye on versioned asset includes in HTML pages.

## Good Next Steps
- Add homepage autocomplete suggestions.
- Improve restaurants results page with highlighted matches.
- Add selected-image thumbnail preview back into menu form if desired.
- Add validation and better success/error messaging in admin forms.
