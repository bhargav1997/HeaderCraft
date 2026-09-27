/**
 * popup.js — HeaderCraft Popup UI (v1.1)
 *
 * Data model (chrome.storage.local):
 *  { profiles: Profile[], activeProfileId: string | null }
 *
 *  Profile {
 *    id, name, urlFilter, useRegex, enabled,
 *    headers:    HeaderRule[],
 *    redirects:  RedirectRule[],
 *    queryParams: QueryParamRule[],
 *    mocks:      MockRule[]
 *  }
 *
 *  HeaderRule    { id, enabled, name, value, operation:'set'|'append'|'remove', type:'request'|'response' }
 *  RedirectRule  { id, enabled, fromUrl, toUrl, useRegex, resourceTypes:string[] }
 *  QueryParamRule{ id, enabled, urlFilter, useRegex, addOrReplace:[{key,value}], remove:string[] }
 *  MockRule      { id, enabled, method, urlFilter, useRegex, statusCode, contentType, responseBody }
 */

'use strict';

// ── Helpers ──────────────────────────────────────────────────────────────────

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function makeDeleteBtn() {
  const btn = document.createElement('button');
  btn.className = 'btn-remove-rule has-tooltip';
  btn.dataset.tooltip = 'Delete rule';
  btn.setAttribute('aria-label', 'Delete rule');
  btn.title = 'Delete rule';
  btn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="13" height="13">
    <path d="M3 4h10M6 4V3h4v1M5.5 4v8h5V4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return btn;
}

function makeInput(cls, placeholder, value = '', mono = false) {
  const el = document.createElement('input');
  el.type = 'text';
  el.className = (mono ? 'rule-input mono' : 'rule-input') + (cls ? ' ' + cls : '');
  el.placeholder = placeholder;
  el.value = value;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      el.blur();
    }
  });
  return el;
}

function makeSelect(cls, options, selected) {
  const sel = document.createElement('select');
  sel.className = cls;
  for (const [val, label] of options) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = label;
    if (val === selected) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

function makeEnabledDot(checked, onChange) {
  const label = document.createElement('label');
  label.className = 'rule-enabled-toggle has-tooltip';
  label.dataset.tooltip = 'Toggle rule active state';
  label.setAttribute('aria-label', 'Toggle rule active state');
  label.title = 'Enable / disable rule';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  const dot = document.createElement('span');
  dot.className = 'rule-enabled-dot';
  input.addEventListener('change', () => onChange(input.checked));
  label.append(input, dot);
  return label;
}

// ── State ─────────────────────────────────────────────────────────────────────

let profiles        = [];
let activeProfileId = null;
let selectedProfileId = null;
let activeTab       = 'headers'; // 'headers' | 'redirects' | 'queryparams' | 'mocks'

// ── DOM refs ─────────────────────────────────────────────────────────────────

const profileList           = document.getElementById('profile-list');
const btnAddProfile         = document.getElementById('btn-add-profile');
const btnSeedExample         = document.getElementById('btn-seed-example');
const btnShareProfile       = document.getElementById('btn-share-profile');
const btnImportUrl          = document.getElementById('btn-import-url');
const btnExport             = document.getElementById('btn-export');
const btnImport             = document.getElementById('btn-import');
const btnImportModHeader    = document.getElementById('btn-import-modheader');
const fileImportInput       = document.getElementById('file-import-input');
const fileImportModHeader   = document.getElementById('file-import-modheader');

const profileConfig         = document.getElementById('profile-config');
const noProfileState        = document.getElementById('no-profile-state');
const profileNameInput      = document.getElementById('profile-name-input');
const btnEditName           = document.getElementById('btn-edit-name');
const btnScopeTab           = document.getElementById('btn-scope-tab');
const scopeTabText          = document.getElementById('scope-tab-text');
const profileEnabledToggle  = document.getElementById('profile-enabled-toggle');
const profileStatusLabel    = document.getElementById('profile-status-label');
const urlFilterInput        = document.getElementById('url-filter-input');
const useRegexToggle        = document.getElementById('use-regex-toggle');
const btnDeleteProfile      = document.getElementById('btn-delete-profile');

// Modal DOM refs
const shareModal            = document.getElementById('share-modal');
const modalTitle            = document.getElementById('modal-title');
const modalDesc             = document.getElementById('modal-desc');
const modalInput            = document.getElementById('modal-input');
const modalActionBtn        = document.getElementById('modal-action-btn');
const modalSubtext          = document.getElementById('modal-subtext');
const btnCloseModal         = document.getElementById('btn-close-modal');

const tabBtns               = document.querySelectorAll('.tab-btn');
const countEls              = {
  headers:    document.getElementById('count-headers'),
  redirects:  document.getElementById('count-redirects'),
  queryparams:document.getElementById('count-queryparams'),
  mocks:      document.getElementById('count-mocks'),
};

const btnAddRule            = document.getElementById('btn-add-rule');
const addRuleLabel          = document.getElementById('add-rule-label');
const btnRefreshVars        = document.getElementById('btn-refresh-vars');
const rulesContainer        = document.getElementById('rules-container');
const emptyTabState         = document.getElementById('empty-tab-state');
const emptyTabMessage       = document.getElementById('empty-tab-message');
const emptyTabHint          = document.getElementById('empty-tab-hint');
const btnEmptyAction        = document.getElementById('btn-empty-action');
const presetsDropdownWrap   = document.getElementById('presets-dropdown-wrap');
const btnPresets            = document.getElementById('btn-presets');
const presetsMenu           = document.getElementById('presets-menu');
const presetsStrip          = document.getElementById('presets-strip');
const presetsChips          = document.getElementById('presets-chips');
const emptyPresetsWrapper   = document.getElementById('empty-presets-wrapper');
const emptyPresetsList      = document.getElementById('empty-presets-list');
const btnMockLogs           = document.getElementById('btn-mock-logs');
const mockLogsText          = document.getElementById('mock-logs-text');
const toast                 = document.getElementById('toast');

// v1.3.0 DOM refs (search bar is built dynamically — see buildRuleSearchBar)
const autoDisableSelect     = document.getElementById('auto-disable-select');
const autoDisableCountdown  = document.getElementById('auto-disable-countdown');

// ── Hit Counter State (session-only, reset on profile toggle) ─────────────────
const hitCounters = {}; // ruleId → count
function incrementHit(ruleId) {
  hitCounters[ruleId] = (hitCounters[ruleId] ?? 0) + 1;
  // Update badge in DOM without full re-render
  const badge = document.querySelector(`.rule-hit-badge[data-rule-id="${ruleId}"]`);
  if (badge) {
    const count = hitCounters[ruleId];
    badge.querySelector('.hit-count').textContent = count;
    badge.classList.toggle('has-hits', count > 0);
  }
}
function resetHitCounters() {
  Object.keys(hitCounters).forEach(k => delete hitCounters[k]);
}

// ── Auto-Disable Timer ────────────────────────────────────────────────────────
let autoDisableInterval = null;

function clearAutoDisableTimer() {
  if (autoDisableInterval) { clearInterval(autoDisableInterval); autoDisableInterval = null; }
}

async function setAutoDisableTimer(minutes) {
  clearAutoDisableTimer();
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile || !minutes) {
    if (profile) { delete profile.autoDisableAt; }
    await saveStorage();
    autoDisableCountdown?.classList.add('hidden');
    return;
  }
  const fireAt = Date.now() + minutes * 60_000;
  profile.autoDisableAt = fireAt;
  await saveStorage();
  startCountdownDisplay();
}

function startCountdownDisplay() {
  clearAutoDisableTimer();
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile?.autoDisableAt) {
    autoDisableCountdown?.classList.add('hidden');
    return;
  }
  function tick() {
    const remaining = profile.autoDisableAt - Date.now();
    if (remaining <= 0) {
      clearAutoDisableTimer();
      autoDisableCountdown?.classList.add('hidden');
      // Auto-disable the profile
      profile.enabled = false;
      delete profile.autoDisableAt;
      activeProfileId = profiles.find(p => p.enabled)?.id ?? null;
      saveStorage().then(() => {
        renderMainPanel();
        showToast(`Profile "${profile.name}" auto-disabled`, 'info');
      });
      return;
    }
    const mins = Math.floor(remaining / 60_000);
    const secs = Math.floor((remaining % 60_000) / 1000);
    if (autoDisableCountdown) {
      autoDisableCountdown.textContent = `${mins}:${secs.toString().padStart(2,'0')} left`;
      autoDisableCountdown.classList.remove('hidden');
    }
  }
  tick();
  autoDisableInterval = setInterval(tick, 1000);
}

