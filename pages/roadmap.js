// ============================================
// AUTOMATION ROADMAP PAGE
// CRUD against an org variable named 'roadmap_data'.
// Phase 2: edit drawer + add/delete via the slide-out drawer.
// ============================================

const ROADMAP_VAR_NAME = 'roadmap_data';
const ROADMAP_VAR_CATEGORY = 'general';
const ROADMAP_VAR_CASCADE = false; // each customer org has its own roadmap

const ROADMAP_ENUMS = {
  type: ['Crate', 'Custom'],
  effort: ['Low', 'Medium', 'High'],
  priority: ['Low', 'Medium', 'High'],
  status: ['Not Started', 'In Progress', 'Testing', 'Deployed', 'Blocked'],
  // Benefit tags — multi-select descriptors of the *benefit* an automation
  // delivers (not what the automation does). Seven tags, tight on purpose:
  // this is the business-leader story, not a technical taxonomy.
  //
  // Cost Reduction and Revenue Capture are intentionally separate. Cost
  // Reduction is defensive (money you would've spent that you didn't);
  // Revenue Capture is offensive (money you would've missed that you
  // recovered — e.g. billing reconciliation, expiring contract follow-up,
  // license under-billing audits). Different stories for a business leader.
  tags: [
    'IT Team Efficiency',
    'Employee Experience',
    'Customer Experience',
    'Security & Compliance',
    'Cost Reduction',
    'Revenue Capture',
    'Service Quality',
  ],
};

// Map legacy category names (single value, from the very-first taxonomy)
// to new tag name(s) for migration. Idempotent — once a save happens after
// migration, the persisted shape catches up.
const LEGACY_CATEGORY_TO_TAG = {
  'Onboarding & Lifecycle':    'IT Team Efficiency',
  'Security & Compliance':     'Security & Compliance',
  'IT Operations & Help Desk': 'IT Team Efficiency',
  'Cost & License Management': 'Cost Reduction',
  'Reporting & Visibility':    'Service Quality',
  'Customer Experience':       'Customer Experience',
};

// Map intermediate 13-tag names (the descriptor taxonomy) to the new
// 6-tag benefit names. Anything not in this map gets carried through
// verbatim — unrecognized values render as gray chips rather than being
// silently dropped, so users can see and fix them.
const LEGACY_TAG_TO_TAG = {
  // Lifecycle / people-related → IT Team Efficiency (the main savings)
  'Onboarding':              'IT Team Efficiency',
  'Offboarding':             'Security & Compliance', // common offboarding driver
  'User Provisioning':       'IT Team Efficiency',
  // Risk family
  'Security & Compliance':   'Security & Compliance',
  'Incident Response':       'Service Quality',
  // Ops family → IT Team Efficiency mostly
  'Help Desk & Ticketing':   'IT Team Efficiency',
  'Monitoring & Alerting':   'Service Quality',
  'Patch Management':        'Security & Compliance',
  // Spend
  'Cost & License Management': 'Cost Reduction',
  'Vendor & Procurement':    'Cost Reduction',
  // Visibility / docs
  'Reporting & Analytics':   'Service Quality',
  'Documentation':           'IT Team Efficiency',
  // Outward
  'Customer Experience':     'Customer Experience',
};

// ============================================
// BADGE STYLING
// Inline styles so we don't depend on adding new badge-* classes to the CSS.
// Hex values mirror the Rewst brand variables (see rewst-override-tailwind.css).
// ============================================
// CSS-var-driven so badges auto-swap between light/dark modes.
// Tokens defined in rewst-override-tailwind.css (:root + html.dark blocks).
const BADGE_STYLES = {
  teal:     'color: var(--badge-teal-text);     background-color: var(--badge-teal-bg);',
  fandango: 'color: var(--badge-fandango-text); background-color: var(--badge-fandango-bg);',
  orange:   'color: var(--badge-orange-text);   background-color: var(--badge-orange-bg);',
  success:  'color: var(--badge-success-text);  background-color: var(--badge-success-bg);',
  error:    'color: var(--badge-error-text);    background-color: var(--badge-error-bg);',
  gray:     'color: var(--badge-gray-text);     background-color: var(--badge-gray-bg);',
};

// Per-value color assignments. Anything not listed falls through to gray.
const BADGE_MAP = {
  type: {
    'Crate':  'teal',
    'Custom': 'fandango',
  },
  effort: {
    'Low':    'success',
    'Medium': 'orange',
    'High':   'error',
  },
  priority: {
    'High':   'error',
    'Medium': 'orange',
    'Low':    'success',
  },
  status: {
    'Not Started': 'gray',
    'In Progress': 'teal',
    'Testing':     'orange',
    'Deployed':    'success',
    'Blocked':     'error',
  },
  tags: {
    'IT Team Efficiency':    'teal',      // the workhorse — most automations
    'Employee Experience':   'success',   // green — helping internal users
    'Customer Experience':   'fandango',  // brand-aligned outward color
    'Security & Compliance': 'error',     // red — risk reduction
    'Cost Reduction':        'orange',    // defensive — money saved
    'Revenue Capture':       'orange',    // offensive — money recovered (shares orange; both financial)
    'Service Quality':       'gray',      // neutral reliability
  },
};

function _badge(text, colorKey, opts = {}) {
  if (text === null || text === undefined || text === '') return '';
  const style = BADGE_STYLES[colorKey] || BADGE_STYLES.gray;
  // Escape minimal — values come from a known enum so no XSS surface here,
  // but be defensive in case malformed data sneaks in.
  const safe = String(text).replace(/</g, '&lt;');
  if (opts.editable) {
    return `<span class="badge cursor-pointer hover:opacity-80 transition-opacity" style="${style}" data-edit-cell="${opts.rowId}" data-edit-field="${opts.field}" title="Click to change">${safe}</span>`;
  }
  return `<span class="badge" style="${style}">${safe}</span>`;
}

// ============================================
// DATA LAYER
// ============================================
//
// load()    → array of roadmap rows (seeds with [] if missing)
// save(rows) → updateOrgVariables mutation, full record round-trip
//
// Single getOrgVariables() round-trip per load — we need both the value
// and the variable's id (for the update mutation), so we do one fetch
// and pull both out of the same response.
//
const RoadmapData = {
  _cachedVar: null,

  async load() {
    debugLog('[Roadmap] load()');

    // Use a targeted name+orgId query so we find the variable even when
    // getOrgVariablesWithOrg()'s 500-item cap would miss it. (Real bug —
    // orgs with >500 variables saw `roadmap_data` past the cutoff, load
    // thought it was missing, save-then-refresh wiped the data.)
    const myOrgId = rewst.orgId;
    const matches = await rewst.getOrgVariablesWithOrgByName(ROADMAP_VAR_NAME, myOrgId);

    // Defensive re-filter by owning org id — the lib already filters but cascade
    // edge cases (parent's variable showing up via the scan fallback) make it
    // worth the belt-and-suspenders check.
    let variable = matches.find(v => v.organization?.id === myOrgId) || null;

    if (!variable) {
      debugLog('[Roadmap] variable not found for this org, seeding empty array');
      await this._seed();
      return [];
    }

    this._cachedVar = variable;
    return this._parseValue(variable.value).map(_migrateRow);
  },

  async save(rows) {
    debugLog('[Roadmap] save()', rows.length, 'rows');

    let variable = this._cachedVar;

    // Edge case: cache empty (e.g. mid-session) — re-fetch using the same
    // targeted query as load() so the 500-item cap can't cause a false miss.
    if (!variable) {
      const myOrgId = rewst.orgId;
      const matches = await rewst.getOrgVariablesWithOrgByName(ROADMAP_VAR_NAME, myOrgId);
      variable = matches.find(v => v.organization?.id === myOrgId) || null;
      if (!variable) {
        debugWarn('[Roadmap] variable missing on save, re-seeding');
        return this._seed(rows);
      }
      this._cachedVar = variable;
    }

    const mutation = `
      mutation updateOrgVariablesFromListPage($orgVariables: [OrgVariableUpdateInput!]!) {
        updateOrgVariables(orgVariables: $orgVariables) {
          id
          name
          value
          category
          cascade
          orgId
          updatedAt
        }
      }
    `;

    const input = {
      id: variable.id,
      name: variable.name,
      value: JSON.stringify(rows),
      category: variable.category,
      cascade: variable.cascade,
      orgId: variable.organization?.id || variable.orgId || rewst.orgId,
    };

    const result = await rewst._graphql(
      'updateOrgVariablesFromListPage',
      mutation,
      { orgVariables: [input] }
    );

    if (result?.updateOrgVariables?.[0]) {
      this._cachedVar = result.updateOrgVariables[0];
    }

    return this._cachedVar;
  },

  async _seed(initialRows = []) {
    const mutation = `
      mutation createOrgVariable($orgVariable: OrgVariableCreateInput!) {
        createOrgVariable(orgVariable: $orgVariable) {
          id
          name
          value
          category
          cascade
          orgId
          createdAt
          updatedAt
        }
      }
    `;

    const input = {
      name: ROADMAP_VAR_NAME,
      value: JSON.stringify(initialRows),
      category: ROADMAP_VAR_CATEGORY,
      cascade: ROADMAP_VAR_CASCADE,
      orgId: rewst.orgId,
    };

    const result = await rewst._graphql(
      'createOrgVariable',
      mutation,
      { orgVariable: input }
    );

    this._cachedVar = result?.createOrgVariable || null;
    debugLog('[Roadmap] seeded variable', this._cachedVar?.id);
    return this._cachedVar;
  },

  _parseValue(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') return value;
    if (!value || value === 'null') return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        debugError('[Roadmap] failed to parse stored value', e, value);
        return [];
      }
    }
    return [];
  },
};

window.RoadmapData = RoadmapData;
try {
  if (window.parent && window.parent !== window) {
    window.parent.RoadmapData = RoadmapData;
  }
} catch (e) { /* cross-origin parent */ }

