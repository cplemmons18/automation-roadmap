# Automation Roadmap — User Guide

A reference for setting up and using the Automation Roadmap page in your Rewst environment.

---

## What it does

A single-page dashboard you add to a Rewst environment to track, prioritize, and visualize the automations on your roadmap. It's designed to give a business leader an at-a-glance view of:

- What benefits your deployed automations are delivering
- What's on the way
- How much time the team is saving per month

Everything is manually entered — the page is a planning artifact, not a live workflow dashboard.

---

## How to set it up

You'll need:

- A Rewst tenant (any region — US, UK, EU)
- Permission to create App Builder apps in the org where you want the roadmap

### Step 1: Get the HTML

Two options:

- **Pre-built:** download `dist/dashboard-spa-main-compiled.html` from the repo
- **From source:** clone the repo and run `node build.js` (no `npm install` needed)

### Step 2: Create the app in Rewst

1. In Rewst, go to **Apps → New App**
2. Name it (e.g. "Automation Roadmap")
3. Create a **Home** page on the new app

### Step 3: Paste the HTML

1. On the Home page, drag an **HTML container** component onto the canvas
2. Open the container for editing
3. Paste the entire contents of the HTML file
4. Save the page

### Step 4: First load

1. Open the page as a user with access
2. You'll see an empty state — "No automations on the roadmap yet"
3. Click **+ Add Automation** to add your first item, or **Load Sample Data** to see what a populated roadmap looks like
4. Confirm that adding an automation persists across page refreshes

> ✅ The page automatically creates the `roadmap_data` org variable on first save. No need to set up the variable manually — the page handles it. Each org gets its own isolated roadmap data (cascade off).

---

## How it works

### The hero strip (top of the page)

Two tiles tell the business story:

**Business Impact By Benefit** — a table showing each benefit area with two columns:
- **LIVE** — how many deployed automations contribute to that benefit
- **COMING** — how many in-progress / planned / blocked automations are headed there

The footer shows the unified status flow: `X deployed · Y in flight · Z not started · N blocked · M without benefit tags`.

**By the Numbers** — the time-savings headline:
- Big number: hours saved per month from deployed automations today
- Below: potential when everything ships, plus a "work weeks of capacity" translation for non-technical readers
- Progress bar showing what % of the total roadmap potential is already realized
- ℹ️ Note: these numbers are estimates entered by your team, not measured. The tile says so explicitly.

### The overview cards (under the hero strip)

Four compact cards showing counts by status:
- **Roadmap Total** — all automations + total monthly hours
- **Completed** — deployed count + hours saved/mo
- **In Progress** — in deployment count + potential hours/mo
- **Blocked** — blocked count + blocked hours/mo

### Adding an automation

1. Click the **+ Add Automation** button in the page header
2. Fill in the drawer fields:
   - **Name** *(required)* — what the automation does, e.g. "Onboard New User"
   - **Type** — Crate or Custom
   - **Benefit Tags** — pick one to three (occasionally more, but the system gently warns at 4+) — see the Benefit Tags reference below
   - **Effort** — Low / Medium / High
   - **Priority** — Low / Medium / High
   - **Status** — Not Started / In Progress / Testing / Deployed / Blocked
   - **Assigned Stakeholder** — the person driving this automation; the POC for blockers, testing sign-off, etc.
   - **Target Date** — when you expect it deployed (click the calendar icon)
   - **Hours per Execution** — how much time the automation saves *per run* (e.g. 0.5 for 30 minutes)
   - **Executions per Month** — how many times it runs per month
   - **Notes** — free-form context, blockers, decisions
3. Click **Save**

The page re-renders with the new automation visible.

### Editing an automation

Three ways:

1. **Click the pencil icon** at the end of any row in the table view → opens the full drawer
2. **Click any cell** in the table → opens a small editor right where you clicked. Works for the name, tags, type, effort, priority, status, assigned stakeholder, and target date.
3. **Click a card** in the kanban view → opens the full drawer

### Switching views

A toggle in the upper right above the table/kanban area lets you flip between:

- **Table** — denser, all fields visible, best for editing
- **Kanban** — visual board grouped by status, best for moving things along

In the kanban view you can **drag a card** between columns to change its status — saves automatically. Hovering a non-deployed card shows a one-click **Mark Deployed** action.

### Search and filters

- **Search box** (top right of the table or kanban) — searches across name, tags, stakeholder, notes
- **Filter dropdowns** (above the table only) — narrow by Type, Effort, Priority, Status
- **Clear All** — resets every filter at once

### Printing or saving as PDF

1. Click the **🖨 print icon** in the page header
2. The browser print dialog opens
3. To save as PDF, choose "Save as PDF" as the destination
4. The printed view automatically hides nav chrome, the drawer, and edit buttons — it's a clean snapshot of the table

This is the recommended way to share a roadmap snapshot with someone who isn't logged into Rewst.

### Dark / light mode

A 🌙 / ☀️ toggle in the page header. Defaults to dark. The choice persists across sessions on the same device/browser.

---

## Benefit Tags Reference

There are 7 benefit tags. Pick the ones that best describe the *business outcome* the automation delivers — not what it does. ("Onboard New User" is the automation; "IT Team Efficiency" is the benefit.)

| Tag | What it means | Example automations |
|---|---|---|
| **IT Team Efficiency** | Frees up the IT/MSP team | Ticket triage, password resets, user provisioning |
| **Employee Experience** | Improves the experience for end-employees | Smooth onboarding, fast access to apps, easy offboarding |
| **Customer Experience** | Improves outcomes for end-customers | Faster billing, accurate quotes, proactive service |
| **Security & Compliance** | Reduces risk or improves audit-readiness | AD group sync, patch management, offboarding access removal |
| **Cost Reduction** | Money you would've spent that you didn't | License audits, vendor consolidation, error-cost reduction |
| **Revenue Capture** | Money you would've missed that you recovered | Billing reconciliation, expiring contract follow-up, under-billing audits |
| **Service Quality** | Reliability, SLA, accuracy improvements | Monitoring & alerting, automated escalations, daily health checks |

**Most automations have 1–2 primary benefit tags.** Three is occasionally appropriate. If you find yourself reaching for 4+ tags on one automation, the tags probably aren't all primary — pick the strongest two and let the rest go.

> 💡 **Cost Reduction vs Revenue Capture is intentional.** Cost Reduction is *defensive* (avoiding spend); Revenue Capture is *offensive* (capturing missed income). A board member hearing "we recovered $40K/mo in missed billings" reacts differently than "we cut $40K/mo in licensing." Different stories, both worth telling.

---

## Common Questions

### Where does the data live?

In a single **org variable** called `roadmap_data` on your Rewst org. The page reads it on load and writes the full record back on every save. Don't manually edit this variable in Rewst's Org Variables UI unless you really know what you're doing.

### I tagged an automation wrong. How do I fix it?

Open the automation (pencil icon or click the row), swap the tag in the **Benefit Tags** field, and save. The hero strip updates on the next render.

### The hours saved seem high or low to me.

The numbers come from the **Hours per Execution × Executions per Month** fields on each row. If they look off, audit those fields — that's the source of every time-savings number on the page. The estimation caveat on the "By the Numbers" tile says this explicitly.

### Can multiple people edit the roadmap?

Yes, if they have access to the app in Rewst. Anyone who can view the page can also edit it — there's no read-only mode currently. The data lives in a single shared org variable, so concurrent edits will overwrite each other (last save wins). For now, coordinate by team norms — e.g. one person owns updates, others review.

### How do I share the roadmap with someone who doesn't have Rewst access?

Use the **🖨 Print** button in the page header and choose "Save as PDF" in your browser's print dialog. That produces a clean snapshot suitable for emailing or attaching to a status report.

### A field I need isn't there. Can I add one?

Yes — the page is designed to be extensible. New fields, new benefit tags, new views are all possible. See `CLAUDE.md` in the repo for the architecture and how to modify it. After your changes, run `node build.js` and re-paste the compiled HTML into Rewst.