// ── Rule Search Filter ────────────────────────────────────────────────────────
let ruleSearchQuery = '';

/** Build the search bar and inject it as the FIRST child of rulesContainer.
 *  It's built fresh on each renderTab so it lives inside the scrollable
 *  container — the only parent where position:sticky works correctly. */
function buildRuleSearchBar() {
  const bar = document.createElement('div');
  bar.className = 'rule-search-bar';
  bar.id = 'hc-rule-search-bar';

  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.6');
  icon.setAttribute('width', '12');
  icon.setAttribute('height', '12');
  icon.classList.add('rule-search-icon');
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  circle.setAttribute('cx', '6.5'); circle.setAttribute('cy', '6.5'); circle.setAttribute('r', '4');
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.setAttribute('d', 'M9.5 9.5 13 13'); line.setAttribute('stroke-linecap', 'round');
  icon.append(circle, line);

  const input = document.createElement('input');
  input.className = 'rule-search-input';
  input.type = 'text';
  input.placeholder = 'Search rules…';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = ruleSearchQuery; // restore query if switching back to same tab

  const clearBtn = document.createElement('button');
  clearBtn.className = 'rule-search-clear' + (ruleSearchQuery ? '' : ' hidden');
  clearBtn.title = 'Clear search';
  clearBtn.setAttribute('aria-label', 'Clear search');
  clearBtn.textContent = '\u00d7';

  input.addEventListener('input', () => {
    ruleSearchQuery = input.value;
    clearBtn.classList.toggle('hidden', !ruleSearchQuery);
    applyRuleSearch();
  });

  clearBtn.addEventListener('click', () => {
    ruleSearchQuery = '';
    input.value = '';
    clearBtn.classList.add('hidden');
    applyRuleSearch();
    input.focus();
  });

  bar.append(icon, input, clearBtn);
  return bar;
}

function applyRuleSearch() {
  const q = ruleSearchQuery.toLowerCase().trim();
  const cards = rulesContainer.querySelectorAll('.rule-card');
  let visible = 0;
  cards.forEach(card => {
    // Collect static text node text plus form field values (input, select, textarea)
    let fullText = card.textContent;
    card.querySelectorAll('input, select, textarea').forEach(el => {
      fullText += ' ' + (el.value || '');
    });
    const text = fullText.toLowerCase();
    const show = !q || text.includes(q);
    card.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  // Show/hide "no results" hint inline
  let noResult = rulesContainer.querySelector('.rule-search-no-result');
  if (!q || visible > 0) {
    noResult?.remove();
  } else if (!noResult) {
    noResult = document.createElement('p');
    noResult.className = 'rule-search-no-result';
    noResult.style.cssText = 'text-align:center;color:var(--text-muted);font-size:12px;padding:24px 0;';
    noResult.textContent = `No rules matching "${ruleSearchQuery}"`;
    rulesContainer.appendChild(noResult);
  } else {
    noResult.textContent = `No rules matching "${ruleSearchQuery}"`;
  }
}

// ── Quick Presets ─────────────────────────────────────────────────────────────

const HEADER_PRESETS = [
  {
    id: 'cors',
    badge: 'RES',
    badgeType: 'res',
    name: 'Bypass CORS (All Origins)',
    shortName: 'CORS',
    desc: 'Access-Control-Allow-* headers',
    rules: [
      { name: 'Access-Control-Allow-Origin', value: '*', operation: 'set', type: 'response' },
      { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS', operation: 'set', type: 'response' },
      { name: 'Access-Control-Allow-Headers', value: '*', operation: 'set', type: 'response' },
      { name: 'Access-Control-Allow-Credentials', value: 'true', operation: 'set', type: 'response' },
    ],
  },
  {
    id: 'no-cache',
    badge: 'REQ',
    badgeType: 'req',
    name: 'Disable Cache (No-Cache)',
    shortName: 'No-Cache',
    desc: 'Force fresh assets & bypass cache',
    rules: [
      { name: 'Cache-Control', value: 'no-cache, no-store, must-revalidate', operation: 'set', type: 'request' },
      { name: 'Pragma', value: 'no-cache', operation: 'set', type: 'request' },
      { name: 'Expires', value: '0', operation: 'set', type: 'request' },
    ],
  },
  {
    id: 'strip-csp',
    badge: 'RES',
    badgeType: 'strip',
    name: 'Strip CSP (Security Policy)',
    shortName: 'Strip CSP',
    desc: 'Remove CSP headers for script testing',
    rules: [
      { name: 'Content-Security-Policy', value: '', operation: 'remove', type: 'response' },
      { name: 'Content-Security-Policy-Report-Only', value: '', operation: 'remove', type: 'response' },
      { name: 'X-WebKit-CSP', value: '', operation: 'remove', type: 'response' },
    ],
  },
  {
    id: 'json-api',
    badge: 'REQ',
    badgeType: 'req',
    name: 'JSON API Request',
    shortName: 'JSON API',
    desc: 'Accept & Content-Type: application/json',
    rules: [
      { name: 'Accept', value: 'application/json, text/plain, */*', operation: 'set', type: 'request' },
      { name: 'Content-Type', value: 'application/json', operation: 'set', type: 'request' },
    ],
  },
  {
    id: 'bearer-auth',
    badge: 'REQ',
    badgeType: 'req',
    name: 'Bearer Auth Token',
    shortName: 'Bearer Auth',
    desc: 'Authorization: Bearer <token>',
    rules: [
      { name: 'Authorization', value: 'Bearer YOUR_TOKEN_HERE', operation: 'set', type: 'request' },
    ],
  },
  {
    id: 'mobile-ua',
    badge: 'REQ',
    badgeType: 'req',
    name: 'Mobile User-Agent (iOS)',
    shortName: 'Mobile UA',
    desc: 'Emulate iPhone Safari UA & Client Hints',
    rules: [
      { name: 'User-Agent', value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1', operation: 'set', type: 'request' },
      { name: 'Sec-CH-UA-Mobile', value: '?1', operation: 'set', type: 'request' },
      { name: 'Sec-CH-UA-Platform', value: '"iOS"', operation: 'set', type: 'request' },
    ],
  },
  {
    id: 'graphql-headers',
    badge: 'REQ',
    badgeType: 'req',
    name: 'GraphQL Client Headers',
    shortName: 'GraphQL',
    desc: 'JSON body with Apollo operation header',
    rules: [
      { name: 'Content-Type', value: 'application/json', operation: 'set', type: 'request' },
      { name: 'X-Apollo-Operation-Name', value: 'HeaderCraftQuery', operation: 'set', type: 'request' },
    ],
  },
];

const PARAM_PRESETS = [
  {
    id: 'strip-utm',
    badge: 'STRIP',
    badgeType: 'strip',
    name: 'Strip Tracking & UTM Params',
    shortName: 'Strip UTMs',
    desc: 'Remove utm_*, fbclid, gclid, _ga',
    paramRule: {
      urlFilter: '',
      useRegex: false,
      addOrReplace: [],
      remove: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'mc_eid', '_ga'],
    },
  },
  {
    id: 'cachebuster',
    badge: 'PARAM',
    badgeType: 'param',
    name: 'Cache-Buster Timestamp',
    shortName: 'Cache-Buster',
    desc: 'Append _cb={{$timestamp}} parameter',
    paramRule: {
      urlFilter: '',
      useRegex: false,
      addOrReplace: [{ key: '_cb', value: '{{$timestamp}}' }],
      remove: [],
    },
  },
  {
    id: 'debug-mode',
    badge: 'PARAM',
    badgeType: 'param',
    name: 'Debug & Dev Mode',
    shortName: 'Debug Mode',
    desc: 'Append debug=true and env=dev',
    paramRule: {
      urlFilter: '',
      useRegex: false,
      addOrReplace: [
        { key: 'debug', value: 'true' },
        { key: 'env', value: 'dev' },
      ],
      remove: [],
    },
  },
  {
    id: 'feature-flag',
    badge: 'PARAM',
    badgeType: 'param',
    name: 'Feature Flag Test',
    shortName: 'Feature Flags',
    desc: 'Append feature_flags=beta_ui, preview=1',
    paramRule: {
      urlFilter: '',
      useRegex: false,
      addOrReplace: [
        { key: 'feature_flags', value: 'beta_ui' },
        { key: 'preview', value: '1' },
      ],
      remove: [],
    },
  },
  {
    id: 'pagination-reset',
    badge: 'PARAM',
    badgeType: 'param',
    name: 'Pagination Reset',
    shortName: 'Pagination',
    desc: 'Set page=1 and limit=100',
    paramRule: {
      urlFilter: '',
      useRegex: false,
      addOrReplace: [
        { key: 'page', value: '1' },
        { key: 'limit', value: '100' },
      ],
      remove: [],
    },
  },
];

async function applyHeaderPreset(preset) {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) return;

  profile.headers = profile.headers ?? [];
  const uid = () => crypto.randomUUID();

  for (const r of preset.rules) {
    profile.headers.push({
      id: uid(),
      enabled: true,
      name: r.name,
      value: r.value,
      operation: r.operation,
      type: r.type,
    });
  }

  await saveStorage();
  renderTabCounts(profile);
  renderTab(profile);
  showToast(`Applied preset: ${preset.name}`, 'success');
}

async function applyParamPreset(preset) {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) return;

  profile.queryParams = profile.queryParams ?? [];
  const uid = () => crypto.randomUUID();

  profile.queryParams.push({
    id: uid(),
    enabled: true,
    urlFilter: preset.paramRule.urlFilter,
    useRegex: preset.paramRule.useRegex,
    addOrReplace: preset.paramRule.addOrReplace.map(p => ({ ...p })),
    remove: [...preset.paramRule.remove],
  });

  await saveStorage();
  renderTabCounts(profile);
  renderTab(profile);
  showToast(`Applied preset: ${preset.name}`, 'success');
}

function renderPresetsMenu() {
  if (!presetsMenu) return;
  presetsMenu.innerHTML = '';

  const presets = activeTab === 'headers' ? HEADER_PRESETS : activeTab === 'queryparams' ? PARAM_PRESETS : [];
  if (presets.length === 0) return;

  const titleEl = document.createElement('div');
  titleEl.className = 'presets-menu-header';
  titleEl.textContent = activeTab === 'headers' ? 'Header Presets' : 'Query Parameter Presets';
  presetsMenu.appendChild(titleEl);

  presets.forEach(preset => {
    const item = document.createElement('button');
    item.className = 'preset-item';
    item.type = 'button';

    const badge = document.createElement('span');
    badge.className = `preset-badge ${preset.badgeType || ''}`;
    badge.textContent = preset.badge;

    const info = document.createElement('div');
    info.className = 'preset-info';

    const name = document.createElement('span');
    name.className = 'preset-name';
    name.textContent = preset.name;

    const desc = document.createElement('span');
    desc.className = 'preset-desc';
    desc.textContent = preset.desc;

    info.append(name, desc);
    item.append(badge, info);

    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      presetsMenu.classList.add('hidden');
      if (btnPresets) btnPresets.classList.remove('open');
      if (activeTab === 'headers') {
        await applyHeaderPreset(preset);
      } else {
        await applyParamPreset(preset);
      }
    });

    presetsMenu.appendChild(item);
  });
}