// ============================================
// TIMESTAMP PARSER
// Rewst API returns updatedAt in formats that aren't always ISO — handles
// strings, numbers, and Unix epoch (seconds or milliseconds). Returns null
// for anything unparseable so callers can skip rendering rather than show
// "Invalid Date".
// ============================================
function _parseRewstTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  if (typeof value === 'string') {
    // Try direct ISO / RFC parse first
    let d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    // Fall through: maybe a numeric epoch as a string
    const asNum = Number(value);
    if (!isNaN(asNum) && asNum > 0) {
      d = new Date(asNum < 1e12 ? asNum * 1000 : asNum); // seconds vs ms
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  if (typeof value === 'number') {
    const d = new Date(value < 1e12 ? value * 1000 : value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

// ============================================
// MONTHLY-HOURS HELPER
// hoursPerExecution × executionsPerMonth per row. Both come from manual entry —
// the roadmap is a planning artifact, not a live execution dashboard.
// (For live workflow performance, customers should use Rewst's built-in dashboard.)
// ============================================
function _monthlyHoursFor(row) {
  const h = parseFloat(row?.hoursPerExecution) || 0;
  const e = parseFloat(row?.executionsPerMonth) || 0;
  return h * e;
}

// ============================================
// PAGE STATE
// In-memory copy of the roadmap. Edit drawer mutates this, then save() persists.
// view persists across sessions via localStorage so a user who picks Kanban
// once gets Kanban next time they open the page.
// ============================================
const RoadmapState = {
  rows: [],
  // formState mirrors the dropdown selections + text inputs while the drawer is open
  formState: null,
  editingId: null, // null = creating a new row, otherwise id of row being edited
  view: (() => {
    try {
      // One-time migration: pre-hardening key was unscoped 'roadmap-view'.
      // If it exists and the new key doesn't, copy it over and remove the old.
      const oldKey = 'roadmap-view';
      const newKey = 'rewst-roadmap-view';
      const old = localStorage.getItem(oldKey);
      if (old !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, old);
        localStorage.removeItem(oldKey);
      }
      let stored = localStorage.getItem(newKey);
      // Migrate the legacy 'category' and 'tags' view names — both collapse
      // to 'kanban' since the per-tag/per-category kanban view was retired
      // (Tag Coverage tile in the hero strip carries that story instead).
      if (stored === 'category' || stored === 'tags') {
        stored = 'kanban';
        try { localStorage.setItem(newKey, 'kanban'); } catch (e) { /* ignore */ }
      }
      // Valid values: 'table', 'kanban' (by status)
      if (stored === 'kanban') return 'kanban';
      return 'table';
    } catch (e) { return 'table'; }
  })(),
  // Kanban-only client-side filter (table has its own filters via createTable).
  // Search is debounced; priority is instant on dropdown change.
  kanbanFilter: { search: '', priority: 'all' },
};

// Debounce timer for the kanban search input
let _kanbanSearchDebounce = null;

function _newRowDraft() {
  return {
    id: null, // assigned on save
    name: '',
    tags: [],                      // multi-select — zero or more from ROADMAP_ENUMS.tags
    type: 'Custom',
    effort: 'Medium',
    priority: 'Medium',
    status: 'Not Started',
    assignedStakeholder: '', // customer-side POC (free text)
    targetDate: '',
    hoursPerExecution: 0,
    executionsPerMonth: 0,
    notes: '',
  };
}

function _uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Idempotent migrations — runs on every load so old data gets fixed transparently.
// Once a save happens after this, the persisted shape catches up.
function _migrateRow(row) {
  let m = row;

  // 1. Legacy `deadline` → `targetDate`
  if (m && m.deadline !== undefined && m.targetDate === undefined) {
    const { deadline, ...rest } = m;
    m = { ...rest, targetDate: deadline };
  }

  // 2. Legacy `hoursSavedPerMonth` → split into hoursPerExecution + executionsPerMonth.
  //    Preserve total monthly hours by setting hoursPerExecution=1 and
  //    executionsPerMonth=oldValue. User can then edit to more meaningful numbers.
  if (m && m.hoursSavedPerMonth !== undefined
        && m.hoursPerExecution === undefined
        && m.executionsPerMonth === undefined) {
    const { hoursSavedPerMonth, ...rest } = m;
    m = {
      ...rest,
      hoursPerExecution: 1,
      executionsPerMonth: parseFloat(hoursSavedPerMonth) || 0,
    };
  }

  // 3. Legacy `category` (single string) → `tags` (array). Map old enum names
  //    to current tag names via LEGACY_CATEGORY_TO_TAG. Unknown values get
  //    carried through verbatim so we don't silently drop classification.
  if (m && m.tags === undefined) {
    if (m.category && typeof m.category === 'string') {
      const mapped = LEGACY_CATEGORY_TO_TAG[m.category] || m.category;
      const { category, ...rest } = m;
      m = { ...rest, tags: [mapped] };
    } else {
      const { category, ...rest } = m;
      m = { ...rest, tags: [] };
    }
  } else if (m && !Array.isArray(m.tags)) {
    // Defensive: if tags somehow got persisted as a non-array, coerce.
    m = { ...m, tags: m.tags ? [String(m.tags)] : [] };
  }

  // 4. Tag-name remap: legacy 13-tag descriptor names → 6-tag benefit names.
  //    De-duplicate after mapping (two old tags can collapse onto the same
  //    new tag). Idempotent — when all values already match the new list,
  //    nothing changes.
  if (m && Array.isArray(m.tags) && m.tags.length > 0) {
    const remapped = m.tags.map(t => LEGACY_TAG_TO_TAG[t] || t);
    const deduped = Array.from(new Set(remapped));
    // Skip the assignment if nothing changed — avoids gratuitous object churn.
    const same = deduped.length === m.tags.length
      && deduped.every((v, i) => v === m.tags[i]);
    if (!same) m = { ...m, tags: deduped };
  }

  return m;
}

// ============================================
// SAMPLE DATA (Phase 1 fallback for empty state)
// ============================================
function _generateSampleRoadmapRows() {
  return [
    { id: _uuid(), name: 'Onboard New User',         tags: ['IT Team Efficiency', 'Employee Experience'], type: 'Crate',  effort: 'Low',    priority: 'High',   status: 'Deployed',    assignedStakeholder: 'Mike Chen (IT Director)',   targetDate: '2026-04-01', hoursPerExecution: 2,    executionsPerMonth: 4,  notes: 'Live since April. Saving roughly 2h per onboarding.' },
    { id: _uuid(), name: 'Daily Backup Check',       tags: ['Service Quality'],                            type: 'Custom', effort: 'Medium', priority: 'Medium', status: 'In Progress', assignedStakeholder: '',                          targetDate: '2026-05-15', hoursPerExecution: 0.15, executionsPerMonth: 30, notes: '' },
    { id: _uuid(), name: 'Provision Mailbox',        tags: ['IT Team Efficiency', 'Employee Experience'], type: 'Crate',  effort: 'Low',    priority: 'High',   status: 'Testing',     assignedStakeholder: 'Mike Chen (IT Director)',   targetDate: '2026-05-20', hoursPerExecution: 1,    executionsPerMonth: 6,  notes: 'Customer wants this out before the next hire wave.' },
    { id: _uuid(), name: 'Sync AD Groups',           tags: ['Security & Compliance'],                      type: 'Custom', effort: 'High',   priority: 'Low',    status: 'Not Started', assignedStakeholder: 'Sara Patel (Sysadmin)',     targetDate: '2026-06-30', hoursPerExecution: 0.5,  executionsPerMonth: 20, notes: '' },
    { id: _uuid(), name: 'Alert on Disk Full',       tags: ['Service Quality', 'IT Team Efficiency'],     type: 'Crate',  effort: 'Low',    priority: 'High',   status: 'Blocked',     assignedStakeholder: 'Tom Reeves (AD Admin)',     targetDate: '2026-05-10', hoursPerExecution: 0.25, executionsPerMonth: 8,  notes: 'Blocked on AD admin access — emailed Tom 5/2, no reply.' },
    { id: _uuid(), name: 'Billing Reconciliation',   tags: ['Revenue Capture'],                            type: 'Custom', effort: 'Medium', priority: 'High',   status: 'Not Started', assignedStakeholder: 'Sara Patel (Sysadmin)',     targetDate: '2026-07-15', hoursPerExecution: 0.5,  executionsPerMonth: 40, notes: 'Catches under-billed and missed invoice line items — recovering revenue that would otherwise be left on the table.' },
  ];
}

// ============================================
// EDIT DRAWER
// ============================================
function _openRoadmapDrawer(existingRow) {
  // Establish form state — copy of existing row, or fresh draft.
  // tags must be cloned (array reference) so drawer edits don't mutate the
  // persisted row until Save is clicked.
  if (existingRow) {
    RoadmapState.editingId = existingRow.id;
    RoadmapState.formState = {
      ...existingRow,
      tags: Array.isArray(existingRow.tags) ? [...existingRow.tags] : [],
    };
  } else {
    RoadmapState.editingId = null;
    RoadmapState.formState = _newRowDraft();
  }

  document.getElementById('drawer-title').textContent = existingRow ? 'Edit Automation' : 'New Automation';

  const body = document.getElementById('drawer-body');
  body.innerHTML = '';

  // ---- Form layout ----
  const form = document.createElement('div');
  form.className = 'flex flex-col gap-5';

  // Name
  form.appendChild(_field({
    label: 'Name',
    required: true,
    control: (() => {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'e.g. Onboard New User';
      input.value = RoadmapState.formState.name || '';
      input.className = 'w-full px-3 py-2 border-2 border-rewst-light-gray rounded-md text-sm focus:ring-2 focus:ring-rewst-teal focus:border-rewst-teal outline-none';
      input.id = 'drawer-field-name';
      input.addEventListener('input', () => {
        RoadmapState.formState.name = input.value;
      });
      return input;
    })(),
  }));

  // Type
  form.appendChild(_field({
    label: 'Type',
    control: _dropdownFor('type', RoadmapState.formState.type),
  }));

  // Tags (multi-select, optional)
  form.appendChild(_field({
    label: 'Benefit Tags',
    control: _tagsMultiSelectFor(RoadmapState.formState.tags),
  }));

  // Effort
  form.appendChild(_field({
    label: 'Effort',
    control: _dropdownFor('effort', RoadmapState.formState.effort),
  }));

  // Priority
  form.appendChild(_field({
    label: 'Priority',
    control: _dropdownFor('priority', RoadmapState.formState.priority),
  }));

  // Status
  form.appendChild(_field({
    label: 'Status',
    control: _dropdownFor('status', RoadmapState.formState.status),
  }));

  // Assigned Stakeholder (customer-side POC — free text)
  form.appendChild(_field({
    label: 'Assigned Stakeholder',
    control: (() => {
      const wrap = document.createElement('div');
      wrap.className = 'flex flex-col gap-1';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'e.g. Mike Chen (IT Director)';
      input.id = 'drawer-field-assignedStakeholder';
      input.value = RoadmapState.formState.assignedStakeholder || '';
      input.className = 'w-full px-3 py-2 border-2 border-rewst-light-gray rounded-md text-sm focus:ring-2 focus:ring-rewst-teal focus:border-rewst-teal outline-none';
      input.addEventListener('input', () => {
        RoadmapState.formState.assignedStakeholder = input.value;
      });

      const caption = document.createElement('p');
      caption.className = 'text-xs text-rewst-gray';
      caption.textContent = 'The customer-side person driving this — POC for blockers, testing sign-off, etc.';

      wrap.appendChild(input);
      wrap.appendChild(caption);
      return wrap;
    })(),
  }));

  // Target Date — custom picker (replaces native input[type=date])
  form.appendChild(_field({
    label: 'Target Date',
    control: (() => {
      const wrap = document.createElement('div');
      wrap.className = 'relative flex flex-col gap-1';

      // Clickable display button — shows current value or placeholder
      const display = document.createElement('button');
      display.type = 'button';
      display.id = 'drawer-field-targetDate';
      display.className = 'w-full px-3 py-2 border-2 border-rewst-light-gray rounded-md text-sm bg-white dark:bg-gray-800 hover:border-rewst-gray flex items-center justify-between cursor-pointer transition-colors';

      const displayText = document.createElement('span');
      const calIcon = document.createElement('span');
      calIcon.className = 'material-icons text-rewst-gray';
      calIcon.style.fontSize = '18px';
      calIcon.textContent = 'event';
      display.appendChild(displayText);
      display.appendChild(calIcon);
      wrap.appendChild(display);

      const updateDisplay = () => {
        const v = RoadmapState.formState.targetDate;
        if (v) {
          displayText.textContent = v;
          displayText.className = 'text-rewst-dark-gray';
        } else {
          displayText.textContent = 'Select date…';
          displayText.className = 'text-rewst-gray italic';
        }
      };
      updateDisplay();

      // Past-date warning — sits below the display
      const warning = document.createElement('p');
      warning.id = 'drawer-targetDate-warning';
      warning.style.color = 'var(--rewst-warning, #F9A100)';
      warning.className = 'text-xs hidden flex items-center gap-1';
      warning.innerHTML = '<span class="material-icons" style="font-size: 14px;">warning_amber</span><span>Date is in the past — heads up</span>';
      wrap.appendChild(warning);

      const checkPast = () => {
        const v = RoadmapState.formState.targetDate;
        if (!v) { warning.classList.add('hidden'); return; }
        const picked = new Date(v + 'T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        warning.classList.toggle('hidden', picked >= today);
      };
      setTimeout(checkPast, 0);

      // Picker overlay (lazy-created on first open)
      let pickerEl = null;
      let outsideHandler = null;

      const closePicker = () => {
        if (pickerEl) {
          pickerEl.remove();
          pickerEl = null;
        }
        if (outsideHandler) {
          document.removeEventListener('mousedown', outsideHandler);
          outsideHandler = null;
        }
      };

      const openPicker = () => {
        if (pickerEl) { closePicker(); return; }

        pickerEl = document.createElement('div');
        pickerEl.className = 'absolute left-0 top-full mt-1 z-30';
        const picker = _renderDatePicker(RoadmapState.formState.targetDate, {
          onSelect: (iso) => {
            RoadmapState.formState.targetDate = iso;
            updateDisplay();
            checkPast();
            closePicker();
          },
          onClear: () => {
            RoadmapState.formState.targetDate = '';
            updateDisplay();
            checkPast();
            closePicker();
          },
        });
        pickerEl.appendChild(picker);
        wrap.appendChild(pickerEl);

        // Close on outside click — register after a tick so the same click that
        // opened the picker doesn't immediately close it
        setTimeout(() => {
          outsideHandler = (e) => {
            if (!wrap.contains(e.target)) closePicker();
          };
          document.addEventListener('mousedown', outsideHandler);
        }, 0);
      };

      display.addEventListener('click', openPicker);

      return wrap;
    })(),
  }));

  // Time-savings fields — drive the monthly hours math (hoursPerExecution × executionsPerMonth).
  // These are user-supplied estimates; refine as the automation matures.

  // Hours per Execution
  form.appendChild(_field({
    label: 'Hours per Execution',
    control: (() => {
      const wrap = document.createElement('div');
      wrap.className = 'flex flex-col gap-1';

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '0.05';
      input.placeholder = '0';
      input.id = 'drawer-field-hoursPerExecution';
      input.value = RoadmapState.formState.hoursPerExecution ?? 0;
      input.className = 'w-full px-3 py-2 border-2 border-rewst-light-gray rounded-md text-sm focus:ring-2 focus:ring-rewst-teal focus:border-rewst-teal outline-none';

      const caption = document.createElement('p');
      caption.className = 'text-xs text-rewst-gray';
      caption.textContent = 'Time the automation saves on each run (e.g., 0.5 = 30 min).';

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        RoadmapState.formState.hoursPerExecution = isNaN(v) ? 0 : Math.max(0, v);
      });

      wrap.appendChild(input);
      wrap.appendChild(caption);
      return wrap;
    })(),
  }));

  // Executions per Month
  form.appendChild(_field({
    label: 'Executions per Month',
    control: (() => {
      const wrap = document.createElement('div');
      wrap.className = 'flex flex-col gap-1';

      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.placeholder = '0';
      input.id = 'drawer-field-executionsPerMonth';
      input.value = RoadmapState.formState.executionsPerMonth ?? 0;
      input.className = 'w-full px-3 py-2 border-2 border-rewst-light-gray rounded-md text-sm focus:ring-2 focus:ring-rewst-teal focus:border-rewst-teal outline-none';

      const caption = document.createElement('p');
      caption.className = 'text-xs text-rewst-gray';
      caption.textContent = 'Estimated runs each month.';

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        RoadmapState.formState.executionsPerMonth = isNaN(v) ? 0 : Math.max(0, v);
      });

      wrap.appendChild(input);
      wrap.appendChild(caption);
      return wrap;
    })(),
  }));


  // Notes (free-text)
  form.appendChild(_field({
    label: 'Notes',
    control: (() => {
      const ta = document.createElement('textarea');
      ta.id = 'drawer-field-notes';
      ta.rows = 4;
      ta.placeholder = 'Context, blockers, customer asks…';
      ta.value = RoadmapState.formState.notes || '';
      ta.className = 'w-full px-3 py-2 border-2 border-rewst-light-gray rounded-md text-sm focus:ring-2 focus:ring-rewst-teal focus:border-rewst-teal outline-none resize-y leading-relaxed';
      ta.addEventListener('input', () => {
        RoadmapState.formState.notes = ta.value;
      });
      return ta;
    })(),
  }));

  // Action buttons
  const actions = document.createElement('div');
  actions.className = 'flex flex-col gap-2 pt-4 mt-2 border-t border-gray-200';

  const saveBtn = document.createElement('button');
  saveBtn.id = 'drawer-save-btn';
  saveBtn.className = 'btn-primary w-full justify-center flex items-center gap-2';
  saveBtn.innerHTML = '<span class="material-icons">save</span> Save';
  saveBtn.addEventListener('click', _handleDrawerSave);
  actions.appendChild(saveBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn-secondary w-full justify-center flex items-center gap-2';
  cancelBtn.innerHTML = 'Cancel';
  cancelBtn.addEventListener('click', () => window.closeDrawer());
  actions.appendChild(cancelBtn);

  if (RoadmapState.editingId) {
    const deleteBtn = document.createElement('button');
    deleteBtn.id = 'drawer-delete-btn';
    deleteBtn.className = 'btn-tertiary w-full justify-center flex items-center gap-2 mt-4';
    deleteBtn.style.color = 'var(--rewst-error, #C62828)';
    deleteBtn.innerHTML = '<span class="material-icons">delete_outline</span> Delete this automation';
    deleteBtn.addEventListener('click', _handleDrawerDelete);
    actions.appendChild(deleteBtn);
  }

  form.appendChild(actions);
  body.appendChild(form);

  window.openDrawer();

  // Focus the name field for keyboard ergonomics
  setTimeout(() => document.getElementById('drawer-field-name')?.focus(), 50);
}

function _field({ label, required, control }) {
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-1';

  const lbl = document.createElement('label');
  lbl.className = 'text-sm font-medium text-rewst-dark-gray';
  lbl.textContent = label + (required ? ' *' : '');
  wrap.appendChild(lbl);

  wrap.appendChild(control);
  return wrap;
}

function _dropdownFor(fieldKey, currentValue) {
  const options = ROADMAP_ENUMS[fieldKey].map(v => ({ value: v, label: v }));
  const dd = RewstDOM.createStyledDropdown(options, {
    defaultValue: currentValue,
    placeholder: 'Select…',
    onChange: (option, value) => {
      RoadmapState.formState[fieldKey] = value;
    },
  });
  return dd;
}

// Multi-select built on RewstDOM.createMultiSelect. Writes back to
// RoadmapState.formState.tags as an array. Includes a soft hint that
// appears when 4+ tags are selected — non-blocking nudge toward tag
// discipline (most automations have 1-2 primary benefits, not 5).
function _tagsMultiSelectFor(currentTags) {
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-1';

  const options = ROADMAP_ENUMS.tags.map(v => ({ value: v, label: v }));

  const hint = document.createElement('p');
  hint.className = 'text-xs items-start gap-1';
  hint.style.color = 'var(--rewst-warning, #F9A100)';
  hint.style.display = 'none'; // inline display toggle dodges Tailwind class-order issues
  hint.innerHTML = '<span class="material-icons flex-shrink-0" style="font-size: 14px;">warning_amber</span><span class="leading-snug">Most automations have 1–2 primary benefits — consider whether all of these are really primary.</span>';

  const updateHint = (count) => {
    hint.style.display = count >= 4 ? 'flex' : 'none';
  };

  const initial = Array.isArray(currentTags) ? currentTags : [];
  const ms = RewstDOM.createMultiSelect(options, {
    placeholder: 'Add benefit tags…',
    defaultValues: initial,
    onChange: (selectedValues) => {
      const arr = Array.isArray(selectedValues) ? [...selectedValues] : [];
      RoadmapState.formState.tags = arr;
      updateHint(arr.length);
    },
  });

  wrap.appendChild(ms);
  wrap.appendChild(hint);
  updateHint(initial.length);
  return wrap;
}

async function _handleDrawerSave() {
  const draft = RoadmapState.formState;

  // Lightweight validation — name is the only hard requirement.
  if (!draft.name || !draft.name.trim()) {
    RewstDOM.showWarning('Name is required');
    document.getElementById('drawer-field-name')?.focus();
    return;
  }

  // Defensive: tags should always be an array. If somehow stale state slipped
  // in, normalize.
  if (!Array.isArray(draft.tags)) {
    draft.tags = [];
  }

  const saveBtn = document.getElementById('drawer-save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="material-icons animate-spin">refresh</span> Saving…';

  try {
    let nextRows;
    if (RoadmapState.editingId) {
      // UPDATE — replace existing row
      nextRows = RoadmapState.rows.map(r =>
        r.id === RoadmapState.editingId ? { ...draft, id: RoadmapState.editingId } : r
      );
    } else {
      // CREATE — append with new UUID
      const newRow = { ...draft, id: _uuid() };
      nextRows = [...RoadmapState.rows, newRow];
    }

    await RoadmapData.save(nextRows);
    RoadmapState.rows = nextRows;
    RewstDOM.showSuccess(RoadmapState.editingId ? 'Updated' : 'Added');

    // Soft warning if time-savings fields are missing — row will be saved but
    // won't contribute to the hours-saved totals on the page. Non-blocking.
    const missingHours = !(parseFloat(draft.hoursPerExecution) > 0);
    const missingExecs = !(parseFloat(draft.executionsPerMonth) > 0);
    if (missingHours || missingExecs) {
      RewstDOM.showWarning(
        "Saved — heads up, hours per execution and/or executions per month are 0, so this row won't show up in your hours-saved totals.",
        6000
      );
    }

    window.closeDrawer();
    _renderRoadmapBody();
  } catch (err) {
    debugError('[Roadmap] save failed', err);
    RewstDOM.showError('Save failed — see console');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<span class="material-icons">save</span> Save';
  }
}

async function _handleDrawerDelete() {
  if (!RoadmapState.editingId) return;
  const target = RoadmapState.rows.find(r => r.id === RoadmapState.editingId);
  if (!target) return;

  // Lightweight inline confirm — could be a proper modal in Phase 3
  const confirmed = window.confirm(`Delete "${target.name}"? This cannot be undone.`);
  if (!confirmed) return;

  const deleteBtn = document.getElementById('drawer-delete-btn');
  if (deleteBtn) {
    deleteBtn.disabled = true;
    deleteBtn.innerHTML = '<span class="material-icons animate-spin">refresh</span> Deleting…';
  }

  try {
    const nextRows = RoadmapState.rows.filter(r => r.id !== RoadmapState.editingId);
    await RoadmapData.save(nextRows);
    RoadmapState.rows = nextRows;
    RewstDOM.showSuccess('Deleted');
    window.closeDrawer();
    _renderRoadmapBody();
  } catch (err) {
    debugError('[Roadmap] delete failed', err);
    RewstDOM.showError('Delete failed — see console');
    if (deleteBtn) {
      deleteBtn.disabled = false;
      deleteBtn.innerHTML = '<span class="material-icons">delete_outline</span> Delete this automation';
    }
  }
}

// ============================================
// ROADMAP OVERVIEW (4-card metric strip)
// Roadmap Total / Completed / In Progress / Blocked, each with the row count
// and the monthly time saved (hours/month). Driven by hoursPerExecution
// × executionsPerMonth on each row.
// ============================================

// hours formatter — one decimal place max, no trailing .0
const _fmtHours = (n) => {
  const v = Math.round((n || 0) * 10) / 10;
  return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}h`;
};

// Work-weeks framing for the Numbers tile. Translates raw hours into "X work
// weeks of capacity per month" — easier for a business leader to grasp than
// abstract hours. Returns null below 1 work week (40h) so the line gracefully
// hides for small numbers where the framing would feel forced.
function _fmtWorkWeeks(hours) {
  if (!hours || hours < 40) return null;
  const weeks = hours / 40;
  const rounded = Math.round(weeks * 10) / 10;
  const display = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  const noun = rounded === 1 ? 'work week' : 'work weeks';
  return `≈ ${display} ${noun} of capacity per month`;
}

// Sum monthly hours across an array of rows (hoursPerExecution × executionsPerMonth).
const _sumHours = (rows) => rows.reduce((s, r) => s + _monthlyHoursFor(r), 0);

// Build one overview card. `hours` may be omitted (e.g. when there's nothing
// to surface beyond the count).
function _buildOverviewCard({ title, accentClass, accentColor, icon, count, countLabel, hours, hoursLabel }) {
  const card = document.createElement('div');
  card.className = `card ${accentClass}`;
  card.style.backgroundColor = 'var(--rewst-white)';
  // Snug-up the padding a bit — the default .card padding is generous for a 4-up grid
  card.style.padding = '1.25rem';

  // Header (icon + title)
  const header = document.createElement('div');
  header.className = 'flex items-center gap-2 mb-3';
  header.innerHTML = `
    <span class="material-icons" style="color: ${accentColor}; font-size: 22px;">${icon}</span>
    <h3 class="text-xs font-semibold text-rewst-dark-gray uppercase tracking-wide">${title}</h3>
  `;
  card.appendChild(header);

  // Headline count
  const countEl = document.createElement('div');
  countEl.className = 'text-4xl font-bold text-rewst-dark-gray leading-tight';
  countEl.textContent = String(count);
  card.appendChild(countEl);

  const countLabelEl = document.createElement('div');
  countLabelEl.className = 'text-xs text-rewst-gray mt-1';
  countLabelEl.textContent = countLabel;
  card.appendChild(countLabelEl);

  // Secondary stats — only render if hours provided
  if (hours !== undefined) {
    const divider = document.createElement('div');
    divider.className = 'mt-4 pt-3 border-t border-gray-100 dark:border-gray-700';
    card.appendChild(divider);

    const stats = document.createElement('div');
    stats.className = 'space-y-2';

    const row = document.createElement('div');
    row.className = 'flex items-baseline justify-between';
    row.innerHTML = `
      <span class="text-lg font-semibold text-rewst-dark-gray">${_fmtHours(hours)}</span>
      <span class="text-xs text-rewst-gray">${hoursLabel}</span>
    `;
    stats.appendChild(row);

    divider.appendChild(stats);
  }

  return card;
}

// ============================================
// HERO TIER — Two tiles aimed at a business leader scanning the page.
// Tile 1: Business Impact By Benefit — for each benefit tag, the count of
//         Deployed automations (LIVE) and non-Deployed automations (COMING)
//         side by side. Lets the reader answer "in each area I care about,
//         where am I and where am I going?" in one glance. Wider (2/3 of
//         the strip).
// Tile 2: By The Numbers — time saved + potential, with the estimation
//         caveat permanently visible. Narrower (1/3 of the strip).
// ============================================
function _renderHeroTiles(rows) {
  const wrapper = document.createElement('div');
  wrapper.className = 'grid grid-cols-1 md:grid-cols-3 gap-4 mb-4';

  const deployedRows    = rows.filter(r => r.status === 'Deployed');
  const nonDeployedRows = rows.filter(r => r.status !== 'Deployed');

  const impactTile = _renderBusinessImpactTile(deployedRows, nonDeployedRows);
  impactTile.classList.add('md:col-span-2'); // wider tile takes 2 of 3 columns
  wrapper.appendChild(impactTile);

  wrapper.appendChild(_renderNumbersTile(deployedRows, nonDeployedRows));

  return wrapper;
}

// Business Impact tile — combined two-column table-like view. Each benefit tag
// gets one row showing LIVE (deployed count) + COMING (non-deployed count).
// Reader sees the full state per benefit area in one place — solves the
// multi-tag-to-one-story problem the per-tile view had.
//
// Sort: total (live + coming) desc, ties broken by live desc. This surfaces
// the strongest impact areas first. Tags with zero in both columns are hidden
// to keep the tile focused.
function _renderBusinessImpactTile(deployedRows, nonDeployedRows) {
  const tile = document.createElement('div');
  // flex-col + the mt-auto on the footer below keeps the footer pinned to the
  // bottom of the card. Without this, when the sibling tile (By The Numbers)
  // is taller, the grid stretches this tile and the dead space appears as
  // an awkward gap below the footer — flex-col + mt-auto reads as intentional
  // bottom-anchoring instead.
  tile.className = 'card flex flex-col';
  tile.style.backgroundColor = 'var(--rewst-white)';
  tile.style.borderLeft = '6px solid #C64A9A'; // fandango — business-story tile
  tile.style.padding = '1.5rem';

  // Build per-tag counts for both columns
  const counts = {};
  ROADMAP_ENUMS.tags.forEach(t => { counts[t] = { live: 0, coming: 0 }; });
  let untaggedLive   = 0;
  let untaggedComing = 0;

  for (const row of deployedRows) {
    const rowTags = Array.isArray(row.tags) ? row.tags : [];
    if (rowTags.length === 0) {
      untaggedLive++;
    } else {
      rowTags.forEach(t => {
        if (!counts[t]) counts[t] = { live: 0, coming: 0 };
        counts[t].live++;
      });
    }
  }
  for (const row of nonDeployedRows) {
    const rowTags = Array.isArray(row.tags) ? row.tags : [];
    if (rowTags.length === 0) {
      untaggedComing++;
    } else {
      rowTags.forEach(t => {
        if (!counts[t]) counts[t] = { live: 0, coming: 0 };
        counts[t].coming++;
      });
    }
  }

  const entries = Object.keys(counts)
    .map(tag => ({
      tag,
      live: counts[tag].live,
      coming: counts[tag].coming,
      colorKey: BADGE_MAP.tags[tag] || 'gray',
    }))
    .filter(e => e.live > 0 || e.coming > 0)
    .sort((a, b) =>
      ((b.live + b.coming) - (a.live + a.coming))
      || (b.live - a.live)
    );

  // Footer breakdown — status flow + untagged note
  const blockedRows = nonDeployedRows.filter(r => r.status === 'Blocked');
  const inFlightRows = nonDeployedRows.filter(r => r.status === 'In Progress' || r.status === 'Testing');
  const notStartedCount = nonDeployedRows.length - inFlightRows.length - blockedRows.length;
  const footerParts = [];
  footerParts.push(`${deployedRows.length} deployed`);
  if (inFlightRows.length) footerParts.push(`${inFlightRows.length} in flight`);
  if (notStartedCount) footerParts.push(`${notStartedCount} not started`);
  if (blockedRows.length) footerParts.push(`${blockedRows.length} blocked`);
  const totalUntagged = untaggedLive + untaggedComing;
  if (totalUntagged > 0) footerParts.push(`${totalUntagged} without benefit tags`);

  const totalRows = deployedRows.length + nonDeployedRows.length;

  // Body — empty / coaching / data
  // For the data case, build the column header + a flex-grow container that
  // distributes the data rows across the available height (justify-around).
  // This kills the dead space when the sibling tile forces this one taller.
  let bodyHTML;
  if (totalRows === 0) {
    bodyHTML = `
      <p class="text-sm text-rewst-gray italic py-2">
        No automations on the roadmap yet — add one to start tracking business impact.
      </p>
    `;
  } else if (entries.length === 0) {
    // Rows exist but none are tagged
    bodyHTML = `
      <p class="text-sm text-rewst-gray italic py-2">
        Add benefit tags to your ${totalRows} automation${totalRows === 1 ? '' : 's'} to see business impact by area.
      </p>
    `;
  } else {
    const headerRow = `
      <div class="grid items-center gap-2 text-xs text-rewst-gray uppercase tracking-wide pb-2 mb-1 border-b border-gray-100 dark:border-gray-700" style="grid-template-columns: 1fr 70px 70px;">
        <div></div>
        <div class="text-right">Live</div>
        <div class="text-right">Coming</div>
      </div>
    `;
    const dataRows = entries.map(e => {
      const dotHex = _BADGE_HEX[e.colorKey] || _BADGE_HEX.gray;
      // Soft-gray-out zero counts so the eye lands on the real activity
      const liveText = e.live > 0
        ? `<span class="font-semibold text-rewst-dark-gray">${e.live}</span>`
        : `<span class="text-rewst-gray">0</span>`;
      const comingText = e.coming > 0
        ? `<span class="font-semibold text-rewst-dark-gray">${e.coming}</span>`
        : `<span class="text-rewst-gray">0</span>`;
      return `
        <div class="grid items-center gap-2 text-sm" style="grid-template-columns: 1fr 70px 70px;">
          <div class="flex items-center gap-2 min-w-0">
            <span class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${dotHex};"></span>
            <span class="text-rewst-dark-gray truncate">${e.tag}</span>
          </div>
          <div class="text-right">${liveText}</div>
          <div class="text-right">${comingText}</div>
        </div>
      `;
    }).join('');
    // Column header at top of body; data rows in a flex-grow container that
    // distributes them evenly across the available height.
    bodyHTML = `
      ${headerRow}
      <div class="flex-grow flex flex-col justify-around py-2">
        ${dataRows}
      </div>
    `;
  }

  // Footer — sits below the flex-grow body. No mt-auto needed; the body
  // expands to fill, leaving the footer naturally at the bottom.
  const footerHTML = totalRows > 0
    ? `<div class="text-xs text-rewst-gray pt-3 border-t border-gray-100 dark:border-gray-700">${footerParts.join(' · ')}</div>`
    : '';

  tile.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <span class="material-icons" style="color: #C64A9A; font-size: 24px;">insights</span>
      <h3 class="text-sm font-semibold text-rewst-dark-gray uppercase tracking-wide">Business Impact By Benefit</h3>
    </div>
    <div class="flex-grow flex flex-col">${bodyHTML}</div>
    ${footerHTML}
  `;
  return tile;
}

// "By the numbers" tile — the time-saved figure with three complementary
// framings: raw hours, work-weeks of capacity (so a business reader can
// translate), and a progress bar showing realized vs total potential.
// Estimation caveat is pinned to the bottom of the tile.
function _renderNumbersTile(deployedRows, nonDeployedRows) {
  const tile = document.createElement('div');
  tile.className = 'card';
  tile.style.backgroundColor = 'var(--rewst-white)';
  tile.style.borderLeft = '6px solid #009490'; // teal
  tile.style.padding = '1.5rem';

  const currentHours   = _sumHours(deployedRows);
  const potentialHours = _sumHours(nonDeployedRows);
  const totalHours     = currentHours + potentialHours;
  const pctRealized    = totalHours > 0
    ? Math.round((currentHours / totalHours) * 100)
    : 0;

  // Work-weeks line — only renders when current >= 1 week (40h)
  const weeksText = _fmtWorkWeeks(currentHours);
  const weeksLine = weeksText
    ? `<div class="text-sm text-rewst-gray mt-1">${weeksText}</div>`
    : '';

  // Progress block — only shown if there's anything to measure progress on
  const progressBlock = totalHours > 0 ? `
    <div class="mt-3">
      <div class="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div class="h-full rounded-full transition-all" style="background-color: #009490; width: ${pctRealized}%;"></div>
      </div>
      <div class="text-xs text-rewst-gray mt-1.5">
        <span class="font-semibold text-rewst-dark-gray">${pctRealized}%</span> of potential realized
      </div>
    </div>
  ` : '';

  tile.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <span class="material-icons" style="color: #009490; font-size: 24px;">schedule</span>
      <h3 class="text-sm font-semibold text-rewst-dark-gray uppercase tracking-wide">By The Numbers</h3>
    </div>

    <div class="text-4xl font-bold text-rewst-dark-gray leading-tight">
      ${_fmtHours(currentHours)}<span class="text-base font-medium text-rewst-gray ml-1">/ mo saved today</span>
    </div>
    ${weeksLine}

    <div class="text-sm text-rewst-dark-gray mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
      <span class="font-semibold">${_fmtHours(potentialHours)}</span>
      <span class="text-rewst-gray">/ mo potential when shipped</span>
    </div>

    ${progressBlock}

    <div class="text-xs text-rewst-gray italic mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-start gap-1">
      <span class="material-icons flex-shrink-0" style="font-size: 14px; color: #6b7280;">info</span>
      <span class="leading-snug">Estimated from the hours-per-execution × executions-per-month you entered on each row. Refine as actual usage data clarifies.</span>
    </div>
  `;
  return tile;
}

function _renderSummaryCards(rows) {
  // Bucket rows by status. "In Progress" card includes both In Progress and Testing
  // since they're both in-flight pre-deployment.
  const deployedRows   = rows.filter(r => r.status === 'Deployed');
  const inFlightRows   = rows.filter(r => r.status === 'In Progress' || r.status === 'Testing');
  const blockedRows    = rows.filter(r => r.status === 'Blocked');

  const deployedHours  = _sumHours(deployedRows);
  const inFlightHours  = _sumHours(inFlightRows);
  const blockedHours   = _sumHours(blockedRows);

  const wrapper = document.createElement('div');
  wrapper.className = 'mb-6';

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4';
  wrapper.appendChild(grid);

  // Roadmap Total — count + total hours / mo across every row
  const totalHours = _sumHours(rows);
  grid.appendChild(_buildOverviewCard({
    title: 'Roadmap Total',
    accentClass: 'card-accent-fandango',
    accentColor: '#C64A9A',
    icon: 'format_list_bulleted',
    count: rows.length,
    countLabel: 'automations on the roadmap',
    hours: totalHours,
    hoursLabel: 'total hours / mo',
  }));

  // Completed — count + hours saved / mo
  grid.appendChild(_buildOverviewCard({
    title: 'Completed',
    accentClass: 'card-accent-success',
    accentColor: '#2BB5B6',
    icon: 'check_circle',
    count: deployedRows.length,
    countLabel: 'deployed',
    hours: deployedHours,
    hoursLabel: 'hours saved / mo',
  }));

  // In Progress — count + potential hours / mo
  grid.appendChild(_buildOverviewCard({
    title: 'In Progress',
    accentClass: 'card-accent-teal',
    accentColor: '#009490',
    icon: 'trending_up',
    count: inFlightRows.length,
    countLabel: 'in deployment',
    hours: inFlightHours,
    hoursLabel: 'potential hours / mo',
  }));

  // Blocked — count + blocked hours / mo
  grid.appendChild(_buildOverviewCard({
    title: 'Blocked',
    accentClass: 'card-accent-error',
    accentColor: '#F75B58',
    icon: 'block',
    count: blockedRows.length,
    countLabel: 'blocked automations',
    hours: blockedHours,
    hoursLabel: 'blocked hours / mo',
  }));

  // (Estimation caveat lives on the "By the Numbers" hero tile — no caption here
  // to avoid duplication.)

  return wrapper;
}

// ============================================
// PAGE RENDER
// ============================================
async function renderRoadmapPage() {
  const container = document.getElementById('page-roadmap');
  container.innerHTML = '';

  // Skeleton while we fetch
  const skeletonHost = document.createElement('div');
  skeletonHost.id = 'roadmap-skeleton-host';
  container.appendChild(skeletonHost);
  RewstDOM.showTableSkeleton('#roadmap-skeleton-host', 5);

  try {
    RoadmapState.rows = await RoadmapData.load();
  } catch (err) {
    debugError('[Roadmap] load failed', err);
    container.innerHTML = '';
    const errBox = document.createElement('div');
    errBox.className = 'card card-error p-6';
    errBox.innerHTML = `
      <h3 class="text-lg font-semibold mb-2">Couldn't load the roadmap</h3>
      <p class="text-sm">${err.message || 'Unknown error'}</p>
      <p class="text-xs text-rewst-gray mt-2">Check the console for details. Hit Refresh to try again.</p>
    `;
    container.appendChild(errBox);
    return;
  }

  // Wire the header "+ Add Automation" button (idempotent — safe to re-bind on every render)
  const addBtn = document.getElementById('add-automation-btn');
  if (addBtn && !addBtn.dataset.bound) {
    addBtn.dataset.bound = '1';
    addBtn.addEventListener('click', () => _openRoadmapDrawer(null));
  }

  // Wire the Print button — triggers the browser's print dialog. Print CSS
  // hides nav chrome so the printed view shows just the roadmap.
  const printBtn = document.getElementById('print-btn');
  if (printBtn && !printBtn.dataset.bound) {
    printBtn.dataset.bound = '1';
    printBtn.addEventListener('click', () => {
      // Toggle table view + force-render every row before printing so the
      // printed output isn't paginated/truncated.
      document.body.classList.add('print-prep');
      window.print();
      // Removed after the print dialog closes (afterprint event), or eagerly
      // if the browser fires nothing.
      const cleanup = () => document.body.classList.remove('print-prep');
      window.addEventListener('afterprint', cleanup, { once: true });
      setTimeout(cleanup, 5000); // safety fallback
    });
  }

  _renderRoadmapBody();
}

// ============================================
// INLINE CELL EDITOR (table view)
// Click a Type/Effort/Priority/Status badge → small popover lists the enum
// options → pick one → save → re-render. Singleton, lives in document.body.
// ============================================
let _cellEditPopover = null;

function _ensureCellEditPopover() {
  if (_cellEditPopover) return _cellEditPopover;

  const popover = document.createElement('div');
  popover.id = 'cell-edit-popover';
  popover.className = 'fixed z-50 bg-white dark:bg-gray-800 border-2 border-rewst-light-gray rounded-md shadow-lg overflow-hidden hidden';
  popover.style.minWidth = '160px';
  document.body.appendChild(popover);

  // Outside click closes
  document.addEventListener('mousedown', (e) => {
    if (popover.classList.contains('hidden')) return;
    if (!popover.contains(e.target) && !e.target.closest('[data-edit-cell]')) {
      popover.classList.add('hidden');
    }
  });

  // Esc closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !popover.classList.contains('hidden')) {
      popover.classList.add('hidden');
    }
  });

  _cellEditPopover = popover;
  return popover;
}

// ============================================
// CUSTOM DATE PICKER
// Replaces the native <input type="date"> calendar so dark mode looks polished
// and the accent matches our teal. Returns a DOM element ready to embed.
// Day click auto-commits via onSelect; Today/Clear in footer auto-commit too.
// ============================================
function _renderDatePicker(initialValue, callbacks = {}) {
  const { onSelect, onClear } = callbacks;

  const todayISO = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  // State — viewYear/viewMonth control which month grid is rendered
  let viewYear, viewMonth, selectedISO;
  if (initialValue && /^\d{4}-\d{2}-\d{2}/.test(initialValue)) {
    const [y, m] = initialValue.split('-').map(Number);
    viewYear = y;
    viewMonth = m - 1;
    selectedISO = initialValue;
  } else {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    selectedISO = null;
  }

  const container = document.createElement('div');
  container.className = 'rounded-md border-2 border-rewst-light-gray bg-white dark:bg-gray-800 shadow-lg overflow-hidden select-none';
  container.style.width = '280px';

  // Header — month nav
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between px-3 py-2 border-b border-rewst-light-gray';

  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'p-1 rounded text-rewst-dark-gray hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';
  prevBtn.innerHTML = '<span class="material-icons" style="font-size: 18px; vertical-align: middle;">chevron_left</span>';

  const monthYearLabel = document.createElement('div');
  monthYearLabel.className = 'text-sm font-semibold text-rewst-dark-gray';

  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'p-1 rounded text-rewst-dark-gray hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors';
  nextBtn.innerHTML = '<span class="material-icons" style="font-size: 18px; vertical-align: middle;">chevron_right</span>';

  header.appendChild(prevBtn);
  header.appendChild(monthYearLabel);
  header.appendChild(nextBtn);

  // Day-of-week row
  const dowRow = document.createElement('div');
  dowRow.className = 'grid grid-cols-7 gap-0.5 px-2 pt-2 text-xs';
  ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(letter => {
    const cell = document.createElement('div');
    cell.className = 'text-center py-1 font-medium text-rewst-gray';
    cell.textContent = letter;
    dowRow.appendChild(cell);
  });

  // Date grid
  const dateGrid = document.createElement('div');
  dateGrid.className = 'grid grid-cols-7 gap-0.5 px-2 pb-2';

  // Footer
  const footer = document.createElement('div');
  footer.className = 'flex items-center justify-between px-3 py-2 border-t border-rewst-light-gray text-xs';

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'text-rewst-teal hover:underline font-medium';
  clearBtn.textContent = 'Clear';

  const todayBtn = document.createElement('button');
  todayBtn.type = 'button';
  todayBtn.className = 'text-rewst-teal hover:underline font-medium';
  todayBtn.textContent = 'Today';

  footer.appendChild(clearBtn);
  footer.appendChild(todayBtn);

  container.appendChild(header);
  container.appendChild(dowRow);
  container.appendChild(dateGrid);
  container.appendChild(footer);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  function renderGrid() {
    monthYearLabel.textContent = `${monthNames[viewMonth]} ${viewYear}`;
    dateGrid.innerHTML = '';

    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const cells = [];
    // Previous-month tail
    for (let i = 0; i < firstDow; i++) {
      cells.push({ day: prevMonthDays - firstDow + 1 + i, otherMonth: true });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, otherMonth: false });
    }
    // Next-month head — pad to 6 rows (42 cells)
    let nextDay = 1;
    while (cells.length < 42) {
      cells.push({ day: nextDay++, otherMonth: true });
    }

    cells.forEach(c => {
      const cellBtn = document.createElement('button');
      cellBtn.type = 'button';
      cellBtn.textContent = String(c.day);

      if (c.otherMonth) {
        cellBtn.className = 'text-sm rounded text-center py-1.5 text-rewst-gray opacity-40';
        cellBtn.disabled = true;
      } else {
        const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`;
        const isSelected = iso === selectedISO;
        const isToday = iso === todayISO;

        let cls = 'text-sm rounded text-center py-1.5 transition-colors cursor-pointer';
        if (isSelected) {
          cls += ' bg-rewst-teal text-white font-semibold';
        } else {
          cls += ' text-rewst-dark-gray hover:bg-gray-100 dark:hover:bg-gray-700';
          if (isToday) cls += ' ring-1 ring-rewst-teal';
        }
        cellBtn.className = cls;
        cellBtn.addEventListener('click', () => {
          selectedISO = iso;
          if (onSelect) onSelect(iso);
        });
      }

      dateGrid.appendChild(cellBtn);
    });
  }

  prevBtn.addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderGrid();
  });
  nextBtn.addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderGrid();
  });
  todayBtn.addEventListener('click', () => {
    const t = new Date();
    viewYear = t.getFullYear();
    viewMonth = t.getMonth();
    selectedISO = todayISO;
    if (onSelect) onSelect(todayISO);
  });
  clearBtn.addEventListener('click', () => {
    selectedISO = null;
    if (onClear) onClear();
  });

  renderGrid();
  return container;
}

