# Rewst App Builder Template

Barebones template for building single-page apps on the Rewst App Builder platform. Everything compiles into ONE HTML file that gets pasted into Rewst.

## Living Reference

This file is a reference, not a strict spec. Patterns described here are how things have been built in this codebase so far — not the only way to build them, and not gates a new feature has to pass through. When you add functionality that isn't documented here, extend this file in the same pass rather than overwriting prior sections. The "Modules built in this codebase" section at the bottom is where most of the accumulated knowledge lives — append new modules there as they're built.

Older sections higher up may describe template-era behavior that's since been changed or replaced. When in doubt about the *current* state, the lower sections (and the actual code) win.

## CRITICAL: How This Works

This is NOT a normal web app. There is no npm, no bundler, no dev server. The build is dead simple:

1. `dashboard-spa-main-template.html` has `{{ MARKER }}` placeholders
2. `build.js` reads each marker and replaces it with the file contents
3. Output: `dist/dashboard-spa-main-compiled.html` — a single self-contained HTML file
4. That file gets copy-pasted into Rewst App Builder's HTML component

**Always run `node build.js` after ANY change to see it in Rewst.**

## File Structure

```
dashboard-spa-main-template.html   # THE main file. HTML shell + all JS logic.
build.js                           # Build script. Maps markers to files.
dist/                              # Build output. This is what goes into Rewst.

src/                               # Core libraries — shared across all pages
  rewst-dom-builder.js             # RewstDOM: tables, metric cards, autocomplete, alerts, etc.
  zip-graphql-js-lib-v2-optimized.js  # RewstApp: GraphQL API wrapper for Rewst platform
  rewst-override-tailwind.css      # Rewst brand CSS theme layered on Tailwind

pages/                             # One JS file per sidebar page
  components.js                    # Kitchen Sink — shows all available components
  starter.js                       # Blank starter page — copy this for new pages
```

## How to Add a New Page

This is the most common task. Follow these steps EXACTLY:

### Step 1: Create the page file

Create `pages/mypage.js`:
```js
function renderMyPage() {
  const container = document.getElementById('page-mypage');
  container.innerHTML = '';

  // Build your page content here
  // Use RewstDOM components, create DOM elements, etc.
}
```

### Step 2: Update the HTML template

In `dashboard-spa-main-template.html`, make these 4 changes:

**A) Add sidebar nav item** (inside the `<div class="sub-nav ...">` block):
```html
<a href="#" class="sidebar-item flex items-center gap-3 px-3 py-2 rounded text-sm text-rewst-dark-gray" data-page="mypage">
  <span class="material-icons text-lg">your_icon</span>
  <span class="nav-text">My Page</span>
</a>
```

**B) Add page container** (inside `<div class="px-8 pb-8 pt-6">`):
```html
<div id="page-mypage" class="page-content" style="display: none;">
  <!-- Rendered by mypage.js -->
</div>
```

**C) Add marker** (in the script section, near the other page markers):
```
{{ PAGE_MYPAGE }}
```

**D) Register in pages config** (in the JS `pages` object):
```js
mypage: {
  title: 'My Page',
  subtitle: 'Description shown in header',
  render: renderMyPage
}
```

### Step 3: Update build.js

Add the marker mapping:
```js
'{{ PAGE_MYPAGE }}': 'pages/mypage.js',
```

### Step 4: Build

```bash
node build.js
```

## IMPORTANT GOTCHAS

### Rewst Jinja2 Processes HTML Component Content

Rewst App Builder runs HTML component content through its Jinja2 template engine **before** rendering it in the srcdoc iframe. Any literal `{%` or `%}` in the compiled HTML will be interpreted as Jinja2 block tags. If Jinja2 can't parse them (it can't — they're JS/regex code), the component silently breaks: the portal loads forever, the browser console shows `SyntaxError: Invalid or unexpected token (at about:srcdoc:1:1)`.

**The rule:** never let `{%` or `%}` appear verbatim in compiled output. Also avoid `{{` and `}}` (Jinja2 variable interpolation delimiters).

If JS code needs to check for or match these sequences, split them across string concatenation or use character-class regexes:

```js
// WRONG — {%  and  %} appear literally in the compiled HTML
if (raw.includes('{%')) { ... }
.replace(/\{%[\s\S]*?%\}/g, '')

// CORRECT — sequences are assembled at runtime, invisible to Jinja2
const JINJA_OPEN = '{' + '%';
if (raw.includes(JINJA_OPEN)) { ... }
const jinjaBlockRe = new RegExp('[{][%][\\s\\S]*?[%][}]', 'g');
.replace(jinjaBlockRe, '')
```

Comments mentioning `{%` or `%}` (even inside `// ...`) also get compiled into the output — reword them to avoid the literal sequences (e.g. "jinja blocks" instead of `{% if %}`).