function renderPresetsStrip() {
  if (!presetsStrip || !presetsChips) return;
  const presets = activeTab === 'headers' ? HEADER_PRESETS : activeTab === 'queryparams' ? PARAM_PRESETS : [];
  if (presets.length === 0) {
    presetsStrip.classList.add('hidden');
    return;
  }
  presetsStrip.classList.remove('hidden');
  presetsChips.innerHTML = '';

  presets.forEach(preset => {
    const chip = document.createElement('button');
    chip.className = 'preset-chip';
    chip.type = 'button';
    chip.title = `${preset.name} - ${preset.desc}`;

    const badge = document.createElement('span');
    badge.className = `chip-badge ${preset.badgeType || ''}`;
    badge.textContent = preset.badge;

    const label = document.createElement('span');
    label.textContent = `+ ${preset.shortName || preset.name}`;

    chip.append(badge, label);

    chip.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (activeTab === 'headers') {
        await applyHeaderPreset(preset);
      } else {
        await applyParamPreset(preset);
      }
    });

    presetsChips.appendChild(chip);
  });
}

function renderEmptyPresets() {
  if (!emptyPresetsWrapper || !emptyPresetsList) return;
  const presets = activeTab === 'headers' ? HEADER_PRESETS : activeTab === 'queryparams' ? PARAM_PRESETS : [];
  if (presets.length === 0) {
    emptyPresetsWrapper.classList.add('hidden');
    return;
  }
  emptyPresetsWrapper.classList.remove('hidden');
  emptyPresetsList.innerHTML = '';

  presets.forEach(preset => {
    const card = document.createElement('div');
    card.className = 'empty-preset-card';
    card.role = 'button';
    card.tabIndex = 0;

    const left = document.createElement('div');
    left.className = 'empty-preset-card-left';

    const badge = document.createElement('span');
    badge.className = `preset-badge ${preset.badgeType || ''}`;
    badge.textContent = preset.badge;

    const info = document.createElement('div');
    info.className = 'empty-preset-card-info';

    const name = document.createElement('span');
    name.className = 'empty-preset-card-name';
    name.textContent = preset.name;

    const desc = document.createElement('span');
    desc.className = 'empty-preset-card-desc';
    desc.textContent = preset.desc;

    info.append(name, desc);
    left.append(badge, info);

    const action = document.createElement('span');
    action.className = 'empty-preset-card-btn';
    action.textContent = '+ Apply';

    card.append(left, action);

    const applyFn = async (e) => {
      e.stopPropagation();
      if (activeTab === 'headers') {
        await applyHeaderPreset(preset);
      } else {
        await applyParamPreset(preset);
      }
    };

    card.addEventListener('click', applyFn);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        applyFn(e);
      }
    });

    emptyPresetsList.appendChild(card);
  });
}

// ── Storage ───────────────────────────────────────────────────────────────────

function migrateProfile(p) {
  return {
    redirects: [], queryParams: [], mocks: [],
    scopedTabId: null, scopedTabTitle: null,
    ...p,
    headers: p.headers ?? [],
  };
}

function createUnifiedExampleProfile() {
  const uid = () => crypto.randomUUID();
  return {
    id: uid(),
    name: 'Example – All Features',
    urlFilter: '',
    useRegex: false,
    enabled: false,

    headers: [
      {
        id: uid(), enabled: true,
        name: 'Authorization', value: 'Bearer YOUR_TOKEN_HERE',
        operation: 'set', type: 'request',
      },
      {
        id: uid(), enabled: true,
        name: 'X-Correlation-ID', value: '{{$uuid}}',
        operation: 'set', type: 'request',
      },
      {
        id: uid(), enabled: true,
        name: 'Access-Control-Allow-Origin', value: '*',
        operation: 'set', type: 'response',
      },
      {
        id: uid(), enabled: false,
        name: 'X-Debug-Timestamp', value: '{{$timestamp}}',
        operation: 'set', type: 'request',
      },
    ],

    redirects: [
      {
        id: uid(), enabled: true,
        fromUrl: 'myapp.com/static/bundle.min.js',
        toUrl: 'http://localhost:3000/bundle.js',
        useRegex: false,
        resourceTypes: ['script'],
      },
      {
        id: uid(), enabled: true,
        fromUrl: 'api.myapp.com/v2',
        toUrl: 'http://localhost:8080/v2',
        useRegex: false,
        resourceTypes: ['xmlhttprequest'],
      },
      {
        id: uid(), enabled: false,
        fromUrl: 'cdn\\.myapp\\.com/.*\\.js',
        toUrl: 'http://localhost:3000/local.js',
        useRegex: true,
        resourceTypes: ['script'],
      },
    ],

    queryParams: [
      {
        id: uid(), enabled: true,
        urlFilter: 'api.staging.example.com',
        useRegex: false,
        addOrReplace: [
          { key: 'debug', value: 'true' },
          { key: 'version', value: '2' },
        ],
        remove: ['utm_source', 'utm_medium', 'fbclid'],
      },
      {
        id: uid(), enabled: false,
        urlFilter: 'dashboard.example.com',
        useRegex: false,
        addOrReplace: [{ key: 'feature_flag', value: 'new_ui' }],
        remove: [],
      },
    ],

    mocks: [
      {
        id: uid(), enabled: true,
        method: 'GET', urlFilter: '/api/v1/users', useRegex: false,
        statusCode: 200, contentType: 'application/json',
        responseBody: JSON.stringify({
          users: [
            { id: 1, name: 'Alice Johnson', role: 'admin' },
            { id: 2, name: 'Bob Smith', role: 'viewer' },
          ],
          total: 2,
          mocked: true,
        }, null, 2),
      },
      {
        id: uid(), enabled: false,
        method: 'GET', urlFilter: '/api/v1/users', useRegex: false,
        statusCode: 500, contentType: 'application/json',
        responseBody: JSON.stringify({
          error: 'Internal Server Error',
          message: 'Simulated 500 to test frontend error boundaries',
          mocked: true,
        }, null, 2),
      },
      {
        id: uid(), enabled: false,
        method: 'POST', urlFilter: '/api/v1/login', useRegex: false,
        statusCode: 401, contentType: 'application/json',
        responseBody: JSON.stringify({ error: 'Unauthorized', mocked: true }, null, 2),
      },
    ],
  };
}