// Position the cell-edit popover near the clicked cell.
// Strategy: show the popover offscreen first so the browser does a real
// layout pass with the new content, then read its dimensions on the next
// animation frame and position correctly. This avoids stale-measurement
// bugs where prior-open dimensions or partially-rendered content yield
// wrong height/width and the flip-above logic places the popover off-screen.
function _positionCellPopover(popover, cellEl) {
  const rect = cellEl.getBoundingClientRect();

  // Make visible but offscreen for measurement
  popover.classList.remove('hidden');
  popover.style.left = '-9999px';
  popover.style.top = '0px';

  requestAnimationFrame(() => {
    const popRect = popover.getBoundingClientRect();
    const popW = popRect.width  || 280; // fallback if measurement failed
    const popH = popRect.height || 300;

    // Horizontal — left-aligned to cell, nudge left if overflows right
    let left = rect.left;
    if (left + popW > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popW - 8);
    }

    // Vertical — prefer below cell; flip above only when popover would
    // overflow bottom AND there's room above. Otherwise stay below and
    // let it overflow (rare; popover taller than viewport).
    let top = rect.bottom + 4;
    const overflowsBottom = top + popH > window.innerHeight - 8;
    const flipTop = rect.top - popH - 4;
    if (overflowsBottom && flipTop >= 8) {
      top = flipTop;
    }

    popover.style.left = `${left}px`;
    popover.style.top  = `${top}px`;
  });
}

