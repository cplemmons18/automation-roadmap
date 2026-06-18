# Automation Roadmap

A single-page app for the Rewst App Builder that gives MSPs and their customers a leadership-friendly view of automation work — what's live, what's coming, and the business benefits each automation delivers.

> **Foundation:** Built on Nick Zipse's Rewst App Builder starter template — `RewstApp` (GraphQL wrapper), `RewstDOM` (UI component library), and the Tailwind-based Rewst theme. The Automation Roadmap page (in `pages/roadmap.js`) and the various library customizations documented in `CLAUDE.md` are the additions in this repo.

## What this delivers

A self-contained HTML file that pastes into a Rewst App Builder HTML container and produces:

- **Business Impact By Benefit** — table showing each benefit tag with LIVE (deployed) and COMING (in flight) counts
- **By The Numbers** — time saved today, potential when shipped, progress bar, capacity-in-work-weeks translation, estimation caveat
- **Roadmap Overview cards** — counts + monthly hours by status (Total / Completed / In Progress / Blocked)
- **Table view** with inline-edit cells, sortable columns, search, filters, pagination
- **Kanban view** by status with drag-and-drop and a Mark-Deployed hover action
- **Edit drawer** with full row CRUD: name, benefit tags (multi-select), type, effort, priority, status, assigned stakeholder, target date (custom date picker), hours per execution, executions per month, notes
- **Print / Save-as-PDF** button with a dedicated print stylesheet
- **Dark mode toggle** with the page defaulting to dark

Data persists in a per-customer org variable (`roadmap_data`) — each customer org has its own roadmap, isolated from siblings and parents.

## Quick start

```bash
node build.js
```

This compiles the template, page, and shared libraries into a single self-contained file at `dist/dashboard-spa-main-compiled.html`. Paste that into a Rewst App Builder HTML container on a new app's Home page.

No `npm install` needed — the build script is plain Node `fs` operations.

## Deploying to a customer

→ **See [`docs/automation-roadmap-how-to.md`](docs/automation-roadmap-how-to.md)** for the step-by-step AS/CS deployment guide. Includes region-aware Templates V2 URLs for US / UK / EU, the benefit-tag reference, and a quick-reference checklist.

## Architecture and patterns

→ **See [`CLAUDE.md`](CLAUDE.md)** for the living architecture reference. Covers the build system, the org-variable persistence pattern, the benefit-tag taxonomy, dark mode, the print stylesheet, the inline-cell editor infrastructure, library customizations (including the 500-variable bug + fix), and a per-module breakdown.

## Project structure

```
├── build.js                                # Compiles template + page + libs → dist/
├── dashboard-spa-main-template.html        # HTML shell with {{ MARKER }} placeholders
│
├── pages/
│   └── roadmap.js                          # Roadmap page render logic + CRUD + drawer
│
├── src/
│   ├── rewst-dom-builder.js                # RewstDOM — UI components (Nick's lib + customizations)
│   ├── rewst-override-tailwind.css         # Rewst theme + dark mode + print styles
│   └── zip-graphql-js-lib-v2-optimized.js  # RewstApp — Rewst GraphQL wrapper (Nick's lib + 500-var fix)
│
├── dist/
│   └── dashboard-spa-main-compiled.html    # Compiled output — paste into Rewst
│
├── docs/
│   └── automation-roadmap-how-to.md        # AS/CS deployment guide (Notion-ready)
│
├── CLAUDE.md                               # Architecture / patterns / gotchas
└── README.md                               # You are here
```

## Gotchas

**Rewst's Jinja2 runs HTML component content before render.** Anything that looks like `{%`, `%}`, `{{`, or `}}` in the compiled output will silently break the page (`SyntaxError` at `about:srcdoc:1:1`). Avoid those sequences in JS code by assembling them at runtime (`'{' + '%'`) or using character-class regexes. Full detail in CLAUDE.md.

**The 500-variable bug.** Customers with more than 500 org variables saw `roadmap_data` past the lib's default fetch cutoff, causing the roadmap to silently re-seed and wipe their data on every refresh. Fixed via the `getOrgVariablesWithOrgByName()` lib addition — see CLAUDE.md "Custom GraphQL Query Patches" and "Org Variable Persistence Pattern" sections.