async function loadStorage() {
  const data = await chrome.storage.local.get(['profiles', 'activeProfileId', 'exampleSeededV3']);
  let loadedProfiles = (data.profiles ?? []).map(migrateProfile);

  // If v3 unified example profile has not yet been seeded, or if storage has no profiles at all:
  if (!data.exampleSeededV3 || loadedProfiles.length === 0) {
    // Strip out any obsolete split example profiles
    loadedProfiles = loadedProfiles.filter(p => !p.name?.startsWith('📖 Example') && !p.name?.startsWith('Example – All Features'));
    const example = createUnifiedExampleProfile();
    loadedProfiles.unshift(example);
    activeProfileId = data.activeProfileId ?? example.id;
    await chrome.storage.local.set({
      profiles: loadedProfiles,
      activeProfileId,
      exampleSeededV3: true,
    });
  } else {
    activeProfileId = data.activeProfileId ?? loadedProfiles[0]?.id ?? null;
  }

  profiles = loadedProfiles;
}

async function saveStorage() {
  await chrome.storage.local.set({ profiles, activeProfileId });
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2500);
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  renderProfileList();
  renderMainPanel();
}

function renderProfileList() {
  profileList.innerHTML = '';
  for (const profile of profiles) {
    const li = document.createElement('li');
    li.className = 'profile-item'
      + (profile.id === selectedProfileId ? ' active' : '')
      + (profile.id === activeProfileId && profile.enabled ? ' enabled' : '');
    li.dataset.id = profile.id;

    const dot   = document.createElement('span'); dot.className = 'profile-dot';
    const label = document.createElement('span');
    label.className = 'profile-label';
    label.textContent = profile.name;

    li.append(dot, label);
    li.addEventListener('click', () => selectProfile(profile.id));
    profileList.appendChild(li);
  }
}

function renderMainPanel() {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) {
    profileConfig.classList.add('hidden');
    noProfileState.classList.remove('hidden');
    return;
  }

  profileConfig.classList.remove('hidden');
  noProfileState.classList.add('hidden');

  profileNameInput.value        = profile.name;
  profileEnabledToggle.checked  = profile.enabled;
  profileStatusLabel.textContent = profile.enabled ? 'On' : 'Off';
  profileStatusLabel.className   = 'status-label ' + (profile.enabled ? 'on' : 'off');
  urlFilterInput.value           = profile.urlFilter;
  useRegexToggle.checked         = profile.useRegex;

  // Sync auto-disable UI
  if (autoDisableSelect) {
    autoDisableSelect.value = '0';
    if (profile.autoDisableAt && profile.autoDisableAt > Date.now()) {
      const remaining = profile.autoDisableAt - Date.now();
      // Find closest preset
      const mins = Math.ceil(remaining / 60_000);
      const preset = [480, 120, 60, 30, 15].find(m => mins <= m) ?? 0;
      autoDisableSelect.value = String(preset);
      startCountdownDisplay();
    } else {
      clearAutoDisableTimer();
      autoDisableCountdown?.classList.add('hidden');
      if (profile.autoDisableAt) { delete profile.autoDisableAt; }
    }
  }

  // Isolated Tab Scoping button state
  if (profile.scopedTabId) {
    btnScopeTab.classList.add('scoped');
    scopeTabText.textContent = 'This Tab';
    btnScopeTab.setAttribute(
      'data-tooltip',
      `Scoped to: ${profile.scopedTabTitle || 'Tab #' + profile.scopedTabId} (Click to unscope)`
    );
  } else {
    btnScopeTab.classList.remove('scoped');
    scopeTabText.textContent = 'All Tabs';
    btnScopeTab.setAttribute('data-tooltip', 'Scope profile to current active tab only');
  }

  ruleSearchQuery = ''; // Reset search on profile switch
  renderTabCounts(profile);
  renderTab(profile);
  syncTabBar();
}

function renderTabCounts(profile) {
  countEls.headers.textContent     = (profile.headers    ?? []).length;
  countEls.redirects.textContent   = (profile.redirects  ?? []).length;
  countEls.queryparams.textContent = (profile.queryParams ?? []).length;
  countEls.mocks.textContent       = (profile.mocks      ?? []).length;
}