function _openCellEditor(cellEl, rowId, field) {
  const row = RoadmapState.rows.find(r => r.id === rowId);
  if (!row) return;

  // Date fields use a different editor body than enum fields.
  if (field === 'targetDate') {
    _openDateCellEditor(cellEl, row);
    return;
  }

  // Free-text fields use a text-input editor.
  if (field === 'name') {
    _openTextCellEditor(cellEl, row, field, {
      label: 'Automation Name',
      placeholder: 'e.g. Onboard New User',
      required: true,
    });
    return;
  }
  if (field === 'assignedStakeholder') {
    _openTextCellEditor(cellEl, row, field, {
      label: 'Assigned Stakeholder',
      placeholder: 'e.g. Mike Chen (IT Director)',
      required: false,
    });
    return;
  }

  // Tags use a multi-select checkbox popover (different from single-select enums).
  if (field === 'tags') {
    _openTagsCellEditor(cellEl, row);
    return;
  }

  const options = ROADMAP_ENUMS[field];
  if (!options) return;
  const colorMap = BADGE_MAP[field] || {};

  const popover = _ensureCellEditPopover();
  popover.innerHTML = '';
  popover.style.padding = ''; // enum editor has no outer padding (buttons hug edges)

  options.forEach(opt => {
    const isCurrent = row[field] === opt;
    const colorKey = colorMap[opt] || 'gray';
    const dotHex = _BADGE_HEX[colorKey] || _BADGE_HEX.gray;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `w-full px-3 py-2 text-left text-sm flex items-center justify-between transition-colors ${
      isCurrent ? 'bg-rewst-light text-rewst-teal font-medium' : 'text-rewst-dark-gray hover:bg-gray-50'
    }`;
    btn.innerHTML = `
      <span class="flex items-center gap-2">
        <span class="inline-block w-2 h-2 rounded-full" style="background-color: ${dotHex};"></span>
        ${opt}
      </span>
      ${isCurrent ? '<span class="material-icons text-rewst-teal" style="font-size: 18px;">check</span>' : ''}
    `;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      popover.classList.add('hidden');
      if (opt === row[field]) return; // no-op

      const nextRows = RoadmapState.rows.map(r =>
        r.id === rowId ? { ...r, [field]: opt } : r
      );

      try {
        await RoadmapData.save(nextRows);
        RoadmapState.rows = nextRows;
        RewstDOM.showSuccess(`${field.charAt(0).toUpperCase() + field.slice(1)} → ${opt}`);
        _renderRoadmapBody();
      } catch (err) {
        debugError('[Roadmap] inline edit save failed', err);
        RewstDOM.showError('Couldn\'t save — see console');
      }
    });
    popover.appendChild(btn);
  });

  _positionCellPopover(popover, cellEl);
}

