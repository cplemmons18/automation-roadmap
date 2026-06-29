# Automation Roadmap

A single-page app for the **Rewst App Builder** that gives MSPs and their customers a leadership-friendly view of automation work — what's live, what's coming, and the business benefits each automation delivers.

Deploys to your Rewst environment in about 5 minutes. Data persists in a Rewst org variable on your tenant.

## What you get

A self-contained HTML page that drops into a Rewst App Builder HTML component and produces:

- **Business Impact By Benefit** — for each benefit tag, the count of LIVE (deployed) and COMING (in-flight) automations side by side
- **By the Numbers** — hours saved per month today and potential when everything ships, with a progress bar and work-weeks translation
- **Roadmap Overview cards** — counts plus monthly hours by status (Total / Completed / In Progress / Blocked)
- **Table view** with inline cell editing, sortable columns, search, and filters
- **Kanban view** by status with drag-and-drop and a one-click Mark-Deployed action
- **Edit drawer** for full row CRUD: name, benefit tags, type, effort, priority, status, assigned stakeholder, target date, hours saved, executions per month, notes
- **Print / Save-as-PDF** with a dedicated print stylesheet — share with execs who don't use Rewst
- **Dark mode** with the page defaulting to dark

Each Rewst org gets its own roadmap. Data is isolated per-customer org by design.

---

## Deploy to your Rewst environment

You'll need:

- A Rewst tenant (any region — US, UK, EU)
- Permission to create App Builder apps in the org where you want the roadmap

### Step 1: Get the HTML

You have two options:

**Option A — Use the pre-built file (recommended):**

Download [`dist/dashboard-spa-main-compiled.html`](dist/dashboard-spa-main-compiled.html) from this repo. It's a single self-contained HTML file with everything compiled in.

**Option B — Build from source (if you want to customize first):**

```bash
git clone <this-repo-url>
cd automation-roadmap
node build.js
```

No `npm install` needed — the build script is plain Node `fs` operations. Output lands at `dist/dashboard-spa-main-compiled.html`.

### Step 2: Create the app in Rewst

1. Log in to your Rewst tenant and switch to the org you want the roadmap in
2. Go to **Apps → New App**
3. Name it (e.g. "Automation Roadmap")
4. Create a **Home** page on the new app

### Step 3: Paste the HTML

1. On the Home page, drag an **HTML container** component onto the canvas
2. Open the container for editing
3. Paste the entire contents of the HTML file from Step 1
4. Save the page

### Step 4: Open it and add your first automation

1. Open the page as a user with access
2. You'll see an empty state — "No automations on the roadmap yet"
3. Click **+ Add Automation** to add your first item, or **Load Sample Data** to see what a populated roadmap looks like
4. Confirm the data persists across page refreshes

> ✅ **The page automatically creates the `roadmap_data` org variable on first save.** No need to set up the variable manually — the page handles it. Each org gets its own roadmap data (cascade off).

That's it. You're done.

---

## Using the app

Once the page is live, see **[`docs/automation-roadmap-how-to.md`](docs/automation-roadmap-how-to.md)** for the full user guide:

- Adding, editing, and organizing automations
- The 7 benefit tags and what each one means
- Switching between table and kanban views, drag-and-drop
- Search and filters
- Printing or saving as PDF
- Common questions (where does the data live, can multiple people edit it, etc.)

---

## Customizing

The roadmap is one HTML file compiled from a handful of source files. To modify:

| What you want to change | File to edit |
|---|---|
| Page layout, fields, hero tiles, CRUD logic | `pages/roadmap.js` |
| Theme, colors, dark mode, print styles | `src/rewst-override-tailwind.css` |
| Shared UI components (tables, drawers, dropdowns, toasts) | `src/rewst-dom-builder.js` |
| Rewst GraphQL wrapper | `src/zip-graphql-js-lib-v2-optimized.js` |
| HTML shell (sidebar, header) | `dashboard-spa-main-template.html` |

After edits, run `node build.js` to recompile, then re-paste the new `dist/dashboard-spa-main-compiled.html` into Rewst.

For the full architecture and design rationale — including how the build system works, the org-variable persistence pattern, the benefit-tag taxonomy, and known gotchas — see **[`CLAUDE.md`](CLAUDE.md)**.

---

## Project structure

```
├── build.js                                # Compiles template + page + libs → dist/
├── dashboard-spa-main-template.html        # HTML shell with {{ MARKER }} placeholders
│
├── pages/
│   └── roadmap.js                          # Roadmap page render logic + CRUD + drawer
│
├── src/
│   ├── rewst-dom-builder.js                # UI component library (tables, drawers, toasts)
│   ├── rewst-override-tailwind.css         # Rewst theme + dark mode + print styles
│   └── zip-graphql-js-lib-v2-optimized.js  # Rewst GraphQL wrapper
│
├── dist/
│   └── dashboard-spa-main-compiled.html    # Compiled output — what you paste into Rewst
│
├── docs/
│   └── automation-roadmap-how-to.md        # Full user guide
│
├── CLAUDE.md                               # Architecture, patterns, gotchas
└── README.md                               # You are here
```

---

## Troubleshooting

**The page loads forever and the browser console shows `SyntaxError: Invalid or unexpected token (at about:srcdoc:1:1)`.**

Rewst runs HTML component content through its Jinja2 template engine before rendering. Anything that looks like `{%`, `%}`, `{{`, or `}}` in the compiled output will silently break the page. The build avoids these sequences on purpose, but if you edit `pages/roadmap.js` or the libraries and introduce a literal `{%` (e.g. in a regex or string), the page will break this way. Assemble those sequences at runtime (`'{' + '%'`) or use character-class regexes (`'[{][%]'`).

**Saves appear to succeed but the `roadmap_data` org variable in the Rewst UI never updates.**

If your tenant has a large number of org variables (over ~5,000 visible, common for top-level MSPs with many managed customer orgs), the page may have been creating a duplicate variable instead of finding the existing one. This is fixed in the current build via a where-clause scoped GraphQL query that bypasses the visible-variables cap. If you're seeing this on an old build, pull the latest from this repo and re-paste the compiled HTML.

**I want to share the roadmap with someone who doesn't have Rewst access.**

Use the **🖨 Print** button in the page header and choose "Save as PDF" in your browser's print dialog. The print stylesheet hides nav chrome, drawers, and edit buttons — you get a clean, paper-ready snapshot.

---

## Foundation

Built on Nick Zipse's Rewst App Builder starter template:

- `RewstApp` — Rewst GraphQL wrapper (workflows, forms, org variables, etc.)
- `RewstDOM` — DOM component library (tables, drawers, dropdowns, toasts)
- Tailwind-based Rewst brand theme

The roadmap page itself (`pages/roadmap.js`), the dark mode treatment, the print stylesheet, and a fix for the large-MSP variable-lookup edge case are the additions in this repo. See [`CLAUDE.md`](CLAUDE.md) for the full rundown.

This repo is community-maintained and **not officially supported by Rewst**. Issues and PRs welcome.