function syncTabBar() {
  const TAB_META = {
    headers:    { label: 'Add Header',   msg: 'No header rules yet.',    hint: 'Click <strong>Add Header</strong> or select a <strong>Preset</strong>.', action: '+ Add your first header' },
    redirects:  { label: 'Add Redirect', msg: 'No redirect rules yet.',  hint: 'Map a production URL to <strong>localhost</strong> with Add Redirect.', action: '+ Add your first redirect' },
    queryparams:{ label: 'Add Param Rule',msg: 'No param rules yet.',    hint: 'Inject, replace, or strip URL query params, or select a <strong>Preset</strong>.', action: '+ Add your first param rule' },
    mocks:      { label: 'Add Mock',     msg: 'No mock rules yet.',      hint: 'Intercept any API call and return a <strong>custom response</strong>.', action: '+ Add your first mock' },
  };
  const meta = TAB_META[activeTab];
  addRuleLabel.textContent = meta.label;
  emptyTabMessage.textContent = meta.msg;
  emptyTabHint.innerHTML = meta.hint;
  if (btnEmptyAction) btnEmptyAction.textContent = meta.action;

  // Show presets button on headers and queryparams tabs
  if (presetsDropdownWrap) {
    presetsDropdownWrap.style.display = (activeTab === 'headers' || activeTab === 'queryparams') ? '' : 'none';
  }
  renderPresetsStrip();

  // Show mock logs toggle only on mocks tab
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (btnMockLogs) {
    if (activeTab === 'mocks') {
      btnMockLogs.classList.remove('hidden');
      syncMockLogsBtn(profile);
    } else {
      btnMockLogs.classList.add('hidden');
    }
  }

  tabBtns.forEach(btn => {
    const isActive = btn.dataset.tab === activeTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
}

function syncMockLogsBtn(profile) {
  if (!btnMockLogs || !profile) return;
  const isLogging = profile.consoleLogging !== false;
  btnMockLogs.classList.toggle('active', isLogging);
  if (mockLogsText) {
    mockLogsText.textContent = isLogging ? 'Logs: ON' : 'Logs: OFF';
  }
}

function renderTab(profile) {
  rulesContainer.innerHTML = '';

  let items;
  switch (activeTab) {
    case 'headers':     items = profile.headers    ?? []; break;
    case 'redirects':   items = profile.redirects  ?? []; break;
    case 'queryparams': items = profile.queryParams ?? []; break;
    case 'mocks':       items = profile.mocks       ?? []; break;
    default:            items = [];
  }

  if (activeTab === 'mocks') {
    syncMockLogsBtn(profile);
  }

  if (items.length === 0) {
    emptyTabState.classList.remove('hidden');
    renderEmptyPresets();
    renderPresetsStrip();
    return;
  }
  emptyTabState.classList.add('hidden');

  // Inject search bar as first child of rules-container when rules exist
  if (items.length >= 1) {
    rulesContainer.appendChild(buildRuleSearchBar());
  }
  renderPresetsStrip();

  for (const item of items) {
    let card;
    if      (activeTab === 'headers')     card = buildHeaderCard(item);
    else if (activeTab === 'redirects')   card = buildRedirectCard(item);
    else if (activeTab === 'queryparams') card = buildQueryParamCard(item);
    else                                   card = buildMockCard(item);
    rulesContainer.appendChild(card);
  }

  if (ruleSearchQuery) {
    applyRuleSearch();
  }
}

// ── Card: Header Rule ─────────────────────────────────────────────────────────

function buildHeaderCard(rule) {
  const card = document.createElement('div');
  card.className = 'rule-card' + (rule.enabled ? '' : ' disabled');
  card.dataset.ruleId = rule.id;

  // Row 1: [dot] [name] [op] [value] [delete]
  const dotLabel = makeEnabledDot(rule.enabled, v => updateRuleField('headers', rule.id, 'enabled', v));

  const fieldsWrap = document.createElement('div');
  fieldsWrap.className = 'rule-fields';

  const nameInput  = makeInput('', 'Header-Name', rule.name, true);
  nameInput.addEventListener('change', () => updateRuleField('headers', rule.id, 'name', nameInput.value));

  const opSelect = makeSelect('rule-select', [['set','set'],['append','append'],['remove','remove']], rule.operation);
  opSelect.addEventListener('change', () => updateRuleField('headers', rule.id, 'operation', opSelect.value));

  const valInput = makeInput('', 'Value  ({{$uuid}}, {{$timestamp}})', rule.value, true);
  valInput.addEventListener('change', () => updateRuleField('headers', rule.id, 'value', valInput.value));

  const del = makeDeleteBtn();
  del.addEventListener('click', () => removeRule('headers', rule.id));
  fieldsWrap.append(nameInput, opSelect, valInput, del);

  // Row 2: type chips + hit counter badge
  const typeRow = document.createElement('div');
  typeRow.className = 'rule-type-row';
  for (const t of ['request', 'response']) {
    const chip = document.createElement('span');
    chip.className = 'type-chip' + (rule.type === t ? (t === 'request' ? ' active-req' : ' active-res') : '');
    chip.textContent = t === 'request' ? 'REQ' : 'RES';
    chip.title = t === 'request' ? 'Request header' : 'Response header';
    chip.addEventListener('click', () => updateRuleField('headers', rule.id, 'type', t));
    typeRow.appendChild(chip);
  }

  // Hit counter badge
  const hitCount = hitCounters[rule.id] ?? 0;
  const hitBadge = document.createElement('span');
  hitBadge.className = 'rule-hit-badge' + (hitCount > 0 ? ' has-hits' : '');
  hitBadge.dataset.ruleId = rule.id;
  hitBadge.title = hitCount > 0 ? `Matched ${hitCount} request(s) this session` : 'No matches yet this session';
  const hitDot = document.createElement('span');
  hitDot.className = 'hit-dot';
  const hitLabel = document.createElement('span');
  hitLabel.className = 'hit-count';
  hitLabel.textContent = hitCount;
  hitBadge.append(hitDot, hitLabel, document.createTextNode(' hits'));
  typeRow.appendChild(hitBadge);

  // Row 3: note / comment
  const noteRow = document.createElement('div');
  noteRow.className = 'rule-note-row';

  const noteToggle = document.createElement('button');
  noteToggle.className = 'rule-note-toggle' + (rule.note ? ' has-note' : '');
  noteToggle.title = rule.note ? 'Edit note' : 'Add note';
  noteToggle.innerHTML = `<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" width="10" height="10"><path d="M2 3h10M2 7h7M2 11h5" stroke-linecap="round"/></svg><span>${rule.note ? 'Note' : 'Add note'}</span>`;

  const noteInput = makeInput('rule-note-input', 'Add a note for this rule…', rule.note ?? '');
  noteInput.style.display = rule.note ? '' : 'none';
  noteInput.addEventListener('change', () => {
    updateRuleField('headers', rule.id, 'note', noteInput.value);
    noteToggle.className = 'rule-note-toggle' + (noteInput.value ? ' has-note' : '');
    noteToggle.querySelector('span').textContent = noteInput.value ? 'Note' : 'Add note';
  });
  noteToggle.addEventListener('click', () => {
    const hidden = noteInput.style.display === 'none';
    noteInput.style.display = hidden ? '' : 'none';
    if (hidden) noteInput.focus();
  });

  noteRow.append(noteToggle, noteInput);

  // Row 4: Live URL tester (shown only for header rules with urlFilter context)
  const testerRow = document.createElement('div');
  testerRow.className = 'url-tester-row';

  const testerInput = document.createElement('input');
  testerInput.className = 'url-tester-input';
  testerInput.type = 'text';
  testerInput.placeholder = 'Test URL: paste any URL to check if the profile filter matches…';
  testerInput.setAttribute('aria-label', 'Test URL against profile filter');

  const testerResult = document.createElement('span');
  testerResult.className = 'url-tester-result';

  testerInput.addEventListener('input', () => {
    const testUrl = testerInput.value.trim();
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!testUrl || !profile?.urlFilter) {
      testerResult.className = 'url-tester-result';
      return;
    }
    let matched = false;
    try {
      matched = profile.useRegex
        ? new RegExp(profile.urlFilter).test(testUrl)
        : testUrl.includes(profile.urlFilter);
    } catch (_) { matched = false; }
    testerResult.className = `url-tester-result visible ${matched ? 'match' : 'no-match'}`;
    testerResult.textContent = matched ? 'Matches' : 'No match';
  });
  testerRow.append(testerInput, testerResult);

  const topRow = document.createElement('div');
  topRow.className = 'rule-card-header';
  topRow.append(dotLabel, fieldsWrap);
  card.append(topRow, typeRow, noteRow, testerRow);
  return card;
}

// ── Card: Redirect Rule ───────────────────────────────────────────────────────

const REDIRECT_RESOURCE_TYPES = [
  ['main_frame', 'Page'],
  ['script',     'JS'],
  ['stylesheet', 'CSS'],
  ['image',      'IMG'],
  ['xmlhttprequest', 'XHR'],
  ['media',      'Media'],
];

function buildRedirectCard(rule) {
  const card = document.createElement('div');
  card.className = 'rule-card redirect-card' + (rule.enabled ? '' : ' disabled');
  card.dataset.ruleId = rule.id;

  // Row 1: [dot] [from] → [to] [delete]
  const dotLabel = makeEnabledDot(rule.enabled, v => updateRuleField('redirects', rule.id, 'enabled', v));

  const fields = document.createElement('div');
  fields.className = 'redirect-fields';

  const fromInput = makeInput('', 'From URL / pattern', rule.fromUrl ?? '', true);
  fromInput.addEventListener('change', () => updateRuleField('redirects', rule.id, 'fromUrl', fromInput.value));

  const arrow = document.createElement('span');
  arrow.className = 'redirect-arrow';
  arrow.textContent = '→';

  const toInput = makeInput('', 'To URL  (http://localhost:3000/…)', rule.toUrl ?? '', true);
  toInput.addEventListener('change', () => updateRuleField('redirects', rule.id, 'toUrl', toInput.value));

  const del = makeDeleteBtn();
  del.addEventListener('click', () => removeRule('redirects', rule.id));
  fields.append(fromInput, arrow, toInput, del);

  const topRow = document.createElement('div');
  topRow.className = 'rule-card-header';
  topRow.append(dotLabel, fields);

  // Row 2: resource type chips
  const resRow = document.createElement('div');
  resRow.className = 'redirect-resource-row';

  const allChip = document.createElement('span');
  allChip.className = 'res-chip' + (!(rule.resourceTypes?.length) ? ' active' : '');
  allChip.textContent = 'ALL';
  allChip.title = 'All resource types';
  allChip.addEventListener('click', () => updateRuleField('redirects', rule.id, 'resourceTypes', []));
  resRow.appendChild(allChip);

  for (const [type, label] of REDIRECT_RESOURCE_TYPES) {
    const chip = document.createElement('span');
    const isActive = rule.resourceTypes?.includes(type);
    chip.className = 'res-chip' + (isActive ? ' active' : '');
    chip.textContent = label;
    chip.title = type;
    chip.addEventListener('click', () => {
      const types = [...(rule.resourceTypes ?? [])];
      const idx   = types.indexOf(type);
      if (idx === -1) types.push(type); else types.splice(idx, 1);
      updateRuleField('redirects', rule.id, 'resourceTypes', types);
    });
    resRow.appendChild(chip);
  }

  card.append(topRow, resRow);
  return card;
}

// ── Card: Query-Param Rule ────────────────────────────────────────────────────

function buildQueryParamCard(rule) {
  const card = document.createElement('div');
  card.className = 'rule-card qp-card' + (rule.enabled ? '' : ' disabled');
  card.dataset.ruleId = rule.id;

  // Row 1: [dot] URL filter [regex toggle] [delete]
  const dotLabel = makeEnabledDot(rule.enabled, v => updateRuleField('queryParams', rule.id, 'enabled', v));

  const urlRow = document.createElement('div');
  urlRow.className = 'qp-url-row';

  const urlInput = makeInput('rule-input', 'URL Filter (default: profile filter)', rule.urlFilter ?? '', true);
  urlInput.addEventListener('change', () => updateRuleField('queryParams', rule.id, 'urlFilter', urlInput.value));

  const regexLabel = document.createElement('label');
  regexLabel.className = 'regex-toggle';
  regexLabel.title = 'Regex filter';
  const regexCheck = document.createElement('input');
  regexCheck.type = 'checkbox';
  regexCheck.checked = rule.useRegex ?? false;
  regexCheck.addEventListener('change', () => updateRuleField('queryParams', rule.id, 'useRegex', regexCheck.checked));
  const regexBadge = document.createElement('span');
  regexBadge.className = 'regex-badge';
  regexBadge.textContent = '.*';
  regexLabel.append(regexCheck, regexBadge);

  const del = makeDeleteBtn();
  del.addEventListener('click', () => removeRule('queryParams', rule.id));
  urlRow.append(urlInput, regexLabel, del);

  const topRow = document.createElement('div');
  topRow.className = 'rule-card-header';
  topRow.append(dotLabel, urlRow);

  // Add/Replace section
  const addSection = document.createElement('div');
  const addLabel = document.createElement('div');
  addLabel.className = 'qp-section-label';
  addLabel.textContent = 'Add / Replace';

  const pairsList = document.createElement('div');
  pairsList.className = 'qp-pairs-list';

  function renderPairs() {
    pairsList.innerHTML = '';
    (rule.addOrReplace ?? []).forEach((pair, idx) => {
      const row = document.createElement('div');
      row.className = 'qp-pair-row';

      const kInput = makeInput('rule-input', 'key', pair.key, true);
      kInput.addEventListener('change', async () => {
        rule.addOrReplace[idx].key = kInput.value;
        await saveQpRule();
      });

      const eq = document.createElement('span');
      eq.className = 'qp-eq';
      eq.textContent = '=';

      const vInput = makeInput('rule-input', 'value', pair.value, true);
      vInput.addEventListener('change', async () => {
        rule.addOrReplace[idx].value = vInput.value;
        await saveQpRule();
      });

      const rowDel = makeDeleteBtn();
      rowDel.addEventListener('click', async () => {
        rule.addOrReplace.splice(idx, 1);
        renderPairs();
        await saveQpRule();
      });

      row.append(kInput, eq, vInput, rowDel);
      pairsList.appendChild(row);
    });

    // "Add param" button
    const addBtn = document.createElement('button');
    addBtn.className = 'qp-add-pair-btn';
    addBtn.textContent = '+ Add param';
    addBtn.addEventListener('click', async () => {
      rule.addOrReplace = [...(rule.addOrReplace ?? []), { key: '', value: '' }];
      renderPairs();
      await saveQpRule(); // persist the new empty row immediately
    });
    pairsList.appendChild(addBtn);
  }

  renderPairs();
  addSection.append(addLabel, pairsList);

  // Remove section
  const removeSection = document.createElement('div');
  const removeLabel = document.createElement('div');
  removeLabel.className = 'qp-section-label';
  removeLabel.textContent = 'Remove (comma-separated keys)';

  const removeInput = document.createElement('input');
  removeInput.className = 'qp-remove-input';
  removeInput.placeholder = 'utm_source, utm_medium, fbclid';
  removeInput.value = (rule.remove ?? []).join(', ');
  removeInput.setAttribute('aria-label', 'Remove parameters');
  removeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') removeInput.blur(); });
  removeInput.addEventListener('change', async () => {
    rule.remove = removeInput.value.split(',').map(s => s.trim()).filter(Boolean);
    await saveQpRule();
  });

  removeSection.append(removeLabel, removeInput);

  card.append(topRow, addSection, removeSection);

  // BUG FIX: was non-async so saveStorage() was fire-and-forget — the service
  // worker never received the storage change event to rebuild DNR rules.
  async function saveQpRule() {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return;
    const idx = profile.queryParams.findIndex(q => q.id === rule.id);
    if (idx !== -1) profile.queryParams[idx] = rule;
    await saveStorage(); // ← must be awaited to guarantee storage write completes
    renderTabCounts(profile);
  }

  return card;
}

// ── Card: Mock Rule ───────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  ['application/json', 'JSON'],
  ['text/plain', 'Plain text'],
  ['text/html', 'HTML'],
  ['application/xml', 'XML'],
];