// Inline text editor — a text input + Save/Cancel buttons in the popover.
// Used for free-text fields like name and assignedStakeholder. Enter commits,
// Esc / outside-click cancels.
function _openTextCellEditor(cellEl, row, field, opts = {}) {
  const popover = _ensureCellEditPopover();
  popover.innerHTML = '';
  popover.style.padding = '12px';

  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col gap-2';
  wrap.style.minWidth = '280px';

  const label = document.createElement('label');
  label.className = 'text-xs font-medium text-rewst-dark-gray';
  label.textContent = opts.label || field;
  wrap.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.value = row[field] || '';
  input.placeholder = opts.placeholder || '';
  input.className = 'px-3 py-2 border-2 border-rewst-light-gray rounded-md text-sm focus:ring-2 focus:ring-rewst-teal focus:border-rewst-teal outline-none';
  wrap.appendChild(input);

  const btns = document.createElement('div');
  btns.className = 'flex items-center gap-2 mt-1';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn-primary text-xs flex-1 justify-center py-1';
  saveBtn.textContent = 'Save';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-secondary text-xs flex-1 justify-center py-1';
  cancelBtn.textContent = 'Cancel';

  btns.appendChild(saveBtn);
  btns.appendChild(cancelBtn);
  wrap.appendChild(btns);
  popover.appendChild(wrap);

  _positionCellPopover(popover, cellEl);

  setTimeout(() => { input.focus(); input.select(); }, 50);

  const commit = async (newValue) => {
    const trimmed = (newValue || '').trim();
    const current = String(row[field] || '').trim();

    if (opts.required && !trimmed) {
      RewstDOM.showWarning(`${opts.label || field} can't be empty`);
      input.focus();
      return;
    }
    popover.classList.add('hidden');
    if (trimmed === current) return; // no-op

    const nextRows = RoadmapState.rows.map(r =>
      r.id === row.id ? { ...r, [field]: trimmed } : r
    );

    try {
      await RoadmapData.save(nextRows);
      RoadmapState.rows = nextRows;
      RewstDOM.showSuccess(`${opts.label || 'Field'} updated`);
      _renderRoadmapBody();
    } catch (err) {
      debugError('[Roadmap] inline text save failed', err);
      RewstDOM.showError('Couldn\'t save — see console');
    }
  };

  saveBtn.addEventListener('click', (e) => { e.stopPropagation(); commit(input.value); });
  cancelBtn.addEventListener('click', (e) => { e.stopPropagation(); popover.classList.add('hidden'); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(input.value); }
  });
}

