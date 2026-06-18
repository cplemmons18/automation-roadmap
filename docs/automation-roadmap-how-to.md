# Automation Roadmap — Internal How-To Guide

A reference for AS and CS teams on **using** the Automation Roadmap page with a customer and **deploying** it to a new customer's environment.

> 📹 **Video walkthrough coming soon** — a recorded demo will be added to this page once available.

---

## What is the Automation Roadmap?

A single-page dashboard you add to a customer's Rewst environment to track, prioritize, and visualize the automations on their roadmap. It's designed to give a business leader an at-a-glance view of:

- What benefits their deployed automations are delivering
- What's on the way
- How much time the team is saving per month

Everything is manually entered — the page is a planning artifact, not a live workflow dashboard.

---

## Part 1: Using the Page

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
- ℹ️ Note: these numbers are estimates entered by the team, not measured. The tile says so explicitly.

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
   - **Assigned Stakeholder** — the customer-side POC for blockers, testing sign-off, etc.
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

In the kanban view you can **drag a card** between columns to change its status — saves automatically.

### Search and filters

- **Search box** (top right of the table or kanban) — searches across name, tags, stakeholder, notes
- **Filter dropdowns** (above the table only) — narrow by Type, Effort, Priority, Status
- **Clear All** — resets every filter at once

### Printing or saving as PDF

1. Click the **🖨 print icon** in the page header
2. The browser print dialog opens
3. To save as PDF, choose "Save as PDF" as the destination
4. The printed view automatically hides nav chrome, the drawer, and edit buttons — it's a clean snapshot of the table

This is the recommended way to share a roadmap snapshot with a customer who isn't logged into Rewst.

### Dark / light mode

A 🌙 / ☀️ toggle in the page header. Defaults to dark. The choice persists across sessions on the same device/browser.

---

## Part 2: Benefit Tags Reference

There are 7 benefit tags. Pick the ones that best describe the *business outcome* the automation delivers — not what it does. ("Onboard New User" is the automation; "IT Team Efficiency" is the benefit.)

| Tag | What it means | Example automations |
|---|---|---|
| **IT Team Efficiency** | Frees up the IT/MSP team | Ticket triage, password resets, user provisioning |
| **Employee Experience** | Improves the experience for the customer's end-employees | Smooth onboarding, fast access to apps, easy offboarding |
| **Customer Experience** | Improves outcomes for the customer's end-customers | Faster billing, accurate quotes, proactive service |
| **Security & Compliance** | Reduces risk or improves audit-readiness | AD group sync, patch management, offboarding access removal |
| **Cost Reduction** | Money you would've spent that you didn't | License audits, vendor consolidation, error-cost reduction |
| **Revenue Capture** | Money you would've missed that you recovered | Billing reconciliation, expiring contract follow-up, under-billing audits |
| **Service Quality** | Reliability, SLA, accuracy improvements | Monitoring & alerting, automated escalations, daily health checks |

**Most automations have 1-2 primary benefit tags.** Three is occasionally appropriate. If you find yourself reaching for 4+ tags on one automation, the tags probably aren't all primary — pick the strongest two and let the rest go.

> 💡 **Cost Reduction vs Revenue Capture is intentional.** Cost Reduction is *defensive* (avoiding spend); Revenue Capture is *offensive* (capturing missed income). A board member hearing "we recovered $40K/mo in missed billings" reacts differently than "we cut $40K/mo in licensing." Different stories for the customer.

---

## Part 3: Deploying to a Customer's Environment

This section walks through copying the page from the internal Templates V2 org into a customer's tenant.

### Step 1: Open the template source for your customer's region

The Automation Roadmap template lives in a Rewst-managed templates org in each region. **Use the source that matches the platform your customer is on** — copying from the wrong region's template won't break anything, but you may pick up an out-of-date version.