const HTTP_METHODS = ['*','GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'];

function buildMockCard(rule) {
  const card = document.createElement('div');
  card.className = 'rule-card mock-card' + (rule.enabled ? '' : ' disabled');
  card.dataset.ruleId = rule.id;

  // Row 1: [dot] [method] [url] [status] [delete]
  const dotLabel = makeEnabledDot(rule.enabled, v => updateRuleField('mocks', rule.id, 'enabled', v));

  const topRow = document.createElement('div');
  topRow.className = 'mock-top-row';

  const methodSel = makeSelect('rule-select', HTTP_METHODS.map(m => [m, m]), rule.method ?? '*');
  methodSel.addEventListener('change', () => updateRuleField('mocks', rule.id, 'method', methodSel.value));

  const urlInput = makeInput('rule-input', 'URL contains…', rule.urlFilter ?? '', true);
  urlInput.addEventListener('change', () => updateRuleField('mocks', rule.id, 'urlFilter', urlInput.value));

  const statusInput = document.createElement('input');
  statusInput.className = 'mock-status-input';
  statusInput.type = 'number';
  statusInput.min = '100'; statusInput.max = '599';
  statusInput.value = String(rule.statusCode ?? 200);
  statusInput.title = 'Status code';
  statusInput.setAttribute('aria-label', 'Status code');
  statusInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') statusInput.blur(); });
  statusInput.addEventListener('change', () => updateRuleField('mocks', rule.id, 'statusCode', Number(statusInput.value)));

  const del = makeDeleteBtn();
  del.addEventListener('click', () => removeRule('mocks', rule.id));
  topRow.append(methodSel, urlInput, statusInput, del);

  const mockTopWrap = document.createElement('div');
  mockTopWrap.className = 'rule-card-header';
  mockTopWrap.append(dotLabel, topRow);

  // Row 2: [body textarea] [content-type select]
  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'mock-body-wrap';

  const bodyRow = document.createElement('div');
  bodyRow.className = 'mock-body-row';

  const textarea = document.createElement('textarea');
  textarea.className = 'mock-textarea';
  textarea.placeholder = '{ "mocked": true, "data": [] }';
  textarea.value = rule.responseBody ?? '';
  textarea.setAttribute('aria-label', 'Response body');
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      textarea.blur();
    }
  });
  textarea.addEventListener('change', () => updateRuleField('mocks', rule.id, 'responseBody', textarea.value));

  const ctypeWrap = document.createElement('div');
  ctypeWrap.style.display = 'flex';
  ctypeWrap.style.flexDirection = 'column';
  ctypeWrap.style.gap = '4px';

  const ctypeSel = makeSelect(
    'rule-select',
    CONTENT_TYPES.map(([v, l]) => [v, l]),
    rule.contentType ?? 'application/json'
  );
  ctypeSel.style.width = '100%';
  ctypeSel.addEventListener('change', () => updateRuleField('mocks', rule.id, 'contentType', ctypeSel.value));

  const badge = document.createElement('span');
  badge.className = 'mock-badge';
  badge.textContent = 'MOCK';

  ctypeWrap.append(ctypeSel, badge);
  bodyRow.append(textarea, ctypeWrap);
  bodyWrap.appendChild(bodyRow);

  // Response Delay field
  const delayWrap = document.createElement('div');
  delayWrap.className = 'mock-delay-wrap';

  const delayLabel = document.createElement('span');
  delayLabel.className = 'mock-delay-label';
  delayLabel.textContent = 'Response delay:';

  const delayInput = document.createElement('input');
  delayInput.className = 'mock-delay-input';
  delayInput.type = 'number';
  delayInput.min = '0';
  delayInput.max = '30000';
  delayInput.step = '100';
  delayInput.placeholder = '0';
  delayInput.value = String(rule.delayMs ?? 0);
  delayInput.title = 'Delay response by N milliseconds (simulates slow network)';
  delayInput.setAttribute('aria-label', 'Response delay in milliseconds');
  delayInput.addEventListener('keydown', e => { if (e.key === 'Enter') delayInput.blur(); });
  delayInput.addEventListener('change', () => updateRuleField('mocks', rule.id, 'delayMs', Number(delayInput.value)));

  const delayUnit = document.createElement('span');
  delayUnit.className = 'mock-delay-unit';
  delayUnit.textContent = 'ms';

  delayWrap.append(delayLabel, delayInput, delayUnit);
  card.append(mockTopWrap, bodyWrap, delayWrap);
  return card;
}

// ── Rule Field Updates ────────────────────────────────────────────────────────