**Diagnostic signature:** portal/app stuck on loading screen; roadmap (or any other compiled app that doesn't contain these patterns) continues working; console shows `SyntaxError: Invalid or unexpected token (at about:srcdoc:1:1)` and `_app-{hash}.js:13`.

### CSS Specificity: Accent Metric Cards

The `.card` class has `border: none` which KILLS `border-left` on accent cards at the same specificity. You MUST use the `cardClass` option with `card-accent-{color}`:

```js
// WRONG — border won't show (card's border:none wins)
RewstDOM.createMetricCard({ color: 'teal', solidBackground: false });

// CORRECT — card-accent-teal has higher specificity (.card.card-accent-teal)
RewstDOM.createMetricCard({
  color: 'teal',
  solidBackground: false,
  cardClass: 'card-accent-teal'
});
```

Available accent classes: `card-accent-teal`, `card-accent-fandango`, `card-accent-orange`, `card-accent-error`, `card-accent-warning`, `card-accent-snooze`, `card-accent-bask`

### All JS runs inside a single `<script type="module">` block

Page functions, the RewstApp init, sidebar logic — it's all in one async IIFE inside the template. Page JS files get injected into this scope via markers. This means:
- Page render functions have access to `rewst`, `RewstDOM`, `debugLog`, `switchPage`, etc.
- No imports/exports — everything is in the same function scope
- `window.rewst`, `window.RewstDOM` are set globally for console debugging

### The template HTML file IS the app

`dashboard-spa-main-template.html` contains:
- The HTML structure (sidebar, header, page containers, filter drawer)
- All JavaScript (init, navigation, scroll behavior, event listeners)
- Markers where libraries and pages get injected

The `src/` and `pages/` files are only separate for developer ergonomics. After build, it's ONE file.

### Sticky header behavior

The header shrinks on scroll (subtitle hides, buttons collapse to icon-only). This is handled by CSS classes:
- `.scrolled` — compact mode (added when scrollTop > 50px)
- `.hide-smooth` — slides header up when scrolling down fast
- `.show-instant` — snaps header back when scrolling up
- `.btn-text` elements get `display: none` when `.scrolled`

### Filter drawer

The slide-out filter panel on the right is pre-wired:
- `#open-filter-drawer` button opens it
- `#close-filter-drawer` button and overlay click close it
- Filter containers (`#filter-org-container`, `#filter-date-container`, `#filter-custom-container`) are empty — populate them with RewstDOM components
- CSS: `#filter-drawer.open { transform: translateX(0) }` handles the slide animation

### Toggle switch in header

The toggle switch (`#header-toggle`) is wired up with a change listener. Access its state with:
```js
document.getElementById('header-toggle').checked
```

## Component Reference (RewstDOM)

### Metric Cards
```js
const card = RewstDOM.createMetricCard({
  title: 'My Metric',          // card title (also accepts 'label')
  subtitle: 'Description',     // smaller text under title (also accepts 'description')
  value: '1,234',              // big number displayed
  icon: 'speed',               // Material Icons name
  color: 'teal',               // teal|fandango|orange|success|error|warning|snooze|bask
  solidBackground: true,       // true = gradient bg, false = white card (use cardClass for accent)
  cardClass: 'card-accent-teal', // override CSS class (REQUIRED for accent border cards)
  trend: 'up',                 // up|down|null — shows trend arrow
  trendValue: '+12%'           // text next to trend arrow
});
container.appendChild(card);

// Or with skeleton loading:
RewstDOM.loadMetricCard('#my-target', { ...same options });
```

### Tables
```js
const table = RewstDOM.createTable(dataArray, {
  title: 'My Table',                    // heading above the table
  columns: ['name', 'status', 'count'], // which keys to show
  headers: { name: 'Name', status: 'Status', count: 'Count' },  // display names
  transforms: {                         // custom cell rendering
    status: (val) => `<span class="badge badge-${val === 'OK' ? 'success' : 'error'}">${val}</span>`
  },
  filters: {                            // column filter dropdowns
    status: { type: 'dropdown' },
    date: { type: 'dateRange' }
  },
  defaultSort: { column: 'count', direction: 'desc' },
  pagination: 10,                       // rows per page (default 10)
  paginationOptions: [10, 25, 50],      // page size choices
  searchable: true,                     // full-text search (default true)
  sortable: true,                       // click-to-sort columns (default true)
  workflowId: 'xxx',                    // enables refresh button
  refreshable: true                     // show refresh icon
});
```

### Autocomplete
```js
const auto = RewstDOM.createAutocomplete(items, {
  labelKey: 'name',           // which property to display
  valueKey: 'id',             // which property is the value
  placeholder: 'Search...',
  onSelect: (item) => { },    // callback when item selected
  showClearButton: true,
  maxResults: 10
});
```

### Dropdowns
```js
// Single select
const dropdown = RewstDOM.createStyledDropdown(
  [{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }],
  { defaultValue: '30', onChange: (option, value) => { } }
);

// Multi select
const multi = RewstDOM.createMultiSelect(
  [{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }],
  { placeholder: 'Select...', onChange: (selectedValues) => { } }
);
```

### Alerts (toast notifications)
```js
RewstDOM.showSuccess('Done!');              // green, 4s
RewstDOM.showError('Something broke');      // red, 5s
RewstDOM.showWarning('Watch out');          // amber, 4s
RewstDOM.showInfo('FYI');                   // teal, 4s
// All accept optional second param for duration in ms
```

### Loading Skeletons
```js
RewstDOM.showMetricSkeleton('#target');           // shimmer card placeholder
RewstDOM.showChartSkeleton('#target', '300px');   // shimmer chart placeholder
RewstDOM.showTableSkeleton('#target', 5);         // shimmer table with N rows
RewstDOM.showButtonSkeleton('#target', 130, 52);  // shimmer button placeholder
```

### DOM Helpers
```js
RewstDOM.place(element, '#selector');       // append element to target
RewstDOM.getColor('teal');                  // returns '#009490'
RewstDOM.getColorRgba('teal', 0.5);        // returns 'rgba(0, 148, 144, 0.5)'
RewstDOM.animateNumber(element, '1,234', 1000);  // count-up animation
```

## Rewst API (RewstApp)

The `rewst` object is initialized on boot and available globally:

```js
// Run workflows
await rewst.runWorkflowSmart(workflowId)          // auto-detect trigger, recommended
await rewst.runWorkflow(workflowId, inputs)        // simple test execution (no trigger)
await rewst.runWorkflowWithTrigger(workflowId, triggerId, inputs)  // explicit trigger

// Forms
await rewst.submitForm(formId, fieldValues)
await rewst.debugForm(formId)                      // logs field schemas to console

// Data
await rewst.getAllWorkflows()
await rewst.getRecentExecutions(withTriggerInfo, days, workflowId, includeSubWorkflows, orgIds)
await rewst.getWorkflowTriggers(workflowId)
await rewst.getWorkflowSchema(workflowId)
await rewst.getLastWorkflowExecution(workflowId)
await rewst.getOrgVariable(variableName)
await rewst.getManagedOrganizations()
await rewst.getIntegrationConfigs()

// Context
rewst.getOrgId()                                   // current org ID
rewst.orgId                                        // same thing, property access
```

## CSS Quick Reference

### Buttons
```html
<button class="btn-primary">Primary</button>          <!-- teal bg -->
<button class="btn-secondary">Secondary</button>      <!-- white bg, teal border -->
<button class="btn-tertiary">Tertiary</button>        <!-- transparent, teal text -->
<!-- Sizes: add btn-sm or btn-lg -->
```

### Cards
```html
<div class="card">Default white card</div>
<div class="card card-success">Green success card</div>
<div class="card card-warning">Amber warning card</div>
<div class="card card-error">Red error card</div>
```

### Badges
```html
<span class="badge badge-teal">Teal</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-error">Error</span>
```

### Colors
CSS variables: `var(--rewst-teal)`, `var(--rewst-fandango)`, `var(--rewst-orange)`, `var(--rewst-bask)`, `var(--rewst-snooze)`, `var(--rewst-quincy)`

Utility classes: `bg-rewst-{color}`, `text-rewst-{color}`, `border-rewst-{color}`

Color names: `teal`, `light-teal`, `fandango`, `orange`, `bask`, `snooze`, `quincy`, `black`, `dark-gray`, `gray`, `light-gray`, `light`, `white`

### Material Icons
```html
<span class="material-icons">icon_name</span>
```
Browse icons at: https://fonts.google.com/icons

### Layout Classes
- `.sidebar` — left nav (240px, collapses to 64px)
- `.main-content` — content area (margin-left matches sidebar)
- `.sticky-header` — top bar (sticky, shrinks on scroll)
- `.page-content` — page container (toggled by nav)

---

# Modules built in this codebase

Each section below documents a subsystem that's been built on top of the template. Keep these short and pointer-heavy — name the file(s) and function(s), describe the contract, and trust the reader to grep for details.

When you add a new subsystem, append a new section here in the same shape.

## Theme System (Dark Mode)

Class-based dark mode via Tailwind CDN. The template configures `tailwind.config = { darkMode: 'class' }` at the top of `<head>`. A pre-render script in `<head>` (before any other CSS or content) sets `<html class="dark">` and an inline `style.backgroundColor` based on a stored preference. Default is dark; only switches to light when the user has explicitly clicked the toggle.

- localStorage key: `rewst-roadmap-theme` (values `dark` / `light`)
- Theme toggle button in the header (`#theme-toggle-btn`) flips the class, syncs the inline bg, and persists the choice
- CSS variables in `src/rewst-override-tailwind.css`:
  - `:root` defines light defaults (`--rewst-white`, `--rewst-light`, `--rewst-light-gray`, `--rewst-dark-gray`, etc.)
  - `html.dark` overrides them with dark equivalents — surfaces map to gray-800-ish, page bg to slate-900-ish
  - Brand colors (`--rewst-teal`, `--rewst-fandango`, etc.) do **not** swap; the brand identity stays consistent across modes
- Native browser widgets (date pickers, scrollbars) inherit dark mode via `color-scheme: dark` on `html.dark` plus a `<meta name="color-scheme" content="dark light">` tag
- Inline `style.backgroundColor` on `<html>` and `<body>` + `overscroll-behavior: none` prevent the browser's default-white from showing during rubber-band overscroll

If you add a new component, prefer CSS-var-based colors (`var(--rewst-white)`) over hardcoded `bg-white` — vars auto-swap, hardcoded values don't. When you must use Tailwind utilities like `bg-white`, pair them with `dark:` variants (`bg-white dark:bg-gray-800`).

## Data Layers

Three objects in `pages/roadmap.js` handle persistence and in-memory state:

- **`RoadmapData`** — manages the row array stored under the `roadmap_data` org variable.
  - `load()` fetches via `rewst.getOrgVariablesWithOrgByName('roadmap_data', rewst.orgId)`, then re-filters by `v.organization?.id === rewst.orgId` (defensive against the fallback scan path returning a cascaded parent variable), seeds `[]` if missing
  - `save(rows)` runs `updateOrgVariables` with the full record (`id`, `name`, `value`, `category`, `cascade`, `orgId`)
  - `_seed(rows = [])` calls `createOrgVariable` with `cascade: false, category: 'general'`
  - `_parseValue(v)` defensively handles JSON-string, already-parsed array, or null
  - `_cachedVar` holds the variable record after load/save; subsequent saves skip the lookup

- **`RoadmapMeta`** — manages the `roadmap_meta` org variable (currently just `hourly_rate`).
  - Hydrated piggyback-style from `RoadmapData.load`'s same fetch via `RoadmapMeta.hydrateFromVariablesList(allVars, myOrgId)` — no extra network call on page load
  - `save({...patch})` merges into existing data and writes via create-or-update depending on whether `_cachedVar` exists
  - `RoadmapMeta.data.hourly_rate` is the read accessor; defaults to `DEFAULT_HOURLY_RATE` (50)

- **`RoadmapState`** — in-memory page state. Holds `rows`, `formState` (open drawer), `editingId`, `view` (`'table' | 'kanban' | 'category'`), `kanbanFilter`. Re-rendered from after every save. Not persisted server-side.

Migration shim `_migrateRow(row)` runs on every load and is idempotent. It rewrites legacy field names (`deadline` → `targetDate`, `hoursSavedPerMonth` → `hoursPerExecution` + `executionsPerMonth`). Once a save happens after migration, the persisted shape catches up and the shim becomes a no-op.

## Org Variable Persistence Pattern

When persisting per-customer state to an org variable, the pattern is:

- Fetch via `rewst.getOrgVariablesWithOrgByName(MY_VAR_NAME, rewst.orgId)` — server-side filtered lookup. Do **not** use `getOrgVariablesWithOrg()` for a known-name fetch: it has a 500-item ceiling and customers with that many variables will get a false miss → load thinks the variable doesn't exist → save creates a duplicate or wipes data. (Real bug, see below.)
- Re-filter the result by `v.organization?.id === rewst.orgId` for cascade safety (the fallback scan path inside the lib method can include parent-org-owned variables)
- Use `createOrgVariable` mutation for first-time seed (with `cascade: false`, `category: 'general'`, `orgId: rewst.orgId`)
- Use `updateOrgVariables` mutation for updates (note: the mutation takes an *array* of update inputs, even when you're updating one — list coercion handles single-object input but explicit array is more explicit)
- Always preserve the existing record's fields on update (`category`, `cascade`, `orgId`) — the mutation expects the full record back

This pattern is reusable for any new per-customer state. Pick a unique variable name and follow the same shape.

### The 500-variable bug — why `getOrgVariablesWithOrgByName` exists

The lib's `getOrgVariablesWithOrg()` defaults to `limit: 500` server-side. In an org with more than 500 total variables, the target variable could sit past the cutoff and silently never come back. The roadmap code then:

1. Treated "not in result set" as "doesn't exist" → seeded `[]` again on every load
2. On first save: didn't find existing variable in the cache → created a fresh duplicate
3. On every subsequent refresh: same cycle, customer's data appeared to wipe itself each time

Hit in a real customer environment (>500 vars). The fix: use `getOrgVariablesWithOrgByName(name, orgId)` which tries a scoped `orgVariables(orgId, name)` GraphQL query first (O(1), no limit), and falls back to a `limit: 5000` scan if the schema doesn't support that shape. Either way, the name-targeted lookup returns a reliable answer regardless of the customer's total variable count.

## Custom GraphQL Query Patches (in `zip-graphql-js-lib-v2-optimized.js`)

- `getOrgVariablesWithOrg`'s query is extended to include `updatedAt` on each variable. This is what powers the "Last saved" indicator at the bottom of the roadmap page. The lib's `getOrgVariables` (non-With-Org variant) was *not* patched — use `getOrgVariablesWithOrg` if you need `updatedAt`.
- `getOrgVariablesWithOrgByName(name, targetOrgId)` is a non-upstream addition. Tries the scoped `orgVariables(orgId, name)` query first, falls back to a high-limit `visibleOrgVariables` scan. Use this instead of `getOrgVariablesWithOrg()` whenever you know the variable name you're looking for — bypasses the 500-item ceiling that bit a real customer.
- `getOrgVariable(name)` was reimplemented to call `getOrgVariablesWithOrgByName(name, this.orgId)` internally instead of `getOrgVariables()` + client-side filter. Same shape of fix — the old implementation had an even tighter (100-item) ceiling because `getOrgVariables()` defaults to `limit: 100`. Anyone calling `rewst.getOrgVariable('foo')` now gets the safe lookup path automatically.

## Drawer + Popover Infrastructure

The slide-out drawer in the template HTML is generic — its title (`#drawer-title`) and body (`#drawer-body`) are both populated dynamically. Two helper functions are exposed on `window`:

- `window.openDrawer()` — slides the drawer in (also forces `transform: translateX(0)` inline to win over Tailwind class race conditions)
- `window.closeDrawer()` — slides it out and clears the inline transform

Two distinct drawer contents (both in `pages/roadmap.js`):

- **Edit drawer** — `_openRoadmapDrawer(row | null)` populates the body with the row form (Name, Type, Category, Effort, Priority, Status, Assigned Stakeholder, Target Date, Hours per Execution, Executions per Month, Notes) plus Save / Cancel / Delete buttons. `_handleDrawerSave` validates required fields (Name, Category) and fires a soft warning if ROI fields are zero. Delete uses a native `confirm()` for the safety step.
- **Settings drawer** — `_openSettingsDrawer()` populates the body with the hourly-rate input. `_handleSettingsSave` validates and writes via `RoadmapMeta.save`.

The cell-edit popover is a singleton (`_ensureCellEditPopover()`) lazy-created on `document.body`. It's reused across:

- **Enum editor** (`_openCellEditor` for `type` / `effort` / `priority` / `status` / `category`) — renders option buttons with dot indicators
- **Text editor** (`_openTextCellEditor` for `name` / `assignedStakeholder`) — text input with Save / Cancel, Enter to commit, Esc / outside-click to cancel, optional `required` validation
- **Date editor** (`_openDateCellEditor` for `targetDate`) — embeds the custom date picker; click a day auto-commits

Shared positioning lives in `_positionCellPopover(popover, cellEl)`:

1. Pin popover offscreen (`left: -9999px`)
2. `requestAnimationFrame` → measure the rendered dimensions
3. Position below the cell by default; flip above only when `popover height > space below AND space above > 8px`
4. Nudge left if it would overflow the viewport right edge
5. Fallback dimensions (280×300) if measurement returns 0

The dark-mode bg pinning rules in the CSS (`html.dark .rewst-table-container .bg-white`, etc.) prevent a brief white flash during re-render when Tailwind's JIT is catching up to dynamically-inserted classes.

## Custom Date Picker

`_renderDatePicker(initialValue, { onSelect, onClear })` in `pages/roadmap.js`. Returns a DOM element styled to match the rest of the page. Layout:

- Header: prev-month chevron · "Month Year" · next-month chevron
- Day-of-week row (S M T W T F S)
- 6×7 grid of date cells. Current month is bold; previous/next month tail cells are faded and non-clickable
- Footer: Clear · Today (both auto-commit)

Behavior:

- Initial value parsed from `YYYY-MM-DD` string sets the viewed month and selected cell
- Selected cell renders with teal background + white text
- Today (when not selected) gets a teal ring outline
- Clicking a day calls `onSelect(iso)` immediately — no separate "OK" button
- Today / Clear buttons in the footer call `onSelect(todayIso)` or `onClear()`

Used in two places: the drawer's Target Date field (with an outside-click overlay dismissal) and the inline date cell editor (inside the popover). Both got native `<input type="date">` originally; the picker replaced it because the native widget couldn't be themed reliably across browsers.

## View Toggle Pattern

The top-of-content area has a three-button segmented control (`_renderViewToggle`) for switching between Table / Kanban (by status) / By Category. The state lives in `RoadmapState.view` and persists in localStorage as `rewst-roadmap-view`.

The dispatcher inside `_renderRoadmapBody` reads `RoadmapState.view` and calls either `_renderTableView(rows)` or `_renderKanbanView(rows, groupBy)`. Kanban grouping accepts `'status'` (5 columns) or `'category'` (6+ columns with an optional "Uncategorized" trailing column when rows lack a category).

Drag-and-drop in both kanban modes uses HTML5 native drag events. The card's `dragstart` puts the row id in `dataTransfer`; the destination column's `drop` handler reads the id, mutates the row's `status` or `category` (based on the column's `dataset.groupField`), and saves. Dropping into the "Uncategorized" column is a silent no-op (you can't un-categorize via drag).

## Hero Tier + Overview Strip

Hero strip (`_renderHeroTiles`): three tiles in a `grid-cols-1 md:grid-cols-3` layout.

- **Currently Saving** — sum across `status === 'Deployed'` rows, green accent
- **Potential to Save** — sum across all non-Deployed rows, fandango accent. Subtitle breaks down into "X in flight · Y not started · Z blocked"
- **Value by Category** — compact list of all 6 categories with colored dots and $/mo, sorted by value desc. "Uncategorized" appears as an extra row if any rows have empty category

Overview strip (`_renderSummaryCards`): four cards in `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`.

- **Roadmap Total** — count + total hours/mo + total $/mo
- **Completed** — count of Deployed + their hours/$
- **In Progress** — count of In Progress + Testing combined (label "in deployment") + their potential hours/$
- **Blocked** — count + blocked hours/$ (what would be saved if unblocked)

Math contract:

- `_monthlyHoursFor(row)` = `(parseFloat(hoursPerExecution) || 0) × (parseFloat(executionsPerMonth) || 0)`
- `_sumHours(rows)` aggregates across an array
- Dollar values = `hours × RoadmapMeta.data.hourly_rate` (default `DEFAULT_HOURLY_RATE`)
- Formatters: `_fmtDollars(n)` (Intl.NumberFormat, 0 fraction digits, $1,234), `_fmtHours(n)` (one decimal max, no trailing .0)
- `_parseRewstTimestamp(value)` is defensive about ISO / RFC strings, numeric epoch (seconds or ms), and numeric-string epoch. Returns `null` for unparseable values so the "Last saved" indicator hides itself instead of showing "Invalid Date"

## Badge Token System

`BADGE_STYLES` (in `pages/roadmap.js`) maps six color keys (`teal`, `fandango`, `orange`, `success`, `error`, `gray`) to CSS rules that reference vars: `color: var(--badge-teal-text); background-color: var(--badge-teal-bg);`. Vars are defined in `:root` (light mode: muted pastels, dark text) and overridden in `html.dark` (brighter brand-family text, ~22-28% alpha bg).

`BADGE_MAP` maps enum values to color keys per field. New enum columns need both:

```js
ROADMAP_ENUMS.myNewField = [...values];
BADGE_MAP.myNewField = { 'Value A': 'teal', 'Value B': 'fandango', ... };
```

`_badge(text, colorKey, opts)` generates the chip HTML. Pass `{ editable: true, rowId, field }` to make the chip click-to-edit (the table component handles the click delegation; the cell-edit popover dispatcher routes to the right editor).

## Sort Keys for Ranked Enums

The shared table library does numeric coercion before falling back to string sort. For ranked enums like Low/Medium/High this gives wrong ordering (all parse to NaN → alphabetic). Pass `sortKeys` in the table options to override:

```js
sortKeys: {
  effort:   { Low: 1, Medium: 2, High: 3 },
  priority: { Low: 1, Medium: 2, High: 3 },
  status:   { 'Not Started': 1, 'In Progress': 2, 'Testing': 3, 'Deployed': 4, 'Blocked': 5 },
}
```

The library also has an ISO-date short-circuit so `YYYY-MM-DD` columns sort chronologically (the lexicographic sort matches chronological order for that format). No special config needed for date columns.

## Library Customizations Worth Knowing About

These are non-upstream diffs on the shared library files. If the lib ever gets a new official version, re-apply these.

`src/rewst-dom-builder.js`:

- Table container, alternating rows, headers, and search input got `dark:` Tailwind variants
- Filter dropdown menus + checkbox option text got dark variants and `accent-rewst-teal` for the check color
- `createMultiSelect`: the outer `tagsContainer` and `dropdownMenu` got `dark:bg-gray-800` + `dark:border-gray-600` — the original `bg-white` stayed white in dark mode and looked like a stark light island
- Table sort comparators added: `sortKeys` option for ranked enums; ISO date short-circuit
- Table skeleton (`showTableSkeleton`) got dark variants on container, divider, and shimmer bars

`src/rewst-override-tailwind.css`:

- CSS var swaps for dark mode (neutral surface tokens, badge tokens)
- `card-accent-success` class added (wasn't in the upstream `card-accent-*` set)
- `html.dark .rewst-table-container .bg-white` etc. pin dark surface colors at higher specificity than Tailwind's generated `dark:` rules — prevents JIT-lag flash when new rows insert
- `overscroll-behavior: none` + `background-color: var(--rewst-light)` on html and body prevent white-bounce overscroll
- Dark mode alert overrides (tinted dark bg + brighter brand-family text) for toast notifications — prevents the bright pastel "flash" when a toast slides in

`src/zip-graphql-js-lib-v2-optimized.js`:

- `getOrgVariablesWithOrg` query includes `updatedAt`
- `getOrgVariablesWithOrgByName(name, targetOrgId)` added — scoped name+orgId fetch with high-limit scan fallback. Bypasses the 500-item ceiling that wipes customer data in large-variable orgs.
- `getOrgVariable(name)` reimplemented to delegate to `getOrgVariablesWithOrgByName` — same fix for the value-only fetch path (old impl used `getOrgVariables()` with a 100-item default cap).

## Toast / Soft Warning Convention

Toasts come from `RewstDOM.showSuccess / showWarning / showError / showInfo`. They stack vertically. The convention for "saved with caveats" is to fire two toasts in sequence:

```js
RewstDOM.showSuccess('Updated');                              // 4s, green
RewstDOM.showWarning("Heads up — …", 6000);                   // 6s, amber
```

The success toast confirms the operation succeeded; the warning surfaces a non-blocking nuance ("this row won't show up in your value totals because hours/exec are 0"). Don't combine them — let the user see the operation succeeded first, then read the caveat.

## Category Taxonomy (REPLACED — see Tag Taxonomy below)

> The single-select `category` field was replaced by a multi-select `tags` field. The section below is preserved for historical context only — `ROADMAP_ENUMS.category` / `BADGE_MAP.category` no longer exist in the code.

Six business-outcome categories used to live in `ROADMAP_ENUMS.category`:

- Onboarding & Lifecycle
- Security & Compliance
- IT Operations & Help Desk
- Cost & License Management
- Reporting & Visibility
- Customer Experience

Was required on every row; drove the "Value by Category" hero tile and the "By Category" kanban grouping. Director-driven feedback flipped this to multi-select tags; see the next section.

## Benefit Tag Taxonomy + Multi-Select Pattern

The user-facing label is **"Benefit Tags"** everywhere in the UI (drawer field, table column header, inline editor placeholder, toast messages). The underlying data field stays as `row.tags` for code/data continuity, but every user-visible reference says "benefit tags."

`ROADMAP_ENUMS.tags` is a **7-value benefit-oriented list**. Benefit tags describe the *business outcome* an automation delivers, not what the automation does. ("Onboard New User" is the automation; "IT Team Efficiency" is the benefit tag.) Earlier iterations used 13 descriptor-style tags and a single-select `category` — both got collapsed into this benefit set after director feedback that descriptor tags don't tell the business-leader story.

The 7 benefit tags + their BADGE_MAP color:

- **IT Team Efficiency** (teal) — frees up the IT/MSP team
- **Employee Experience** (success / green) — improves end-employee experience
- **Customer Experience** (fandango) — improves end-customer outcomes
- **Security & Compliance** (error / red) — risk reduction, audit-readiness
- **Cost Reduction** (orange, defensive) — money you would've spent that you didn't (license consolidation, error-cost reduction)
- **Revenue Capture** (orange, offensive) — money you would've missed that you recovered (billing reconciliation, expiring contract follow-up, license under-billing audits)
- **Service Quality** (gray) — reliability, SLA, accuracy

### Cost Reduction vs Revenue Capture

These two are intentionally separate even though both are financial. Cost Reduction is *defensive* (avoiding spend); Revenue Capture is *offensive* (capturing missed income). The board-level conversations they trigger are different — "we cut $X in licensing" vs "we recovered $X in missed billings." Different stories, different automations.

They share the `orange` badge color because the palette only has 6 base colors and the label text disambiguates them. If real usage shows visual confusion, a new color can be added to `BADGE_STYLES` + the CSS var system later.

### General

Benefit tags are **optional** on a row (no required validation). Rows with no tags surface in hero tile coaching ("Add benefit tags to your N automations…") and footers ("N without benefit tags").

### Migration

Two layers of legacy data both auto-migrate in `_migrateRow`:

- `LEGACY_CATEGORY_TO_TAG` — the original 6 single-select category names → new 6 benefit tags. Wraps the value in a 1-element array.
- `LEGACY_TAG_TO_TAG` — the intermediate 13-tag descriptor names (e.g. `'Onboarding'`, `'Patch Management'`) → new 6 benefit tags. Two old tags can collapse to the same new tag; the shim de-duplicates after mapping.

Both shims are idempotent. Once a row is saved after migration, the persisted shape catches up.

### Where tags surface

- **Drawer** — multi-select widget (`RewstDOM.createMultiSelect`) via the `_tagsMultiSelectFor` helper. Always clone the row's tags array on drawer open (`tags: [...existingRow.tags]`) so edits don't mutate the persisted row until Save.
- **Table Tags column** — multiple chips per row. Click anywhere on the cell opens an **inline multi-select popover** (`_openTagsCellEditor`) — 6 checkboxes + Done button, lives in the singleton cell-edit popover on `document.body`. Commits on Done click OR on outside click (tracked via a MutationObserver on the popover's `class` attribute → when it gains `hidden`, commit runs). A `committed` flag prevents double-save when both fire.
- **Search** — tags array → `String(["a","b"]) → "a,b"` in the table lib's search path, so search-by-tag-name works without extra wiring.
- **No dropdown filter on Tags column** — the shared table library does Set membership against the raw cell, which doesn't work for array values. Search + the hero tiles cover the gap.

### Why no kanban "By Tag" view

Was tried, removed. Multi-membership made the kanban confusing: cards appearing in multiple columns, drag-drop semantics ambiguous (additive? replace?). The Tag Coverage / story tiles in the hero strip carry the per-tag story instead. Toggle is now just Table / Kanban (status).

## Hero Tiles

Two tiles in the top strip, aimed at a business leader scanning the page:

- **"Business Impact By Benefit"** (fandango, `md:col-span-2` — takes 2/3 of the strip) — combined table-like view. Per benefit tag, one row showing **LIVE** (Deployed count) and **COMING** (non-Deployed count) side by side. Solves the "multi-tag to one story" problem the previous per-tile design had: a board member can see "in Security & Compliance I have 1 live and 3 coming" in a single glance, even though those automations may also count toward other benefits elsewhere in the table. Built by `_renderBusinessImpactTile(deployedRows, nonDeployedRows)`.
- **"By The Numbers"** (teal, `md:col-span-1` — takes 1/3) — current `Xh / mo saved today` + potential `Yh / mo potential when shipped`. Estimation caveat lives permanently on this tile (`info` icon + italic gray text): "Estimated from the hours-per-execution × executions-per-month you entered…". Single source of the estimation framing — no duplicate caption on the overview cards strip.

### Business Impact tile mechanics

- Each row uses a 3-column CSS grid: `grid-template-columns: 1fr 70px 70px;` so the LIVE / COMING numbers stay vertically aligned across rows
- Tags sorted by total `(live + coming)` desc, ties broken by `live` desc — surfaces strongest impact areas first
- Tags with zero in both columns are hidden to keep the tile tight (6 tags max showing only those with activity)
- Zero counts in either column render gray; non-zero counts render bold dark — eye lands on the real activity
- Footer shows the unified status flow: `1 deployed · 3 in flight · 2 not started · 1 blocked · N untagged`
- Empty state when no rows: "No automations on the roadmap yet — add one to start tracking business impact."
- Coach state when rows exist but none are tagged: "Add benefit tags to your N automations to see business impact by area."

When adding a new tag, two places need updating: `ROADMAP_ENUMS.tags` and `BADGE_MAP.tags`. The Business Impact tile auto-includes any new tag without code changes.

### Why the two old story tiles were combined

The previous structure ("What You're Getting Today" + "What's On The Way" as separate compact-list tiles) forced the reader to bounce between two tiles to assemble the full picture for any benefit area. The combined tile gives one row per benefit with both states visible, which matches the actual question a business leader asks: *"in each area I care about, where am I and where am I going?"*

## Print / Export

Header button (`#print-btn`) triggers `window.print()`. The CSS in `src/rewst-override-tailwind.css` has an `@media print` block that:

- Forces light-mode CSS vars regardless of dark/light state — saves ink, reads better on paper
- Hides chrome the user doesn't need on paper: sidebar, header button cluster, drawer + overlay, popovers, alerts, view toggle, table search input, table pagination, edit/action buttons
- Sets `@page { size: letter landscape; margin: 0.5in; }` — wide tables fit better landscape
- Adds `page-break-inside: avoid` to rows + cards so they don't split awkwardly
- Reasserts `display: table-header-group` on `thead` so the table header repeats on every printed page

The click handler in `renderRoadmapPage` toggles a `print-prep` class on `<body>` for any future per-state print tweaks, then calls `window.print()`. The class is cleared on `afterprint` (with a 5s setTimeout fallback in case the event doesn't fire).

Users can pick "Save as PDF" in the browser print dialog to export — no separate PDF lib needed.