// Inline multi-select editor for the tags column. 6 checkbox rows + Done
// button. Click outside the popover saves and closes (same as the existing
// outside-click pattern on the singleton popover).
function _openTagsCellEditor(cellEl, row) {
  const popover = _ensureCellEditPopover();
  popover.innerHTML = '';
  popover.style.padding = '0';
  popover.style.minWidth = '260px';

  // Working copy of the row's tags — committed on Done or outside click.
  const initial = Array.isArray(row.tags) ? [...row.tags] : [];
  const selected = new Set(initial);
  let committed = false; // prevent double-save (Done button + outside click)

  const commit = async () => {
    if (committed) return;
    committed = true;
    popover.classList.add('hidden');

    const nextArr = ROADMAP_ENUMS.tags.filter(t => selected.has(t));
    // No-op check: same set as before? Skip save.
    if (nextArr.length === initial.length && nextArr.every((v, i) => v === initial[i])) {
      return;
    }

    const nextRows = RoadmapState.rows.map(r =>
      r.id === row.id ? { ...r, tags: nextArr } : r
    );

    try {
      await RoadmapData.save(nextRows);
      RoadmapState.rows = nextRows;
      RewstDOM.showSuccess('Benefit tags updated');
      _renderRoadmapBody();
    } catch (err) {
      debugError('[Roadmap] tags save failed', err);
      RewstDOM.showError("Couldn't save tags — see console");
    }
  };

  // Build the list of checkbox rows
  const list = document.createElement('div');
  list.className = 'flex flex-col py-1';

  // Soft hint shown when 4+ tags are checked.
  const hint = document.createElement('p');
  hint.className = 'text-xs items-start gap-1 px-3 py-2 border-t border-gray-200 dark:border-gray-700';
  hint.style.color = 'var(--rewst-warning, #F9A100)';
  hint.style.display = 'none';
  hint.innerHTML = '<span class="material-icons flex-shrink-0" style="font-size: 14px;">warning_amber</span><span class="leading-snug">Most automations have 1–2 primary benefits — consider whether all of these are really primary.</span>';
  const updateHint = () => {
    hint.style.display = selected.size >= 4 ? 'flex' : 'none';
  };

  ROADMAP_ENUMS.tags.forEach(tag => {
    const colorKey = BADGE_MAP.tags[tag] || 'gray';
    const dotHex = _BADGE_HEX[colorKey] || _BADGE_HEX.gray;
    const isOn = selected.has(tag);

    const optionRow = document.createElement('label');
    optionRow.className = 'flex items-center gap-3 px-3 py-2 cursor-pointer text-sm text-rewst-dark-gray hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isOn;
    checkbox.className = 'accent-rewst-teal cursor-pointer';
    checkbox.addEventListener('change', (e) => {
      e.stopPropagation();
      if (checkbox.checked) {
        selected.add(tag);
      } else {
        selected.delete(tag);
      }
      updateHint();
    });

    const dot = document.createElement('span');
    dot.className = 'inline-block w-2 h-2 rounded-full flex-shrink-0';
    dot.style.backgroundColor = dotHex;

    const label = document.createElement('span');
    label.textContent = tag;
    label.className = 'truncate';

    optionRow.appendChild(checkbox);
    optionRow.appendChild(dot);
    optionRow.appendChild(label);
    list.appendChild(optionRow);
  });

  popover.appendChild(list);
  popover.appendChild(hint);
  updateHint();

  // Footer: Done button
  const footer = document.createElement('div');
  footer.className = 'flex items-center justify-end gap-2 px-3 py-2 border-t border-gray-200 dark:border-gray-700';

  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'btn-primary btn-sm flex items-center gap-1';
  doneBtn.innerHTML = '<span class="material-icons" style="font-size: 16px;">check</span> Done';
  doneBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    commit();
  });

  footer.appendChild(doneBtn);
  popover.appendChild(footer);

  // Outside click also commits — handled by the singleton's mousedown listener.
  // But we want commit-on-close, not just hide. Hook a one-shot observer.
  const observer = new MutationObserver(() => {
    if (popover.classList.contains('hidden')) {
      observer.disconnect();
      commit();
    }
  });
  observer.observe(popover, { attributes: true, attributeFilter: ['class'] });

  _positionCellPopover(popover, cellEl);
}

// Inline date editor — embeds the custom date picker in the popover.
// Day click in the picker auto-commits; Today/Clear in the picker footer
// commit + close too. No separate Save button needed.
function _openDateCellEditor(cellEl, row) {
  const popover = _ensureCellEditPopover();
  popover.innerHTML = '';
  popover.style.padding = '0'; // picker has its own padding + border

  const commit = async (newValue) => {
    popover.classList.add('hidden');
    if (newValue === (row.targetDate || '')) return; // no-op

    const nextRows = RoadmapState.rows.map(r =>
      r.id === row.id ? { ...r, targetDate: newValue } : r
    );

    try {
      await RoadmapData.save(nextRows);
      RoadmapState.rows = nextRows;
      RewstDOM.showSuccess(newValue ? `Target date → ${newValue}` : 'Target date cleared');
      _renderRoadmapBody();
    } catch (err) {
      debugError('[Roadmap] date edit save failed', err);
      RewstDOM.showError('Couldn\'t save — see console');
    }
  };

  const picker = _renderDatePicker(row.targetDate, {
    onSelect: (iso) => commit(iso),
    onClear: () => commit(''),
  });
  popover.appendChild(picker);

  _positionCellPopover(popover, cellEl);
}