async function updateRuleField(arrayKey, ruleId, field, value) {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) return;

  const arr = profile[arrayKey] ?? [];
  const rule = arr.find(r => r.id === ruleId);
  if (!rule) return;
  rule[field] = value;

  // Reflect visual state immediately for enabled toggle
  if (field === 'enabled') {
    const card = rulesContainer.querySelector(`[data-rule-id="${ruleId}"]`);
    if (card) card.classList.toggle('disabled', !value);
  }
  // Re-render type chips for header rules
  if (field === 'type' && arrayKey === 'headers') {
    const card = rulesContainer.querySelector(`[data-rule-id="${ruleId}"]`);
    if (card) {
      card.querySelectorAll('.type-chip').forEach(chip => {
        const t = chip.textContent === 'REQ' ? 'request' : 'response';
        chip.className = 'type-chip' + (value === t ? (t === 'request' ? ' active-req' : ' active-res') : '');
      });
    }
  }
  // Re-render resource chips for redirect rules
  if (field === 'resourceTypes' && arrayKey === 'redirects') {
    const card = rulesContainer.querySelector(`[data-rule-id="${ruleId}"]`);
    if (card) {
      card.querySelectorAll('.res-chip').forEach(chip => {
        if (chip.textContent === 'ALL') {
          chip.classList.toggle('active', !value.length);
        } else {
          chip.classList.toggle('active', value.includes(chip.title));
        }
      });
    }
  }

  await saveStorage();
  renderTabCounts(profile);
}

async function removeRule(arrayKey, ruleId) {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) return;
  profile[arrayKey] = (profile[arrayKey] ?? []).filter(r => r.id !== ruleId);
  await saveStorage();
  renderTab(profile);
  renderTabCounts(profile);
}

// ── Add Rule Factories ────────────────────────────────────────────────────────

async function addRule() {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) return;

  let newRule;
  switch (activeTab) {
    case 'headers':
      newRule = { id: crypto.randomUUID(), enabled: true, name: '', value: '', operation: 'set', type: 'request' };
      profile.headers = [...(profile.headers ?? []), newRule];
      break;
    case 'redirects':
      newRule = { id: crypto.randomUUID(), enabled: true, fromUrl: '', toUrl: '', useRegex: false, resourceTypes: [] };
      profile.redirects = [...(profile.redirects ?? []), newRule];
      break;
    case 'queryparams':
      newRule = { id: crypto.randomUUID(), enabled: true, urlFilter: '', useRegex: false, addOrReplace: [{ key: '', value: '' }], remove: [] };
      profile.queryParams = [...(profile.queryParams ?? []), newRule];
      break;
    case 'mocks':
      newRule = { id: crypto.randomUUID(), enabled: true, method: '*', urlFilter: '', useRegex: false, statusCode: 200, contentType: 'application/json', responseBody: '{\n  "mocked": true\n}' };
      profile.mocks = [...(profile.mocks ?? []), newRule];
      break;
  }

  await saveStorage();
  renderTab(profile);
  renderTabCounts(profile);
}

// ── Profile Actions ───────────────────────────────────────────────────────────

function selectProfile(id) {
  selectedProfileId = id;
  activeTab = 'headers';
  render();
}

async function addProfile() {
  const p = {
    id: crypto.randomUUID(), name: 'New Profile',
    urlFilter: '', useRegex: false, enabled: false,
    headers: [], redirects: [], queryParams: [], mocks: [],
  };
  profiles.push(p);
  selectedProfileId = p.id;
  if (!activeProfileId) activeProfileId = p.id;
  await saveStorage();
  render();
  profileNameInput.focus();
  profileNameInput.select();
}

async function deleteProfile() {
  if (!selectedProfileId) return;
  const name = profiles.find(p => p.id === selectedProfileId)?.name ?? 'Profile';
  profiles = profiles.filter(p => p.id !== selectedProfileId);
  if (activeProfileId === selectedProfileId) activeProfileId = profiles[0]?.id ?? null;
  selectedProfileId = profiles[0]?.id ?? null;
  await saveStorage();
  render();
  showToast(`"${name}" deleted`, 'error');
}

async function updateActiveProfile(field, value) {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) return;
  profile[field] = value;
  await saveStorage();
  renderProfileList();
}

// ── Import / Export ───────────────────────────────────────────────────────────

function exportProfile() {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) { showToast('Select a profile to export', 'error'); return; }
  const json = JSON.stringify(profile, null, 2);
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([json], { type: 'application/json' })),
    download: `${profile.name.replace(/\s+/g, '_')}_headercraft.json`,
  });
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('Profile exported', 'success');
}

async function importProfile(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : [data];
    let imported = 0;
    for (const raw of incoming) {
      if (!raw.name || !Array.isArray(raw.headers)) continue;
      profiles.push(migrateProfile({ ...raw, id: crypto.randomUUID(), enabled: false }));
      imported++;
    }
    if (!imported) { showToast('No valid profiles found', 'error'); return; }
    selectedProfileId = profiles.at(-1).id;
    await saveStorage(); render();
    showToast(`Imported ${imported} profile${imported > 1 ? 's' : ''}`, 'success');
  } catch (_) {
    showToast('Invalid JSON file', 'error');
  } finally { e.target.value = ''; }
}

// ── ModHeader / Requestly Import ──────────────────────────────────────────────

async function importFromModHeader(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const raw = JSON.parse(await file.text());

    // Support: single object, array at root, or nested under a key
    const items = Array.isArray(raw) ? raw
      : raw.profiles ? raw.profiles          // some ModHeader versions
      : raw.rules    ? raw.rules             // Requestly format
      : [raw];

    let imported = 0;

    for (const item of items) {
      // ── ModHeader format ────────────────────────────────────────────────
      if (item.headers || item.respHeaders || item.filters) {
        const urlFilter = item.filters?.[0]?.pattern ?? '';
        const headers = [
          ...(item.headers ?? []).map(h => ({
            id: crypto.randomUUID(), enabled: h.enabled ?? true,
            name: h.name, value: h.value ?? '', operation: 'set', type: 'request',
          })),
          ...(item.respHeaders ?? []).map(h => ({
            id: crypto.randomUUID(), enabled: h.enabled ?? true,
            name: h.name, value: h.value ?? '', operation: 'set', type: 'response',
          })),
        ];
        const redirects = (item.urlReplacements ?? []).map(r => ({
          id: crypto.randomUUID(), enabled: r.enabled ?? true,
          fromUrl: r.name ?? '', toUrl: r.value ?? '',
          useRegex: false, resourceTypes: [],
        }));

        profiles.push(migrateProfile({
          id: crypto.randomUUID(), enabled: false,
          name: item.title ?? item.name ?? `Imported ${imported + 1}`,
          urlFilter, useRegex: false,
          headers, redirects, queryParams: [], mocks: [],
        }));
        imported++;
        continue;
      }

      // ── Requestly format ────────────────────────────────────────────────
      if (item.ruleType === 'HEADERS' && item.pairs) {
        const headers = [];
        for (const pair of item.pairs) {
          const src = pair.source?.value ?? '';
          for (const [kind, type] of [['Request', 'request'], ['Response', 'response']]) {
            for (const mod of pair.modifications?.[kind] ?? []) {
              headers.push({
                id: crypto.randomUUID(), enabled: true,
                name: mod.header, value: mod.value ?? '',
                operation: (mod.type ?? 'Add').toLowerCase() === 'remove' ? 'remove' : 'set',
                type,
              });
            }
          }
          profiles.push(migrateProfile({
            id: crypto.randomUUID(), enabled: false,
            name: item.name ?? `Requestly ${imported + 1}`,
            urlFilter: src, useRegex: false,
            headers, redirects: [], queryParams: [], mocks: [],
          }));
          imported++;
        }
        continue;
      }

      // ── Requestly redirect rules ────────────────────────────────────────
      if (item.ruleType === 'REDIRECT' && item.pairs) {
        const redirects = item.pairs.map(pair => ({
          id: crypto.randomUUID(), enabled: true,
          fromUrl: pair.source?.value ?? '',
          toUrl: pair.destination ?? '',
          useRegex: pair.source?.operator === 'Matches',
          resourceTypes: [],
        }));
        profiles.push(migrateProfile({
          id: crypto.randomUUID(), enabled: false,
          name: item.name ?? `Redirect Import ${imported + 1}`,
          urlFilter: '', useRegex: false,
          headers: [], redirects, queryParams: [], mocks: [],
        }));
        imported++;
      }
    }

    if (!imported) { showToast('No recognisable profiles in file', 'error'); return; }
    selectedProfileId = profiles.at(-1).id;
    await saveStorage(); render();
    showToast(`Imported ${imported} profile${imported > 1 ? 's' : ''} from ModHeader/Requestly`, 'success');
  } catch (err) {
    showToast('Could not parse file', 'error');
    console.error('[HeaderCraft] ModHeader import error:', err);
  } finally { e.target.value = ''; }
}

// ── Stateless URL Sharing (Compression / Decompression) ───────────────────────