| Region | Platform | Templates V2 source |
|---|---|---|
| **US** | app.rewst.io | [https://app.rewst.io/organizations/23221084-7bf8-4fa6-9b8b-0a18ddf4e02e/apps](https://app.rewst.io/organizations/23221084-7bf8-4fa6-9b8b-0a18ddf4e02e/apps) |
| **UK** | app.eu.rewst.io | [https://app.eu.rewst.io/organizations/bfb3ab89-d3fc-49cf-855d-3d14fa1917aa/apps](https://app.eu.rewst.io/organizations/bfb3ab89-d3fc-49cf-855d-3d14fa1917aa/apps) |
| **EU** | app.rewst.eu | [https://app.rewst.eu/organizations/bfb3ab89-d3fc-49cf-855d-3d14fa1917aa/apps](https://app.rewst.eu/organizations/bfb3ab89-d3fc-49cf-855d-3d14fa1917aa/apps) |

> 💡 **Not sure which region?** Check the URL of the customer's Rewst tenant. If it ends in `.eu.rewst.io` they're on UK, `.rewst.eu` is EU, and plain `app.rewst.io` is US.

Once you've opened the right Templates V2 page:

1. Open the **Automation Roadmap** app
2. Open the **Home** page

### Step 2: Copy the HTML

1. On the home page, find the **HTML container** component
2. Open it for editing
3. Select and copy **all** the HTML inside the container (it's a single self-contained block)

### Step 3: Create the app in the customer's environment

1. Switch to the customer's org in Rewst
2. Go to **Apps** → **New App**
3. Name it (e.g. "Automation Roadmap")
4. Create a **Home** page on the new app

### Step 4: Paste the HTML

1. On the new home page, drag an **HTML container** component onto the canvas
2. Open the container for editing
3. Paste the HTML you copied in Step 2
4. Save the page

### Step 5: First-load check

1. Open the page as a user with access
2. The roadmap should render with an "No automations on the roadmap yet" empty state
3. Click **+ Add Automation** to add the first item, or **Load Sample Data** to populate with example automations
4. Confirm that adding an automation persists across page refreshes

> ✅ **The page automatically creates the `roadmap_data` org variable on first save.** No need to set up the variable manually in Rewst — the page handles it. It's scoped to the customer's org (cascade off), so each customer has their own roadmap data.

---

## Part 4: Common Questions

### Where does the data live?
In a single **org variable** called `roadmap_data` on the customer's org. The page reads it on load and writes the full record back on every save. Don't manually edit this variable in Rewst's Org Variables UI unless you really know what you're doing.

### What if a customer already has a Cost Reduction-tagged automation that's really Revenue Capture?
Re-tag it manually. Open the automation, swap the tag in the Benefit Tags field, save. The hero strip will update on the next render.

### The hours saved seem high / low to me.
The numbers come from what your team entered in the **Hours per Execution × Executions per Month** fields on each row. If they look off, audit those fields — that's the source of every time-savings number on the page. The estimation caveat on the "By the Numbers" tile says this explicitly.

### Can a customer log in and edit their own roadmap?
Yes, if they have access to the app in Rewst. Anyone who can view the page can also edit it — there's no read-only mode currently. AS/CS typically owns the page on behalf of the customer, but it's the customer's data and they're welcome to update it.

### What if I need to share the roadmap with someone who doesn't have Rewst access?
Use the **🖨 Print** button and "Save as PDF" in the browser print dialog. That produces a clean snapshot suitable for emailing or attaching to a customer success report.

### A field I need isn't there. Can we add one?
File a request — the page is designed to be extensible. New fields, new benefit tags, new views are all possible. The current shape was iterated on with the team and represents what's most useful today, but it's not set in stone.

---

## Part 5: Quick-Reference Checklist for First-Time Deployment

- [ ] Open Templates V2 → Automation Roadmap app → Home page
- [ ] Copy all HTML from the HTML container
- [ ] Switch to customer's org
- [ ] Create new app + Home page + HTML container in customer's org
- [ ] Paste the HTML, save
- [ ] Load the page, verify empty state renders
- [ ] Add the first automation (or load sample data to demo)
- [ ] Walk the customer through the page during your next sync
- [ ] Set a recurring touchpoint to keep the roadmap fresh

---

*Questions? Reach out in #automation-roadmap on Slack.*