// ============================================
// VIEW TOGGLE
// Segmented control (Table / Kanban) shown above whichever view is active.
// ============================================
function _renderViewToggle() {
  const wrap = document.createElement('div');
  wrap.className = 'flex items-center justify-end mb-4';

  const toggle = document.createElement('div');
  toggle.className = 'inline-flex rounded-md border-2 border-rewst-light-gray overflow-hidden bg-white dark:bg-gray-800';

  const makeBtn = (view, label, icon) => {
    const btn = document.createElement('button');
    btn.dataset.view = view;
    const isActive = RoadmapState.view === view;
    btn.className = isActive
      ? 'flex items-center gap-2 px-4 py-2 text-sm font-medium bg-rewst-teal text-white'
      : 'flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 text-rewst-dark-gray hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors';
    btn.innerHTML = `<span class="material-icons" style="font-size: 18px;">${icon}</span><span>${label}</span>`;
    return btn;
  };

  toggle.appendChild(makeBtn('table',  'Table',  'view_list'));
  toggle.appendChild(makeBtn('kanban', 'Kanban', 'view_kanban'));

  toggle.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    const view = btn.dataset.view;
    if (view === RoadmapState.view) return;
    RoadmapState.view = view;
    try { localStorage.setItem('rewst-roadmap-view', view); } catch (e) { /* private mode etc */ }
    _renderRoadmapBody();
  });

  wrap.appendChild(toggle);
  return wrap;
}

// ============================================
// BODY DISPATCHER
// Decides between empty state, table view, and kanban view.
// Used after every save so the UI updates without another GraphQL round-trip.
// ============================================
function _renderRoadmapBody() {
  const container = document.getElementById('page-roadmap');
  container.innerHTML = '';

  // ---- Empty state ----
  if (!RoadmapState.rows || RoadmapState.rows.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'card p-8 text-center';
    empty.innerHTML = `
      <span class="material-icons text-rewst-teal mb-4" style="font-size: 64px;">map</span>
      <h2 class="text-2xl font-semibold text-rewst-black mb-2">No automations yet</h2>
      <p class="text-rewst-gray max-w-lg mx-auto mb-6">
        Click <strong>+ Add Automation</strong> in the header to start your roadmap, or load some sample
        data to explore the UI.
      </p>
      <div class="flex items-center justify-center gap-3">
        <button class="btn-primary" id="empty-add-btn">
          <span class="material-icons">add</span> Add Automation
        </button>
        <button class="btn-secondary" id="empty-samples-btn">
          <span class="material-icons">science</span> Load Sample Data
        </button>
      </div>
    `;
    container.appendChild(empty);

    document.getElementById('empty-add-btn').addEventListener('click', () => _openRoadmapDrawer(null));
    document.getElementById('empty-samples-btn').addEventListener('click', async () => {
      const btn = document.getElementById('empty-samples-btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="material-icons animate-spin">refresh</span> Saving…';
      try {
        const samples = _generateSampleRoadmapRows();
        await RoadmapData.save(samples);
        RoadmapState.rows = samples;
        RewstDOM.showSuccess('Sample data loaded');
        _renderRoadmapBody();
      } catch (err) {
        debugError('[Roadmap] sample save failed', err);
        RewstDOM.showError('Couldn\'t save samples — see console');
        btn.disabled = false;
        btn.innerHTML = '<span class="material-icons">science</span> Load Sample Data';
      }
    });
    return;
  }

  // ---- Common header (hero tiles + metric cards + view toggle) ----
  container.appendChild(_renderHeroTiles(RoadmapState.rows));
  container.appendChild(_renderSummaryCards(RoadmapState.rows));
  container.appendChild(_renderViewToggle());

  // ---- Dispatch to the chosen view ----
  if (RoadmapState.view === 'kanban') {
    container.appendChild(_renderKanbanFilters());
    container.appendChild(_renderKanbanView(RoadmapState.rows));
  } else {
    container.appendChild(_renderTableView(RoadmapState.rows));
  }

  // ---- Last-saved indicator (shared across views) ----
  const ts = _parseRewstTimestamp(RoadmapData._cachedVar?.updatedAt);
  if (ts) {
    const meta = document.createElement('p');
    meta.className = 'text-xs text-rewst-gray mt-3 text-right';
    meta.textContent = `Last saved: ${ts.toLocaleString()}`;
    container.appendChild(meta);
  }
}

// ============================================
// TABLE VIEW
// Returns a DOM node — caller appends.
// ============================================
function _renderTableView(rows) {
  // Add an _actions virtual column with an Edit pencil button per row.
  // The transform stamps the row id into a data attribute so click delegation
  // can find it without us tracking row indexes (which break under sort/filter/page).
  const tableData = rows.map(r => ({ ...r, _actions: r.id }));

  const table = RewstDOM.createTable(tableData, {
    title: `${rows.length} automation${rows.length === 1 ? '' : 's'}`,
    columns: ['name', 'tags', 'assignedStakeholder', 'type', 'effort', 'priority', 'status', 'targetDate', '_actions'],
    headers: {
      name: 'Automation',
      tags: 'Benefit Tags',
      assignedStakeholder: 'Assigned',
      type: 'Type',
      effort: 'Effort',
      priority: 'Priority',
      status: 'Status',
      targetDate: 'Target Date',
      _actions: '',
    },
    transforms: {
      name: (v, row) => {
        const safe = String(v || '').replace(/</g, '&lt;');
        const noteIcon = (row && row.notes && row.notes.trim())
          ? `<span class="material-icons text-rewst-gray align-middle mr-1" style="font-size: 14px; vertical-align: -2px;" title="${String(row.notes).replace(/"/g, '&quot;').slice(0, 240)}">sticky_note_2</span>`
          : '';
        if (!row) return noteIcon + safe;
        const display = safe || '<span class="text-rewst-dark-gray italic opacity-70">Set name</span>';
        // block-level + negative margins extends the click target to fill the
        // entire <td> (including its 6/4 padding) so users can click anywhere.
        return `<span class="cursor-pointer hover:bg-teal-100 dark:hover:bg-gray-600 transition-colors block -mx-6 -my-4 px-6 py-4 rounded" data-edit-cell="${row.id}" data-edit-field="name" title="Click to rename">${noteIcon}${display}</span>`;
      },
      assignedStakeholder: (v, row) => {
        if (!row) return v ? String(v).replace(/</g, '&lt;') : '';
        const trimmed = v && String(v).trim();
        const safe = trimmed ? String(v).replace(/</g, '&lt;') : '';
        const display = trimmed
          ? `<span class="inline-flex items-center gap-1"><span class="material-icons text-rewst-gray" style="font-size: 14px; vertical-align: -2px;">person_outline</span>${safe}</span>`
          : '<span class="text-rewst-dark-gray italic opacity-70">—</span>';
        return `<span class="cursor-pointer hover:bg-teal-100 dark:hover:bg-gray-600 transition-colors block -mx-6 -my-4 px-6 py-4 rounded" data-edit-cell="${row.id}" data-edit-field="assignedStakeholder" title="Click to ${trimmed ? 'change' : 'assign'}">${display}</span>`;
      },
      tags: (v, row) => {
        // v is the tags array. Render each as a chip; whole cell click opens
        // an inline multi-select popover (singleton, lives on document.body).
        const tags = Array.isArray(v) ? v : [];
        if (!row) {
          return tags.map(t => _badge(t, BADGE_MAP.tags[t] || 'gray')).join(' ');
        }
        if (tags.length === 0) {
          return `<span class="cursor-pointer hover:underline italic text-rewst-dark-gray opacity-70 text-xs" data-edit-cell="${row.id}" data-edit-field="tags" title="Click to add benefit tags">Add benefit tags</span>`;
        }
        const chips = tags.map(t => _badge(t, BADGE_MAP.tags[t] || 'gray')).join(' ');
        return `<span class="cursor-pointer hover:opacity-80 transition-opacity inline-flex flex-wrap gap-1" data-edit-cell="${row.id}" data-edit-field="tags" title="Click to edit benefit tags">${chips}</span>`;
      },
      type:     (v, row) => _badge(v, BADGE_MAP.type[v],     { editable: true, rowId: row.id, field: 'type' }),
      effort:   (v, row) => _badge(v, BADGE_MAP.effort[v],   { editable: true, rowId: row.id, field: 'effort' }),
      priority: (v, row) => _badge(v, BADGE_MAP.priority[v], { editable: true, rowId: row.id, field: 'priority' }),
      status:   (v, row) => _badge(v, BADGE_MAP.status[v],   { editable: true, rowId: row.id, field: 'status' }),
      targetDate: (v, row) => {
        if (!row) return v || '';
        const safe = v ? String(v).replace(/</g, '&lt;') : '';
        const display = v
          ? safe
          : '<span class="text-rewst-gray italic">Set date</span>';
        return `<span class="cursor-pointer hover:underline" data-edit-cell="${row.id}" data-edit-field="targetDate" title="Click to change">${display}</span>`;
      },
      _actions: (id) => `
        <button data-edit-id="${id}" class="text-rewst-teal hover:text-rewst-fandango transition-colors p-1" title="Edit">
          <span class="material-icons" style="font-size: 20px;">edit</span>
        </button>
      `,
    },
    filters: {
      // Tags column intentionally omitted — array-valued columns don't play
      // cleanly with the dropdown filter; users can search by tag name in
      // the search box, or use the Tag Coverage tile for the per-tag view.
      type:     { label: 'Type',     type: 'dropdown' },
      effort:   { label: 'Effort',   type: 'dropdown' },
      priority: { label: 'Priority', type: 'dropdown' },
      status:   { label: 'Status',   type: 'dropdown' },
    },
    defaultSort: { column: 'priority', direction: 'desc' },
    sortKeys: {
      effort:   { 'Low': 1, 'Medium': 2, 'High': 3 },
      priority: { 'Low': 1, 'Medium': 2, 'High': 3 },
      status:   { 'Not Started': 1, 'In Progress': 2, 'Testing': 3, 'Deployed': 4, 'Blocked': 5 },
    },
    pagination: 25,
    paginationOptions: [10, 25, 50, 100],
    searchable: true,
    sortable: true,
    refreshable: false,
  });

  // Event delegation — handle inline cell-edit (single-select badges + tags
  // multi-select popover both routed via data-edit-cell) and full-row edit (pencil).
  table.addEventListener('click', (e) => {
    const cell = e.target.closest('[data-edit-cell]');
    if (cell) {
      e.stopPropagation();
      _openCellEditor(cell, cell.dataset.editCell, cell.dataset.editField);
      return;
    }
    const btn = e.target.closest('[data-edit-id]');
    if (!btn) return;
    const row = rows.find(r => r.id === btn.dataset.editId);
    if (row) _openRoadmapDrawer(row);
  });

  return table;
}

// ============================================
// KANBAN VIEW
// 5 columns by status. Cards click → same edit drawer used by the table view.
// ============================================
const _BADGE_HEX = {
  teal: '#009490',
  fandango: '#C64A9A',
  orange: '#F9A100',
  success: '#2BB5B6',
  error: '#F75B58',
  gray: '#90A4AE',
};

function _renderKanbanFilters() {
  const wrap = document.createElement('div');
  wrap.className = 'flex items-center gap-3 mb-4 flex-wrap';

  // ---- Search input ----
  const searchWrap = document.createElement('div');
  searchWrap.className = 'flex-1 relative min-w-[200px] max-w-md';
  searchWrap.innerHTML = `
    <span class="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-rewst-gray pointer-events-none" style="font-size: 18px;">search</span>
    <input type="text" id="kanban-search" placeholder="Search by name…"
           class="w-full pl-10 pr-3 py-2 border-2 border-rewst-light-gray rounded-md text-sm focus:ring-2 focus:ring-rewst-teal focus:border-rewst-teal outline-none"
           value="${(RoadmapState.kanbanFilter.search || '').replace(/"/g, '&quot;')}">
  `;
  wrap.appendChild(searchWrap);

  // ---- Priority dropdown ----
  const priorityWrap = document.createElement('div');
  priorityWrap.style.minWidth = '170px';
  const priorityDropdown = RewstDOM.createStyledDropdown(
    [
      { value: 'all', label: 'All priorities' },
      ...ROADMAP_ENUMS.priority.map(p => ({ value: p, label: `${p} priority` })),
    ],
    {
      defaultValue: RoadmapState.kanbanFilter.priority,
      onChange: (option, value) => {
        RoadmapState.kanbanFilter.priority = value;
        _renderRoadmapBody();
      },
    }
  );
  priorityWrap.appendChild(priorityDropdown);
  wrap.appendChild(priorityWrap);

  // ---- Clear button (only when a filter is active) ----
  const hasFilter =
    RoadmapState.kanbanFilter.search.trim() !== '' ||
    RoadmapState.kanbanFilter.priority !== 'all';
  if (hasFilter) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'text-sm text-rewst-teal hover:underline px-2';
    clearBtn.textContent = 'Clear filters';
    clearBtn.addEventListener('click', () => {
      RoadmapState.kanbanFilter = { search: '', priority: 'all' };
      _renderRoadmapBody();
    });
    wrap.appendChild(clearBtn);
  }

  // Wire up the search input AFTER we've appended (so the element exists in DOM).
  // Debounced so typing doesn't thrash re-renders and steal focus mid-burst.
  setTimeout(() => {
    const input = document.getElementById('kanban-search');
    if (!input) return;
    input.addEventListener('input', (e) => {
      RoadmapState.kanbanFilter.search = e.target.value;
      clearTimeout(_kanbanSearchDebounce);
      _kanbanSearchDebounce = setTimeout(() => {
        _renderRoadmapBody();
        // After re-render the input is replaced; restore focus + caret.
        const fresh = document.getElementById('kanban-search');
        if (fresh) {
          fresh.focus();
          const v = fresh.value;
          fresh.setSelectionRange(v.length, v.length);
        }
      }, 250);
    });
  }, 0);

  return wrap;
}