async function compressProfile(profile) {
  const json = JSON.stringify(profile);
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate'));
  const buf = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decompressProfile(encoded) {
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
  const text = await new Response(stream).text();
  return JSON.parse(text);
}

function openModal() {
  shareModal.classList.remove('hidden');
}

function closeModal() {
  shareModal.classList.add('hidden');
}

async function openShareModal() {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) { showToast('Select a profile to share', 'error'); return; }
  try {
    const token = await compressProfile(profile);
    const shareCode = `HC:${token}`;
    modalTitle.textContent = `Share "${profile.name}"`;
    modalDesc.textContent = 'Stateless Profile Code (entire profile compressed into code):';
    modalInput.value = shareCode;
    modalInput.readOnly = true;
    modalActionBtn.textContent = 'Copy Code';
    modalSubtext.textContent = 'No website or server needed. Anyone with this code can click the import button and paste it to instantly clone your profile.';
    modalActionBtn.onclick = async () => {
      await navigator.clipboard.writeText(shareCode);
      showToast('Share code copied to clipboard', 'success');
      closeModal();
    };
    openModal();
    await navigator.clipboard.writeText(shareCode);
    showToast('Share code copied to clipboard', 'success');
  } catch (err) {
    showToast('Failed to generate share code', 'error');
    console.error(err);
  }
}

function openImportUrlModal() {
  modalTitle.textContent = 'Import from Share Code / Link';
  modalDesc.textContent = 'Paste a HeaderCraft share code (HC:...) or import link:';
  modalInput.value = '';
  modalInput.placeholder = 'HC:... or #import=...';
  modalInput.readOnly = false;
  modalActionBtn.textContent = 'Import Profile';
  modalSubtext.textContent = 'Paste any HC:... share code or import link to immediately clone the profile.';
  modalActionBtn.onclick = async () => {
    const inputVal = modalInput.value.trim();
    if (!inputVal) { showToast('Please paste a code or link', 'error'); return; }
    try {
      let token = inputVal;
      if (token.startsWith('HC:')) token = token.slice(3);
      if (token.includes('#import=')) token = token.split('#import=')[1];
      else if (token.includes('import=')) token = token.split('import=')[1];
      const imported = await decompressProfile(decodeURIComponent(token.trim()));
      if (!imported || typeof imported !== 'object') throw new Error('Invalid format');

      const p = migrateProfile({
        ...imported,
        id: crypto.randomUUID(),
        name: (imported.name || 'Shared Profile') + ' (Imported)',
        enabled: false,
      });
      profiles.unshift(p);
      selectedProfileId = p.id;
      await saveStorage();
      render();
      closeModal();
      showToast(`Imported "${p.name}"`, 'success');
    } catch (err) {
      showToast('Invalid or corrupted share code', 'error');
      console.error(err);
    }
  };
  openModal();
  setTimeout(() => modalInput.focus(), 50);
}

// ── Event Listeners ───────────────────────────────────────────────────────────

btnAddProfile.addEventListener('click', addProfile);
btnShareProfile.addEventListener('click', openShareModal);
btnImportUrl.addEventListener('click', openImportUrlModal);
btnCloseModal.addEventListener('click', closeModal);
shareModal.addEventListener('click', (e) => { if (e.target === shareModal) closeModal(); });

btnScopeTab.addEventListener('click', async () => {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) return;

  // Toggle off if already scoped
  if (profile.scopedTabId) {
    profile.scopedTabId = null;
    profile.scopedTabTitle = null;
    await saveStorage();
    renderMainPanel();
    showToast('Profile unscoped — rules apply to all tabs', 'info');
    return;
  }

  // Query active tab in the browser window
  try {
    let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab) [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      showToast('No active tab detected', 'error');
      return;
    }
    let title = tab.title || '';
    try {
      if (tab.url) title = new URL(tab.url).hostname || tab.title;
    } catch (_) {}

    profile.scopedTabId = tab.id;
    profile.scopedTabTitle = title;
    await saveStorage();
    renderMainPanel();
    showToast(`Scoped to Tab #${tab.id} (${title})`, 'success');
  } catch (err) {
    showToast('Failed to scope to tab', 'error');
    console.error(err);
  }
});

if (btnSeedExample) {
  btnSeedExample.addEventListener('click', async () => {
    const existing = profiles.find(p => p.name?.startsWith('Example – All Features') || p.name?.startsWith('📖 Example'));
    if (existing) {
      selectProfile(existing.id);
      showToast('Switched to Demo Profile', 'info');
      return;
    }
    const example = createUnifiedExampleProfile();
    profiles.unshift(example);
    selectedProfileId = example.id;
    await saveStorage();
    render();
    showToast('Added Demo Profile with all features', 'success');
  });
}

btnDeleteProfile.addEventListener('click', deleteProfile);
btnEditName.addEventListener('click', () => { profileNameInput.focus(); profileNameInput.select(); });

btnAddRule.addEventListener('click', addRule);

btnRefreshVars.addEventListener('click', async () => {
  await saveStorage(); // triggers storage.onChanged → SW rebuilds rules
  showToast('Variables refreshed', 'success');
});

btnExport.addEventListener('click', exportProfile);
btnImport.addEventListener('click', () => fileImportInput.click());
fileImportInput.addEventListener('change', importProfile);
btnImportModHeader.addEventListener('click', () => fileImportModHeader.click());
fileImportModHeader.addEventListener('change', importFromModHeader);

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    activeTab = btn.dataset.tab;
    ruleSearchQuery = ''; // Reset search on tab switch
    syncTabBar();
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (profile) renderTab(profile);
  });
});

// Profile name: real-time sidebar update + debounced save
const saveProfileName = debounce(name => updateActiveProfile('name', name || 'Unnamed Profile'), 300);
profileNameInput.addEventListener('input', () => {
  const name = profileNameInput.value.trim() || 'Unnamed Profile';
  const li = profileList.querySelector(`[data-id="${selectedProfileId}"] .profile-label`);
  if (li) li.textContent = name;
  saveProfileName(name);
});
profileNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { profileNameInput.blur(); updateActiveProfile('name', profileNameInput.value.trim() || 'Unnamed Profile'); }
});

profileEnabledToggle.addEventListener('change', () => {
  const enabled = profileEnabledToggle.checked;
  profileStatusLabel.textContent = enabled ? 'On' : 'Off';
  profileStatusLabel.className = 'status-label ' + (enabled ? 'on' : 'off');
  if (enabled) activeProfileId = selectedProfileId;
  else resetHitCounters(); // clear hit counters when profile is turned off
  updateActiveProfile('enabled', enabled);
});

urlFilterInput.addEventListener('change', () => updateActiveProfile('urlFilter', urlFilterInput.value.trim()));
urlFilterInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    urlFilterInput.blur();
    updateActiveProfile('urlFilter', urlFilterInput.value.trim());
  }
});
useRegexToggle.addEventListener('change', () => updateActiveProfile('useRegex', useRegexToggle.checked));

// ── Presets Menu Listeners ──
if (btnPresets && presetsMenu) {
  btnPresets.addEventListener('click', (e) => {
    e.stopPropagation();
    renderPresetsMenu();
    const isHidden = presetsMenu.classList.toggle('hidden');
    btnPresets.classList.toggle('open', !isHidden);
  });

  document.addEventListener('click', (e) => {
    if (!presetsDropdownWrap?.contains(e.target)) {
      presetsMenu?.classList.add('hidden');
      btnPresets.classList.remove('open');
    }
  });
}

// ── Mock Console Logs Toggle Listener ──
if (btnMockLogs) {
  btnMockLogs.addEventListener('click', async () => {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (!profile) return;
    const current = profile.consoleLogging !== false;
    profile.consoleLogging = !current;
    await saveStorage();
    syncMockLogsBtn(profile);
    showToast(`DevTools console logs ${profile.consoleLogging ? 'enabled' : 'disabled'}`, 'info');
  });
}

// ── Empty State Action Listener ──
if (btnEmptyAction) {
  btnEmptyAction.addEventListener('click', () => addRule());
}

// ── Auto-Disable Timer Listener ──
if (autoDisableSelect) {
  autoDisableSelect.addEventListener('change', () => {
    const minutes = parseInt(autoDisableSelect.value, 10) || 0;
    setAutoDisableTimer(minutes);
  });
}

// ── Rule Search Listeners: wired per-instance inside buildRuleSearchBar() ──
// (no static listeners needed — events are attached at build time)

// ── Hit Counter: listen for rule-match messages from background ──
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'RULE_HIT' && message.ruleId) {
    incrementHit(message.ruleId);
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  await loadStorage();
  selectedProfileId = activeProfileId ?? profiles[0]?.id ?? null;
  render();
  // Resume any active countdown timers
  startCountdownDisplay();
})();