function _applyKanbanFilter(rows) {
  const f = RoadmapState.kanbanFilter;
  const search = (f.search || '').trim().toLowerCase();
  return rows.filter(r => {
    if (search && !String(r.name || '').toLowerCase().includes(search)) return false;
    if (f.priority !== 'all' && r.priority !== f.priority) return false;
    return true;
  });
}

function _renderKanbanView(rows) {
  const visibleRows = _applyKanbanFilter(rows);

  // Status-only grouping. Per-tag grouping was retired in favor of the
  // Tag Coverage / story tiles in the hero strip.
  const groupField = 'status';
  const baseColumns = [...ROADMAP_ENUMS.status];

  const groups = {};
  baseColumns.forEach(v => { groups[v] = []; });
  visibleRows.forEach(r => {
    const key = r[groupField];
    if (key && groups[key] !== undefined) {
      groups[key].push(r);
    }
  });

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4';

  baseColumns.forEach(colValue => {
    const colorKey = BADGE_MAP.status[colValue] || 'gray';
    const dotHex = _BADGE_HEX[colorKey] || _BADGE_HEX.gray;
    const items = groups[colValue];

    const col = document.createElement('div');
    col.className = 'flex flex-col bg-gray-50 dark:bg-gray-900 rounded-lg p-3 transition-colors';
    col.dataset.bucket = colValue;
    col.dataset.groupField = groupField;

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between mb-3 px-1';
    header.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${dotHex};"></span>
        <h3 class="text-sm font-semibold text-rewst-dark-gray truncate">${colValue}</h3>
      </div>
      <span class="text-xs text-rewst-gray bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 flex-shrink-0 ml-2">${items.length}</span>
    `;
    col.appendChild(header);

    const stack = document.createElement('div');
    stack.className = 'flex flex-col gap-2 min-h-[60px]';

    if (items.length === 0) {
      stack.innerHTML = `<p class="text-xs text-rewst-gray italic text-center py-4 select-none">No automations</p>`;
    } else {
      items.forEach(row => stack.appendChild(_kanbanCard(row)));
    }

    col.appendChild(stack);

    // ---- Drop target ----
    let enterCount = 0;
    const setDragOver = (on) => {
      if (on) {
        col.style.backgroundColor = 'rgba(0, 148, 144, 0.10)';
        col.style.boxShadow = 'inset 0 0 0 2px var(--rewst-teal)';
      } else {
        col.style.backgroundColor = '';
        col.style.boxShadow = '';
      }
    };

    col.addEventListener('dragenter', (e) => {
      e.preventDefault();
      enterCount++;
      setDragOver(true);
    });
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });
    col.addEventListener('dragleave', () => {
      enterCount--;
      if (enterCount <= 0) { enterCount = 0; setDragOver(false); }
    });
    col.addEventListener('drop', async (e) => {
      e.preventDefault();
      enterCount = 0;
      setDragOver(false);

      const id = e.dataTransfer.getData('text/plain');
      const newBucket = col.dataset.bucket;
      const row = rows.find(r => r.id === id);
      if (!row) return;
      if (row.status === newBucket) return; // no-op

      const nextRows = rows.map(r =>
        r.id === id ? { ...r, status: newBucket } : r
      );

      try {
        await RoadmapData.save(nextRows);
        RoadmapState.rows = nextRows;
        RewstDOM.showSuccess(`Moved "${row.name}" — status → ${newBucket}`);
        _renderRoadmapBody();
      } catch (err) {
        debugError('[Roadmap] drop save failed', err);
        RewstDOM.showError('Couldn\'t save — see console');
      }
    });

    grid.appendChild(col);
  });

  // Event delegation — click anywhere on a card → open edit drawer
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('[data-edit-id]');
    if (!card) return;
    const row = rows.find(r => r.id === card.dataset.editId);
    if (row) _openRoadmapDrawer(row);
  });

  return grid;
}

function _kanbanCard(row) {
  const priorityColorKey = BADGE_MAP.priority[row.priority] || 'gray';
  const borderHex = _BADGE_HEX[priorityColorKey] || _BADGE_HEX.gray;

  const card = document.createElement('div');
  // 'group' enables Tailwind group-hover styling on descendants (the action button).
  // 'relative' is needed for the absolute-positioned action button.
  card.className = 'group relative bg-white dark:bg-gray-800 rounded-md p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow';
  card.style.borderLeft = `3px solid ${borderHex}`;
  card.dataset.editId = row.id;
  card.draggable = true;

  // Build inner HTML — name + tag chips only + optional notes preview + optional date.
  // Priority is already encoded in the card's left border color; type is low-signal
  // at this zoom level. Dropping both chips keeps the card focused on the benefit story.
  //
  // Tag chips capped at 2 + "+N more" pill so card heights stay uniform. The
  // expected norm is 1-2 tags per automation; the +N pill only shows up when
  // users tag heavier (3+). Full tag list is always visible on the table view.
  const safeName = String(row.name || '').replace(/</g, '&lt;');
  const rowTags = Array.isArray(row.tags) ? row.tags : [];
  const KANBAN_TAG_LIMIT = 2;
  const visibleTags = rowTags.slice(0, KANBAN_TAG_LIMIT);
  const overflowCount = Math.max(0, rowTags.length - KANBAN_TAG_LIMIT);
  const visibleChips = visibleTags.map(t => _badge(t, BADGE_MAP.tags[t] || 'gray')).join('');
  const overflowChip = overflowCount > 0
    ? `<span class="badge" style="color: var(--badge-gray-text); background-color: var(--badge-gray-bg);" title="${rowTags.slice(KANBAN_TAG_LIMIT).map(t => String(t).replace(/"/g, '&quot;')).join(', ')}">+${overflowCount} more</span>`
    : '';
  const tagBadges = visibleChips + overflowChip;

  let notesPreview = '';
  if (row.notes && row.notes.trim()) {
    const flat = row.notes.trim().replace(/\s+/g, ' ');
    const truncated = flat.length > 60 ? flat.slice(0, 60) + '…' : flat;
    const safePreview = truncated.replace(/</g, '&lt;');
    const fullTip = String(row.notes).replace(/"/g, '&quot;').slice(0, 240);
    notesPreview = `
      <div class="text-xs text-rewst-gray mt-2 flex items-start gap-1" title="${fullTip}">
        <span class="material-icons flex-shrink-0" style="font-size: 14px;">sticky_note_2</span>
        <span class="leading-tight">${safePreview}</span>
      </div>
    `;
  }

  const targetDate = row.targetDate
    ? `<div class="text-xs text-rewst-gray mt-1 flex items-center gap-1">
         <span class="material-icons" style="font-size: 14px;">event</span>${row.targetDate}
       </div>`
    : '';

  const stakeholder = row.assignedStakeholder && row.assignedStakeholder.trim()
    ? `<div class="text-xs text-rewst-gray mt-1 flex items-center gap-1">
         <span class="material-icons" style="font-size: 14px;">person_outline</span>${String(row.assignedStakeholder).replace(/</g, '&lt;')}
       </div>`
    : '';

  // Only render the badges row if there are actually tag chips — avoids leaving
  // an empty flex container that adds vertical space for nothing.
  const badgesRow = tagBadges
    ? `<div class="flex items-center gap-1 flex-wrap">${tagBadges}</div>`
    : '';

  card.innerHTML = `
    <div class="text-sm font-medium text-rewst-dark-gray mb-2 pr-7">${safeName}</div>
    ${badgesRow}
    ${notesPreview}
    ${stakeholder}
    ${targetDate}
  `;

  // ---- Hover action: Mark Deployed (only for non-Deployed cards) ----
  if (row.status !== 'Deployed') {
    const markBtn = document.createElement('button');
    markBtn.className = 'absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full p-1 shadow-sm hover:shadow-md cursor-pointer';
    markBtn.title = 'Mark as Deployed';
    markBtn.innerHTML = '<span class="material-icons" style="font-size: 16px; color: #2BB5B6;">check</span>';
    markBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      markBtn.disabled = true;
      markBtn.style.opacity = '1';

      const nextRows = RoadmapState.rows.map(r =>
        r.id === row.id ? { ...r, status: 'Deployed' } : r
      );

      try {
        await RoadmapData.save(nextRows);
        RoadmapState.rows = nextRows;
        RewstDOM.showSuccess(`Marked "${row.name}" as Deployed`);
        _renderRoadmapBody();
      } catch (err) {
        debugError('[Roadmap] mark deployed failed', err);
        RewstDOM.showError('Couldn\'t save — see console');
        markBtn.disabled = false;
      }
    });
    // Don't let the button be a drag handle — just a click target
    markBtn.draggable = false;
    card.appendChild(markBtn);
  }

  // ---- Drag source ----
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', row.id);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('opacity-40');
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('opacity-40');
  });

  return card;
}
