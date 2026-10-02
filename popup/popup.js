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

let workspaces        = [{ id: 'default', name: 'Personal', isDefault: true }];
let activeWorkspaceId = 'default';
let folders           = []; // [{ id: string, name: string, workspaceId: string, collapsed: boolean }]
let profiles          = [];
let activeProfileId   = null;
let selectedProfileId = null;
let activeTab         = 'headers'; // 'headers' | 'redirects' | 'queryparams' | 'mocks'
let cookieVault       = []; // [{ id, domain, enabled, cookies: [{ id, name, value, path, enabled, secure, httpOnly }] }]
let selectedCookieDomainId = null;

// ── DOM refs ─────────────────────────────────────────────────────────────────

const btnWorkspaceSwitcher  = document.getElementById('btn-workspace-switcher');
const currentWorkspaceName  = document.getElementById('current-workspace-name');
const workspaceDropdown     = document.getElementById('workspace-dropdown');
const workspaceList         = document.getElementById('workspace-list');
const btnCreateWorkspace    = document.getElementById('btn-create-workspace');
const btnRenameWorkspace    = document.getElementById('btn-rename-workspace');
const btnDeleteWorkspace    = document.getElementById('btn-delete-workspace');

const btnAddFolder          = document.getElementById('btn-add-folder');
const btnProfileFolderSelect= document.getElementById('btn-profile-folder-select');
const profileFolderBadgeText= document.getElementById('profile-folder-badge-text');
const profileFolderDropdown = document.getElementById('profile-folder-dropdown');

const profileList           = document.getElementById('profile-list');
const btnAddProfile         = document.getElementById('btn-add-profile');
const btnSeedExample         = document.getElementById('btn-seed-example');
const btnShareProfile       = document.getElementById('btn-share-profile');
const btnImportHub          = document.getElementById('btn-import-hub') || document.getElementById('btn-import-url');
const btnImportUrl          = btnImportHub;
const btnExport             = document.getElementById('btn-export');
const btnImport             = document.getElementById('btn-import');
const btnImportModHeader    = document.getElementById('btn-import-modheader');
const fileImportInput       = document.getElementById('file-import-input');
const fileImportModHeader   = document.getElementById('file-import-modheader');

// Prompt Modal DOM refs
const promptDialogModal     = document.getElementById('prompt-dialog-modal');
const promptModalTitle      = document.getElementById('prompt-modal-title');
const promptModalDesc       = document.getElementById('prompt-modal-desc');
const promptModalInput      = document.getElementById('prompt-modal-input');
const btnPromptModalSubmit  = document.getElementById('btn-prompt-modal-submit');
const btnClosePrompt        = document.getElementById('btn-close-prompt');

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

// Import Hub Modal DOM refs
const importHubModal        = document.getElementById('import-hub-modal');
const btnCloseImportHub     = document.getElementById('btn-close-import-hub');
const tabImportText         = document.getElementById('tab-import-text');
const tabImportFile         = document.getElementById('tab-import-file');
const importContentText     = document.getElementById('import-content-text');
const importContentFile     = document.getElementById('import-content-file');
const importHubTextarea     = document.getElementById('import-hub-textarea');
const btnImportPasteSample  = document.getElementById('btn-import-paste-sample');
const btnImportClearText    = document.getElementById('btn-import-clear-text');
const importPreviewBox      = document.getElementById('import-preview-box');
const importDetectedPill    = document.getElementById('import-detected-pill');
const importPreviewSummary  = document.getElementById('import-preview-summary');
const importPreviewDetails  = document.getElementById('import-preview-details');
const btnImportHubSubmit    = document.getElementById('btn-import-hub-submit');
const importDropZone        = document.getElementById('import-drop-zone');
const importHubFileInput    = document.getElementById('import-hub-file-input');
const cardFormatPostman     = document.getElementById('card-format-postman');
const cardFormatInsomnia    = document.getElementById('card-format-insomnia');
const cardFormatBruno       = document.getElementById('card-format-bruno');
const cardFormatOpenapi     = document.getElementById('card-format-openapi');
const cardFormatHar         = document.getElementById('card-format-har');
const cardFormatSoapui      = document.getElementById('card-format-soapui');
const cardFormatHeadercraft = document.getElementById('card-format-headercraft');
const cardFormatModheader   = document.getElementById('card-format-modheader');

// Cookie Vault DOM refs
const btnCookieVault            = document.getElementById('btn-cookie-vault');
const btnProfileCookieVault     = document.getElementById('btn-profile-cookie-vault');
const profileCookiesCount       = document.getElementById('profile-cookies-count');
const cookieVaultModal          = document.getElementById('cookie-vault-modal');
const btnCloseCookieVault       = document.getElementById('btn-close-cookie-vault');
const btnCookieVaultDone        = document.getElementById('btn-cookie-vault-done');
const cookieDomainSelect        = document.getElementById('cookie-domain-select');
const btnAddCookieDomain        = document.getElementById('btn-add-cookie-domain');
const btnDelCookieDomain        = document.getElementById('btn-del-cookie-domain');
const cookieDomainEnabled       = document.getElementById('cookie-domain-enabled');
const btnFetchTabCookies        = document.getElementById('btn-fetch-tab-cookies');
const btnSyncBrowserCookies     = document.getElementById('btn-sync-browser-cookies');
const btnCopyCookieHeader       = document.getElementById('btn-copy-cookie-header');
const cookieStringImporter      = document.getElementById('cookie-string-importer');
const cookieStringInput         = document.getElementById('cookie-string-input');
const btnToggleCookieStringBox  = document.getElementById('btn-toggle-cookie-string-box');
const btnSubmitCookieString     = document.getElementById('btn-submit-cookie-string');
const btnCancelCookieString     = document.getElementById('btn-cancel-cookie-string');
const cookieCountLabel          = document.getElementById('cookie-count-label');
const btnAddCookieRow           = document.getElementById('btn-add-cookie-row');
const cookieRowsContainer       = document.getElementById('cookie-rows-container');
const cookieEmptyHint           = document.getElementById('cookie-empty-hint');

// Expand-to-Tab & Help DOM refs
const btnExpandTab          = document.getElementById('btn-expand-tab');
const btnHelp               = document.getElementById('btn-help');
const helpModal             = document.getElementById('help-modal');
const btnCloseHelp          = document.getElementById('btn-close-help');
const btnAddCustomVar       = document.getElementById('btn-add-custom-var');
const customVarsList        = document.getElementById('custom-vars-list');
const customVarsHint        = document.getElementById('custom-vars-hint');

// Profile custom variables modal DOM refs
const btnToggleProfileVars  = document.getElementById('btn-toggle-profile-vars');
const profileVarsCount      = document.getElementById('profile-vars-count');
const varsModal             = document.getElementById('vars-modal');
const varsModalProfileBadge = document.getElementById('vars-modal-profile-badge');
const btnCloseVarsModal     = document.getElementById('btn-close-vars-modal');
const btnVarsModalDone      = document.getElementById('btn-vars-modal-done');
const btnModalAddVar        = document.getElementById('btn-modal-add-var');
const varsModalList         = document.getElementById('vars-modal-list');
const varsModalEmptyHint    = document.getElementById('vars-modal-empty-hint');

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

// v1.3.0 DOM refs
const ruleSearchBar         = document.getElementById('rule-search-bar');
const ruleSearchInput       = document.getElementById('rule-search-input');
const ruleSearchClear       = document.getElementById('rule-search-clear');
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
  if (!profile) return;

  if (!minutes || minutes <= 0) {
    delete profile.autoDisableAt;
    autoDisableCountdown?.classList.add('hidden');
    await saveStorage();
    return;
  }

  // Setting an auto-disable timer turns the profile ON if it was OFF
  if (!profile.enabled) {
    profile.enabled = true;
    activeProfileId = profile.id;
    profileEnabledToggle.checked = true;
    profileStatusLabel.textContent = 'On';
    profileStatusLabel.className = 'status-label on';
    renderProfileList();
  }

  const fireAt = Date.now() + minutes * 60_000;
  profile.autoDisableAt = fireAt;
  await saveStorage();
  startCountdownDisplay();
}

function startCountdownDisplay() {
  clearAutoDisableTimer();
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile?.autoDisableAt || !profile.enabled) {
    autoDisableCountdown?.classList.add('hidden');
    return;
  }
  function tick() {
    const p = profiles.find(item => item.id === selectedProfileId);
    if (!p || !p.enabled || !p.autoDisableAt) {
      clearAutoDisableTimer();
      autoDisableCountdown?.classList.add('hidden');
      if (autoDisableSelect) autoDisableSelect.value = '0';
      return;
    }
    const remaining = p.autoDisableAt - Date.now();
    if (remaining <= 0) {
      clearAutoDisableTimer();
      autoDisableCountdown?.classList.add('hidden');
      if (autoDisableSelect) autoDisableSelect.value = '0';
      p.enabled = false;
      delete p.autoDisableAt;
      activeProfileId = profiles.find(x => x.enabled)?.id ?? null;
      profileEnabledToggle.checked = false;
      profileStatusLabel.textContent = 'Off';
      profileStatusLabel.className = 'status-label off';
      saveStorage().then(() => {
        render();
        showToast(`Profile "${p.name}" auto-disabled`, 'info');
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

function initRuleSearch() {
  if (!ruleSearchInput || !ruleSearchClear) return;

  ruleSearchInput.addEventListener('input', () => {
    ruleSearchQuery = ruleSearchInput.value;
    ruleSearchClear.classList.toggle('hidden', !ruleSearchQuery);
    applyRuleSearch();
  });

  ruleSearchClear.addEventListener('click', () => {
    ruleSearchQuery = '';
    ruleSearchInput.value = '';
    ruleSearchClear.classList.add('hidden');
    applyRuleSearch();
    ruleSearchInput.focus();
  });
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

// ── Storage ───────────────────────────────────────────────────────────────────

function migrateProfile(p, currentWsId = 'default') {
  return {
    redirects: [], queryParams: [], mocks: [], customVars: [],
    scopedTabId: null, scopedTabTitle: null,
    workspaceId: p.workspaceId || currentWsId || 'default',
    folderId: p.folderId || null,
    ...p,
    headers: p.headers ?? [],
    customVars: p.customVars ?? [],
  };
}

function createUnifiedExampleProfile(wsId = 'default') {
  const uid = () => crypto.randomUUID();
  return {
    id: uid(),
    workspaceId: wsId,
    folderId: null,
    name: 'Example – All Features',
    urlFilter: '',
    useRegex: false,
    enabled: false,

    // Custom Dynamic Variables
    customVars: [
      { id: uid(), key: 'api_key', value: 'dev_sec_9938a1f' },
      { id: uid(), key: 'env', value: 'staging' },
    ],

    headers: [
      {
        id: uid(), enabled: true,
        name: 'Authorization', value: 'Bearer YOUR_TOKEN_HERE',
        operation: 'set', type: 'request',
      },
      {
        id: uid(), enabled: true,
        name: 'X-API-Key', value: '{{api_key}}',
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
  const data = await chrome.storage.local.get([
    'workspaces', 'activeWorkspaceId', 'folders',
    'profiles', 'activeProfileId', 'cookieVault', 'exampleSeededV3'
  ]);

  workspaces = Array.isArray(data.workspaces) && data.workspaces.length > 0
    ? data.workspaces
    : [{ id: 'default', name: 'Personal', isDefault: true, createdAt: Date.now() }];

  activeWorkspaceId = data.activeWorkspaceId && workspaces.some(w => w.id === data.activeWorkspaceId)
    ? data.activeWorkspaceId
    : workspaces[0].id;

  folders = Array.isArray(data.folders) ? data.folders : [];
  cookieVault = Array.isArray(data.cookieVault) ? data.cookieVault : [];

  let loadedProfiles = (data.profiles ?? []).map(p => migrateProfile(p, activeWorkspaceId));

  // If v3 unified example profile has not yet been seeded, or if storage has no profiles at all:
  if (!data.exampleSeededV3 || loadedProfiles.length === 0) {
    loadedProfiles = loadedProfiles.filter(p => !p.name?.startsWith('📖 Example') && !p.name?.startsWith('Example – All Features'));
    const example = createUnifiedExampleProfile(activeWorkspaceId);
    loadedProfiles.unshift(example);
    activeProfileId = data.activeProfileId ?? example.id;
    await chrome.storage.local.set({
      workspaces,
      activeWorkspaceId,
      folders,
      profiles: loadedProfiles,
      activeProfileId,
      cookieVault,
      exampleSeededV3: true,
    });
  } else {
    activeProfileId = data.activeProfileId ?? loadedProfiles[0]?.id ?? null;
  }

  profiles = loadedProfiles;
  const currentWsProfiles = profiles.filter(p => (p.workspaceId || 'default') === activeWorkspaceId);
  selectedProfileId = currentWsProfiles.find(p => p.id === activeProfileId)?.id || currentWsProfiles[0]?.id || profiles[0]?.id || null;
}

async function saveStorage() {
  await chrome.storage.local.set({
    workspaces,
    activeWorkspaceId,
    folders,
    profiles,
    activeProfileId,
    cookieVault,
  });
}

// ── HTML Escape Helper ────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2500);
}

// ── Prompt Modal Dialog Controller ───────────────────────────────────────────

let promptResolve = null;

function openPromptDialog({ title = 'Enter Name', desc = 'Enter name:', defaultValue = '', placeholder = '', confirmText = 'Save' }) {
  return new Promise((resolve) => {
    promptResolve = resolve;
    if (promptModalTitle) promptModalTitle.textContent = title;
    if (promptModalDesc) promptModalDesc.textContent = desc;
    if (promptModalInput) {
      promptModalInput.value = defaultValue;
      promptModalInput.placeholder = placeholder;
    }
    if (btnPromptModalSubmit) btnPromptModalSubmit.textContent = confirmText;
    if (promptDialogModal) {
      promptDialogModal.classList.remove('hidden');
      setTimeout(() => {
        promptModalInput?.focus();
        promptModalInput?.select();
      }, 50);
    }
  });
}

function closePromptDialog(result = null) {
  if (promptDialogModal) promptDialogModal.classList.add('hidden');
  if (promptResolve) {
    promptResolve(result);
    promptResolve = null;
  }
}

if (btnPromptModalSubmit && promptModalInput) {
  btnPromptModalSubmit.addEventListener('click', () => {
    const val = promptModalInput.value.trim();
    closePromptDialog(val || null);
  });
  promptModalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = promptModalInput.value.trim();
      closePromptDialog(val || null);
    } else if (e.key === 'Escape') {
      closePromptDialog(null);
    }
  });
}

if (btnClosePrompt) btnClosePrompt.addEventListener('click', () => closePromptDialog(null));
if (promptDialogModal) {
  promptDialogModal.addEventListener('click', (e) => {
    if (e.target === promptDialogModal) closePromptDialog(null);
  });
}

// ── Workspace Controller ──────────────────────────────────────────────────────

function getActiveWorkspace() {
  return workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
}

async function switchWorkspace(wsId) {
  if (!workspaces.some(w => w.id === wsId)) return;
  activeWorkspaceId = wsId;
  closeWorkspaceDropdown();

  const wsProfiles = profiles.filter(p => (p.workspaceId || 'default') === activeWorkspaceId);
  selectedProfileId = wsProfiles[0]?.id || null;

  await saveStorage();
  render();
  const ws = getActiveWorkspace();
  showToast(`Workspace: "${ws.name}"`, 'info');
}

async function handleCreateWorkspace() {
  closeWorkspaceDropdown();
  const name = await openPromptDialog({
    title: 'New Workspace',
    desc: 'Enter a name for the new workspace (e.g. Staging QA, Billing API):',
    placeholder: 'Workspace name...',
    confirmText: 'Create Workspace',
  });
  if (!name) return;

  const newWs = {
    id: crypto.randomUUID(),
    name,
    isDefault: false,
    createdAt: Date.now(),
  };

  workspaces.push(newWs);
  activeWorkspaceId = newWs.id;
  selectedProfileId = null;

  await saveStorage();
  render();
  showToast(`Created workspace: "${name}"`, 'success');
}

async function handleRenameWorkspace() {
  closeWorkspaceDropdown();
  const currentWs = getActiveWorkspace();
  const newName = await openPromptDialog({
    title: 'Rename Workspace',
    desc: `Enter a new name for "${currentWs.name}":`,
    defaultValue: currentWs.name,
    confirmText: 'Rename',
  });
  if (!newName || newName === currentWs.name) return;

  currentWs.name = newName;
  await saveStorage();
  render();
  showToast(`Renamed workspace to "${newName}"`, 'success');
}

async function handleDeleteWorkspace() {
  closeWorkspaceDropdown();
  const currentWs = getActiveWorkspace();
  if (workspaces.length <= 1 || currentWs.isDefault) {
    showToast('Cannot delete the default workspace', 'error');
    return;
  }

  const defaultWs = workspaces.find(w => w.isDefault) || workspaces[0];
  profiles.forEach(p => {
    if (p.workspaceId === currentWs.id) p.workspaceId = defaultWs.id;
  });
  folders.forEach(f => {
    if (f.workspaceId === currentWs.id) f.workspaceId = defaultWs.id;
  });

  workspaces = workspaces.filter(w => w.id !== currentWs.id);
  activeWorkspaceId = defaultWs.id;
  selectedProfileId = profiles.find(p => p.workspaceId === defaultWs.id)?.id || null;

  await saveStorage();
  render();
  showToast(`Deleted workspace "${currentWs.name}"`, 'info');
}

function toggleWorkspaceDropdown() {
  if (!workspaceDropdown) return;
  const isHidden = workspaceDropdown.classList.contains('hidden');
  if (isHidden) {
    renderWorkspaceList();
    workspaceDropdown.classList.remove('hidden');
  } else {
    workspaceDropdown.classList.add('hidden');
  }
}

function closeWorkspaceDropdown() {
  if (workspaceDropdown) workspaceDropdown.classList.add('hidden');
}

function renderWorkspaceList() {
  if (!workspaceList) return;
  workspaceList.innerHTML = '';
  for (const ws of workspaces) {
    const li = document.createElement('li');
    li.className = 'workspace-item' + (ws.id === activeWorkspaceId ? ' active' : '');
    
    const leftSpan = document.createElement('span');
    leftSpan.className = 'workspace-item-left';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'workspace-item-icon';
    iconSpan.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zM9 2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zM1 10.5A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/></svg>';
    leftSpan.appendChild(iconSpan);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'workspace-item-name';
    nameSpan.textContent = ws.name;
    leftSpan.appendChild(nameSpan);

    li.appendChild(leftSpan);

    if (ws.id === activeWorkspaceId) {
      const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      checkSvg.setAttribute('viewBox', '0 0 16 16');
      checkSvg.setAttribute('fill', 'currentColor');
      checkSvg.setAttribute('class', 'workspace-check-svg');
      checkSvg.innerHTML = '<path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>';
      li.appendChild(checkSvg);
    }
    li.addEventListener('click', () => switchWorkspace(ws.id));
    workspaceList.appendChild(li);
  }
}

// ── Folder Management Controller ─────────────────────────────────────────────

async function handleCreateFolder() {
  const name = await openPromptDialog({
    title: 'New Folder',
    desc: 'Enter a folder name (e.g. Authentication, Staging APIs, Mocks):',
    placeholder: 'Folder name...',
    confirmText: 'Create Folder',
  });
  if (!name) return;

  const newFolder = {
    id: crypto.randomUUID(),
    name,
    workspaceId: activeWorkspaceId,
    collapsed: false,
    createdAt: Date.now(),
  };

  folders.push(newFolder);
  await saveStorage();
  renderProfileList();
  showToast(`Created folder: "${name}"`, 'success');
}

function toggleFolderCollapse(folderId) {
  const f = folders.find(x => x.id === folderId);
  if (!f) return;
  f.collapsed = !f.collapsed;
  saveStorage();
  renderProfileList();
}

async function setProfileFolder(profileId, folderId) {
  const p = profiles.find(x => x.id === profileId);
  if (!p) return;
  p.folderId = folderId || null;
  await saveStorage();
  renderProfileList();
  renderMainPanel();
  closeFolderDropdown();
  const f = folders.find(x => x.id === folderId);
  showToast(f ? `Moved to folder: "${f.name}"` : 'Moved to root (No folder)', 'info');
}

function toggleFolderDropdown() {
  if (!profileFolderDropdown) return;
  const isHidden = profileFolderDropdown.classList.contains('hidden');
  if (isHidden) {
    renderFolderDropdownList();
    profileFolderDropdown.classList.remove('hidden');
  } else {
    profileFolderDropdown.classList.add('hidden');
  }
}

function closeFolderDropdown() {
  if (profileFolderDropdown) profileFolderDropdown.classList.add('hidden');
}

function renderFolderDropdownList() {
  if (!profileFolderDropdown) return;
  profileFolderDropdown.innerHTML = '';
  const currentProfile = profiles.find(p => p.id === selectedProfileId);
  if (!currentProfile) return;

  const wsFolders = folders.filter(f => (f.workspaceId || 'default') === activeWorkspaceId);

  // Option 1: No Folder
  const noFolderItem = document.createElement('div');
  noFolderItem.className = 'profile-folder-item' + (!currentProfile.folderId ? ' active' : '');
  noFolderItem.innerHTML = `
    <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" style="color:var(--text-muted);flex-shrink:0;">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.4"/>
      <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" stroke-width="1.4"/>
    </svg>
    <span>No Folder (Root)</span>
  `;
  noFolderItem.addEventListener('click', () => setProfileFolder(currentProfile.id, null));
  profileFolderDropdown.appendChild(noFolderItem);

  // Folder options
  for (const f of wsFolders) {
    const item = document.createElement('div');
    item.className = 'profile-folder-item' + (currentProfile.folderId === f.id ? ' active' : '');
    
    const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgIcon.setAttribute('viewBox', '0 0 16 16');
    svgIcon.setAttribute('width', '12');
    svgIcon.setAttribute('height', '12');
    svgIcon.setAttribute('fill', 'currentColor');
    svgIcon.style.cssText = 'color:#818cf8;flex-shrink:0;';
    svgIcon.innerHTML = '<path d="M.5 3l.04.87a1.99 1.99 0 0 0-.342 1.311l.637 7A2 2 0 0 0 2.826 14H13.17a2 2 0 0 0 1.991-1.819l.637-7A2 2 0 0 0 13.81 3H9.828a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 6.172 1H2.5a2 2 0 0 0-2 2zm1 0a1 1 0 0 1 1-1h3.672a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 9.828 4h3.982a1 1 0 0 1 .99 1.09l-.637 7a1 1 0 0 1-.996.91H2.826a1 1 0 0 1-.996-.91l-.637-7A1 1 0 0 1 1.5 3z"/>';

    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nameSpan.textContent = f.name;

    item.append(svgIcon, nameSpan);
    item.addEventListener('click', () => setProfileFolder(currentProfile.id, f.id));
    profileFolderDropdown.appendChild(item);
  }

  // Option: + New Folder
  const newFolderItem = document.createElement('div');
  newFolderItem.className = 'profile-folder-item';
  newFolderItem.style.borderTop = '1px solid rgba(255,255,255,0.08)';
  newFolderItem.style.color = 'var(--accent-light)';
  newFolderItem.innerHTML = `
    <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" style="color:var(--accent-light);flex-shrink:0;">
      <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/>
    </svg>
    <span>Create New Folder...</span>
  `;
  newFolderItem.addEventListener('click', async () => {
    closeFolderDropdown();
    await handleCreateFolder();
  });
  profileFolderDropdown.appendChild(newFolderItem);
}

// ── Render ────────────────────────────────────────────────────────────────────

function render() {
  renderProfileList();
  renderMainPanel();
}

function createProfileListItem(profile, inFolder = false) {
  const li = document.createElement('li');
  li.className = 'profile-item'
    + (inFolder ? ' in-folder' : '')
    + (profile.id === selectedProfileId ? ' active' : '')
    + (profile.id === activeProfileId && profile.enabled ? ' enabled' : '');
  li.dataset.id = profile.id;
  if (inFolder) li.title = `Profile: ${profile.name} (in folder)`;

  // HTML5 Drag & Drop Support
  li.setAttribute('draggable', 'true');
  li.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', profile.id);
    e.dataTransfer.effectAllowed = 'move';
    li.classList.add('dragging');
  });
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    document.querySelectorAll('.drag-target-hover').forEach(el => el.classList.remove('drag-target-hover'));
  });

  const dot = document.createElement('span');
  dot.className = 'profile-dot';
  const label = document.createElement('span');
  label.className = 'profile-label';
  label.textContent = profile.name;

  li.append(dot, label);
  li.addEventListener('click', () => selectProfile(profile.id));
  return li;
}

function renderProfileList() {
  if (!profileList) return;
  profileList.innerHTML = '';

  const currentWs = getActiveWorkspace();
  if (currentWorkspaceName) currentWorkspaceName.textContent = currentWs.name;

  const wsProfiles = profiles.filter(p => (p.workspaceId || 'default') === activeWorkspaceId);
  const wsFolders = folders.filter(f => (f.workspaceId || 'default') === activeWorkspaceId);

  // 1. Render Folders
  for (const folder of wsFolders) {
    const folderProfiles = wsProfiles.filter(p => p.folderId === folder.id);
    const folderGroup = document.createElement('div');
    folderGroup.className = 'folder-group' + (folder.collapsed ? ' collapsed' : ' expanded');

    const folderHeader = document.createElement('div');
    folderHeader.className = 'folder-header' + (folder.collapsed ? ' collapsed' : ' expanded');

    const titleLeft = document.createElement('div');
    titleLeft.className = 'folder-title-left';

    // SVG Chevron for folding
    const chevronSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevronSvg.setAttribute('viewBox', '0 0 16 16');
    chevronSvg.setAttribute('width', '10');
    chevronSvg.setAttribute('height', '10');
    chevronSvg.setAttribute('fill', 'currentColor');
    chevronSvg.setAttribute('class', 'folder-chevron-svg' + (folder.collapsed ? ' collapsed' : ''));
    chevronSvg.innerHTML = '<path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>';

    // SVG Folder Icon (Open when expanded, closed when collapsed)
    const folderSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    folderSvg.setAttribute('viewBox', '0 0 16 16');
    folderSvg.setAttribute('fill', 'currentColor');
    folderSvg.setAttribute('class', 'folder-icon-svg');
    if (folder.collapsed) {
      folderSvg.innerHTML = '<path d="M.5 3l.04.87a1.99 1.99 0 0 0-.342 1.311l.637 7A2 2 0 0 0 2.826 14H13.17a2 2 0 0 0 1.991-1.819l.637-7A2 2 0 0 0 13.81 3H9.828a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 6.172 1H2.5a2 2 0 0 0-2 2zm1 0a1 1 0 0 1 1-1h3.672a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 9.828 4h3.982a1 1 0 0 1 .99 1.09l-.637 7a1 1 0 0 1-.996.91H2.826a1 1 0 0 1-.996-.91l-.637-7A1 1 0 0 1 1.5 3z"/>';
    } else {
      folderSvg.innerHTML = '<path d="M1 3.5A1.5 1.5 0 0 1 2.5 2h2.764c.958 0 1.76.6 2.06 1.455l.235.666A.5.5 0 0 0 8.03 4.5H13.5A1.5 1.5 0 0 1 15 6v1H1V3.5zM15 8H1v5.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5V8z"/>';
    }

    const folderName = document.createElement('span');
    folderName.className = 'folder-name';
    folderName.textContent = folder.name;

    titleLeft.append(chevronSvg, folderSvg, folderName);

    // Folder Actions: Quick Add Profile & Count Badge
    const folderActions = document.createElement('div');
    folderActions.className = 'folder-actions';

    const addProfileBtn = document.createElement('button');
    addProfileBtn.className = 'folder-add-profile-btn';
    addProfileBtn.setAttribute('title', 'Add profile in this folder');
    addProfileBtn.setAttribute('aria-label', 'Add profile in this folder');
    addProfileBtn.innerHTML = '<svg viewBox="0 0 16 16" width="9" height="9" fill="currentColor"><path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"/></svg>';
    addProfileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addProfile(folder.id);
    });

    const count = document.createElement('span');
    count.className = 'folder-count';
    count.textContent = folderProfiles.length;

    folderActions.append(addProfileBtn, count);
    folderHeader.append(titleLeft, folderActions);
    folderHeader.addEventListener('click', () => toggleFolderCollapse(folder.id));

    // Drag and drop onto folder header
    folderHeader.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      folderHeader.classList.add('drag-target-hover');
    });
    folderHeader.addEventListener('dragleave', (e) => {
      if (!folderHeader.contains(e.relatedTarget)) {
        folderHeader.classList.remove('drag-target-hover');
      }
    });
    folderHeader.addEventListener('drop', async (e) => {
      e.preventDefault();
      folderHeader.classList.remove('drag-target-hover');
      const profileId = e.dataTransfer.getData('text/plain');
      if (!profileId) return;
      const p = profiles.find(x => x.id === profileId);
      if (!p || p.folderId === folder.id) return;
      p.folderId = folder.id;
      folder.collapsed = false;
      await saveStorage();
      render();
      showToast(`Moved "${p.name}" to folder "${folder.name}"`, 'success');
    });

    const folderItems = document.createElement('ul');
    folderItems.className = 'folder-items' + (folder.collapsed ? ' collapsed' : '');

    // Allow dropping onto folder items list too
    folderItems.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      folderItems.classList.add('drag-target-hover');
    });
    folderItems.addEventListener('dragleave', (e) => {
      if (!folderItems.contains(e.relatedTarget)) {
        folderItems.classList.remove('drag-target-hover');
      }
    });
    folderItems.addEventListener('drop', async (e) => {
      e.preventDefault();
      folderItems.classList.remove('drag-target-hover');
      const profileId = e.dataTransfer.getData('text/plain');
      if (!profileId) return;
      const p = profiles.find(x => x.id === profileId);
      if (!p || p.folderId === folder.id) return;
      p.folderId = folder.id;
      folder.collapsed = false;
      await saveStorage();
      render();
      showToast(`Moved "${p.name}" to folder "${folder.name}"`, 'success');
    });

    for (const p of folderProfiles) {
      folderItems.appendChild(createProfileListItem(p, true));
    }

    // If empty folder, show friendly prompt to add or drop
    if (folderProfiles.length === 0) {
      const emptyHint = document.createElement('li');
      emptyHint.className = 'folder-empty-hint';
      emptyHint.textContent = '+ Add profile here';
      emptyHint.addEventListener('click', () => addProfile(folder.id));
      folderItems.appendChild(emptyHint);
    }

    folderGroup.append(folderHeader, folderItems);
    profileList.appendChild(folderGroup);
  }

  // 2. Render Ungrouped / Root Profiles
  const rootProfiles = wsProfiles.filter(p => !p.folderId || !wsFolders.some(f => f.id === p.folderId));
  if (wsFolders.length > 0 && rootProfiles.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'sidebar-section-divider';
    divider.innerHTML = '<span class="sidebar-section-divider-text">Ungrouped</span>';
    profileList.appendChild(divider);
  }
  for (const p of rootProfiles) {
    profileList.appendChild(createProfileListItem(p, false));
  }

  // 3. Root Drop Zone (if folders exist, allow dragging profiles back out to Root)
  if (wsFolders.length > 0) {
    const rootDropZone = document.createElement('div');
    rootDropZone.className = 'root-drop-zone';
    rootDropZone.textContent = 'Drop here for Root (No Folder)';
    rootDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      rootDropZone.classList.add('drag-target-hover');
    });
    rootDropZone.addEventListener('dragleave', () => {
      rootDropZone.classList.remove('drag-target-hover');
    });
    rootDropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      rootDropZone.classList.remove('drag-target-hover');
      const profileId = e.dataTransfer.getData('text/plain');
      if (!profileId) return;
      const p = profiles.find(x => x.id === profileId);
      if (!p || !p.folderId) return;
      p.folderId = null;
      await saveStorage();
      render();
      showToast(`Moved "${p.name}" to Root`, 'info');
    });
    profileList.appendChild(rootDropZone);
  }

  // If no profiles exist in this workspace
  if (wsProfiles.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.style.cssText = 'padding:14px 8px;font-size:10.5px;color:var(--text-muted);text-align:center;line-height:1.4;';
    emptyLi.textContent = 'No profiles in this workspace. Click + to create one.';
    profileList.appendChild(emptyLi);
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
    if (profile.enabled && profile.autoDisableAt && profile.autoDisableAt > Date.now()) {
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
  if (ruleSearchInput) ruleSearchInput.value = '';
  if (ruleSearchClear) ruleSearchClear.classList.add('hidden');

  // Update Folder Badge in topbar
  if (profileFolderBadgeText) {
    const currentFolder = folders.find(f => f.id === profile.folderId);
    profileFolderBadgeText.textContent = currentFolder ? currentFolder.name : 'No Folder';
  }

  // Update Cookie Vault count in profile action bar
  if (profileCookiesCount) {
    const totalCookies = cookieVault.reduce((acc, s) => acc + (s.cookies || []).length, 0);
    profileCookiesCount.textContent = String(totalCookies);
  }

  renderTabCounts(profile);
  renderCustomVars(profile);
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
    if (ruleSearchBar) ruleSearchBar.classList.add('hidden');
    emptyTabState.classList.remove('hidden');
    renderEmptyPresets();
    renderPresetsStrip();
    return;
  }
  emptyTabState.classList.add('hidden');

  if (ruleSearchBar) {
    ruleSearchBar.classList.remove('hidden');
    if (ruleSearchInput) ruleSearchInput.value = ruleSearchQuery;
    if (ruleSearchClear) ruleSearchClear.classList.toggle('hidden', !ruleSearchQuery);
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

  const opSelect = makeSelect('rule-select rule-op-select', [['set','Set'],['append','Append'],['remove','Remove']], rule.operation || 'set');
  opSelect.dataset.op = rule.operation || 'set';

  const valInput = makeInput('', 'Value  ({{$uuid}}, {{$timestamp}})', rule.value, true);
  if (rule.operation === 'remove') {
    valInput.disabled = true;
    valInput.placeholder = '(Header will be removed)';
    valInput.classList.add('disabled-val');
  }

  opSelect.addEventListener('change', () => {
    opSelect.dataset.op = opSelect.value;
    updateRuleField('headers', rule.id, 'operation', opSelect.value);
    if (opSelect.value === 'remove') {
      valInput.disabled = true;
      valInput.placeholder = '(Header will be removed)';
      valInput.classList.add('disabled-val');
    } else {
      valInput.disabled = false;
      valInput.placeholder = 'Value  ({{$uuid}}, {{$timestamp}})';
      valInput.classList.remove('disabled-val');
    }
  });

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

async function addProfile(targetFolderId = null) {
  const folderId = (typeof targetFolderId === 'string') ? targetFolderId : null;
  const targetFolder = folderId ? folders.find(f => f.id === folderId) : null;
  const p = {
    id: crypto.randomUUID(),
    name: targetFolder ? `${targetFolder.name} Profile` : 'New Profile',
    workspaceId: activeWorkspaceId,
    folderId: folderId,
    urlFilter: '',
    useRegex: false,
    enabled: false,
    headers: [],
    redirects: [],
    queryParams: [],
    mocks: [],
    customVars: [],
  };
  if (targetFolder && targetFolder.collapsed) {
    targetFolder.collapsed = false;
  }
  profiles.push(p);
  selectedProfileId = p.id;
  if (!activeProfileId) activeProfileId = p.id;
  await saveStorage();
  render();
  profileNameInput.focus();
  profileNameInput.select();
  showToast(targetFolder ? `Created profile in folder: "${targetFolder.name}"` : 'Created new profile', 'success');
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

// ── Universal Import Hub & Parsers (Postman, cURL, ModHeader, Native JSON) ──

function parseCurlCommand(curlStr) {
  if (!curlStr || typeof curlStr !== 'string') return null;
  const trimmed = curlStr.trim();
  if (!trimmed) return null;

  // Clean up line continuations (Unix \ and Windows ^)
  const cleanCmd = trimmed.replace(/\\\r?\n/g, ' ').replace(/\^\r?\n/g, ' ');

  // Extract URL: match http/https URL in quotes or bare
  let url = '';
  const urlMatch = cleanCmd.match(/https?:\/\/[^\s'"]+/i) || cleanCmd.match(/['"](https?:\/\/[^'"]+)['"]/i);
  if (urlMatch) {
    url = urlMatch[1] || urlMatch[0];
  } else {
    // Check for bare URL or host/path
    const bareMatch = cleanCmd.match(/(?:curl\s+)?['"]?([a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s'"]*)?)['"]?/i);
    if (bareMatch) {
      url = bareMatch[1];
    }
  }

  // Parse HTTP Method
  let method = 'GET';
  const methodMatch = cleanCmd.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i);
  if (methodMatch) {
    method = methodMatch[1].toUpperCase();
  } else if (cleanCmd.includes('-d ') || cleanCmd.includes('--data') || cleanCmd.includes('--data-raw') || cleanCmd.includes('--data-binary')) {
    method = 'POST';
  }

  // Parse Headers (-H or --header)
  const headers = [];
  const headerRegex = /(?:-H|--header)\s+(?:'([^']+)'|"([^"]+)"|([^\s'"]+))/gi;
  let match;
  while ((match = headerRegex.exec(cleanCmd)) !== null) {
    const rawH = match[1] || match[2] || match[3];
    if (rawH && rawH.includes(':')) {
      const colonIdx = rawH.indexOf(':');
      const name = rawH.slice(0, colonIdx).trim();
      const value = rawH.slice(colonIdx + 1).trim();
      if (name) {
        headers.push({
          id: crypto.randomUUID(),
          enabled: true,
          name,
          value,
          operation: 'set',
          type: 'request',
        });
      }
    }
  }

  // Parse User-Agent (-A / --user-agent)
  const uaMatch = cleanCmd.match(/(?:-A|--user-agent)\s+(?:'([^']+)'|"([^"]+)"|([^\s'"]+))/i);
  if (uaMatch) {
    const ua = uaMatch[1] || uaMatch[2] || uaMatch[3];
    if (ua && !headers.some(h => h.name.toLowerCase() === 'user-agent')) {
      headers.push({ id: crypto.randomUUID(), enabled: true, name: 'User-Agent', value: ua, operation: 'set', type: 'request' });
    }
  }

  // Parse Basic Auth (-u / --user)
  const authMatch = cleanCmd.match(/(?:-u|--user)\s+(?:'([^']+)'|"([^"]+)"|([^\s'"]+))/i);
  if (authMatch) {
    const userPass = authMatch[1] || authMatch[2] || authMatch[3];
    if (userPass && !headers.some(h => h.name.toLowerCase() === 'authorization')) {
      headers.push({ id: crypto.randomUUID(), enabled: true, name: 'Authorization', value: `Basic ${btoa(userPass)}`, operation: 'set', type: 'request' });
    }
  }

  // Parse Cookie (-b / --cookie)
  const cookieMatch = cleanCmd.match(/(?:-b|--cookie)\s+(?:'([^']+)'|"([^"]+)"|([^\s'"]+))/i);
  if (cookieMatch) {
    const cookie = cookieMatch[1] || cookieMatch[2] || cookieMatch[3];
    if (cookie && !headers.some(h => h.name.toLowerCase() === 'cookie')) {
      headers.push({ id: crypto.randomUUID(), enabled: true, name: 'Cookie', value: cookie, operation: 'set', type: 'request' });
    }
  }

  // Parse Referer (-e / --referer)
  const refMatch = cleanCmd.match(/(?:-e|--referer)\s+(?:'([^']+)'|"([^"]+)"|([^\s'"]+))/i);
  if (refMatch) {
    const ref = refMatch[1] || refMatch[2] || refMatch[3];
    if (ref && !headers.some(h => h.name.toLowerCase() === 'referer')) {
      headers.push({ id: crypto.randomUUID(), enabled: true, name: 'Referer', value: ref, operation: 'set', type: 'request' });
    }
  }

  // Parse URL & Query Parameters
  const queryParams = [];
  let urlFilter = '';
  let profileName = 'cURL Import';

  if (url) {
    try {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      const parsedUrl = new URL(fullUrl);
      urlFilter = parsedUrl.hostname;
      profileName = `cURL: ${parsedUrl.hostname}${parsedUrl.pathname !== '/' ? parsedUrl.pathname.slice(0, 18) : ''}`;

      const params = [];
      parsedUrl.searchParams.forEach((val, key) => {
        params.push({ key, value: val });
      });

      if (params.length > 0) {
        queryParams.push({
          id: crypto.randomUUID(),
          enabled: true,
          urlFilter: parsedUrl.hostname,
          useRegex: false,
          addOrReplace: params,
          remove: [],
        });
      }
    } catch (_) {
      urlFilter = url.split('?')[0];
    }
  }

  // If no headers or url found, not a valid cURL
  if (headers.length === 0 && queryParams.length === 0 && !urlFilter) {
    return null;
  }

  return {
    id: crypto.randomUUID(),
    name: profileName,
    enabled: false,
    urlFilter,
    useRegex: false,
    headers,
    redirects: [],
    queryParams,
    mocks: [],
    customVars: [],
  };
}

function parsePostman(json) {
  if (!json || typeof json !== 'object') return null;

  // Postman Environment check
  const isEnv = json.values && Array.isArray(json.values) && (json._postman_variable_scope === 'environment' || json.name);
  if (isEnv) {
    const customVars = json.values
      .filter(v => v.key && v.enabled !== false)
      .map(v => ({ key: v.key.replace(/^\{\{|\}\}$/g, '').trim(), value: v.value ?? '' }));

    return [{
      id: crypto.randomUUID(),
      name: `Postman Env: ${json.name || 'Environment'}`,
      enabled: false,
      urlFilter: '',
      useRegex: false,
      headers: [],
      redirects: [],
      queryParams: [],
      mocks: [],
      customVars,
    }];
  }

  // Postman Collection check
  const isCollection = json.info && (json.item || json.info.schema);
  if (!isCollection) return null;

  const collectionName = json.info?.name || 'Postman Collection';
  const customVars = (json.variable || [])
    .filter(v => v.key)
    .map(v => ({ key: v.key.replace(/^\{\{|\}\}$/g, '').trim(), value: v.value ?? '' }));

  const items = [];
  function extractItems(arr) {
    if (!Array.isArray(arr)) return;
    for (const it of arr) {
      if (it.request) items.push(it);
      if (it.item) extractItems(it.item);
    }
  }
  extractItems(json.item);

  if (items.length === 0) return null;

  const allHeaders = [];
  const allQueryParams = [];
  const allMocks = [];
  let detectedHost = '';

  for (const it of items) {
    const req = it.request;
    if (!req) continue;

    // Headers
    if (Array.isArray(req.header)) {
      for (const h of req.header) {
        if (!h.key || h.disabled) continue;
        if (!allHeaders.some(existing => existing.name.toLowerCase() === h.key.toLowerCase() && existing.value === h.value)) {
          allHeaders.push({
            id: crypto.randomUUID(),
            enabled: true,
            name: h.key,
            value: h.value ?? '',
            operation: 'set',
            type: 'request',
          });
        }
      }
    }

    // Auth (Bearer, Basic, ApiKey)
    if (req.auth) {
      const authType = req.auth.type;
      if (authType === 'bearer' && Array.isArray(req.auth.bearer)) {
        const tokenObj = req.auth.bearer.find(b => b.key === 'token');
        if (tokenObj?.value && !allHeaders.some(h => h.name.toLowerCase() === 'authorization')) {
          allHeaders.push({
            id: crypto.randomUUID(),
            enabled: true,
            name: 'Authorization',
            value: `Bearer ${tokenObj.value}`,
            operation: 'set',
            type: 'request',
          });
        }
      } else if (authType === 'basic' && Array.isArray(req.auth.basic)) {
        const u = req.auth.basic.find(b => b.key === 'username')?.value ?? '';
        const p = req.auth.basic.find(b => b.key === 'password')?.value ?? '';
        if ((u || p) && !allHeaders.some(h => h.name.toLowerCase() === 'authorization')) {
          allHeaders.push({
            id: crypto.randomUUID(),
            enabled: true,
            name: 'Authorization',
            value: `Basic ${btoa(u + ':' + p)}`,
            operation: 'set',
            type: 'request',
          });
        }
      } else if (authType === 'apikey' && Array.isArray(req.auth.apikey)) {
        const k = req.auth.apikey.find(b => b.key === 'key')?.value || 'X-API-Key';
        const v = req.auth.apikey.find(b => b.key === 'value')?.value ?? '';
        if (v && !allHeaders.some(h => h.name.toLowerCase() === k.toLowerCase())) {
          allHeaders.push({
            id: crypto.randomUUID(),
            enabled: true,
            name: k,
            value: v,
            operation: 'set',
            type: 'request',
          });
        }
      }
    }

    // URL & Query params
    let reqUrl = '';
    if (typeof req.url === 'string') {
      reqUrl = req.url;
    } else if (req.url && typeof req.url === 'object') {
      reqUrl = req.url.raw || '';
      if (Array.isArray(req.url.query) && req.url.query.length > 0) {
        const queryList = req.url.query
          .filter(q => q.key && !q.disabled)
          .map(q => ({ key: q.key, value: q.value ?? '' }));
        if (queryList.length > 0) {
          allQueryParams.push({
            id: crypto.randomUUID(),
            enabled: true,
            urlFilter: req.url.host ? (Array.isArray(req.url.host) ? req.url.host.join('.') : req.url.host) : '',
            useRegex: false,
            addOrReplace: queryList,
            remove: [],
          });
        }
      }
    }

    if (reqUrl && !detectedHost) {
      try {
        const match = reqUrl.match(/https?:\/\/([^/?#]+)/i);
        if (match) detectedHost = match[1];
      } catch (_) {}
    }

    // Saved Mock responses
    if (Array.isArray(it.response) && it.response.length > 0) {
      for (const res of it.response) {
        if (res.body || res.code) {
          allMocks.push({
            id: crypto.randomUUID(),
            enabled: true,
            method: req.method || '*',
            urlFilter: reqUrl.split('?')[0] || `/${it.name.toLowerCase().replace(/\s+/g, '-')}`,
            useRegex: false,
            statusCode: res.code || 200,
            contentType: 'application/json',
            responseBody: res.body ?? '{\n  "mocked": true\n}',
            delayMs: 0,
          });
        }
      }
    }
  }

  return [{
    id: crypto.randomUUID(),
    name: `Postman: ${collectionName}`,
    enabled: false,
    urlFilter: detectedHost || '',
    useRegex: false,
    headers: allHeaders,
    redirects: [],
    queryParams: allQueryParams,
    mocks: allMocks,
    customVars,
  }];
}

function parseModHeader(raw) {
  if (!raw) return null;
  const items = Array.isArray(raw) ? raw
    : raw.profiles ? raw.profiles
    : raw.rules    ? raw.rules
    : [raw];

  const results = [];
  let imported = 0;

  for (const item of items) {
    // ModHeader format
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

      results.push({
        id: crypto.randomUUID(), enabled: false,
        name: item.title ?? item.name ?? `Imported ${imported + 1}`,
        urlFilter, useRegex: false,
        headers, redirects, queryParams: [], mocks: [],
      });
      imported++;
      continue;
    }

    // Requestly Headers
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
        results.push({
          id: crypto.randomUUID(), enabled: false,
          name: item.name ?? `Requestly ${imported + 1}`,
          urlFilter: src, useRegex: false,
          headers, redirects: [], queryParams: [], mocks: [],
        });
        imported++;
      }
      continue;
    }

    // Requestly Redirects
    if (item.ruleType === 'REDIRECT' && item.pairs) {
      const redirects = item.pairs.map(pair => ({
        id: crypto.randomUUID(), enabled: true,
        fromUrl: pair.source?.value ?? '',
        toUrl: pair.destination ?? '',
        useRegex: pair.source?.operator === 'Matches',
        resourceTypes: [],
      }));
      results.push({
        id: crypto.randomUUID(), enabled: false,
        name: item.name ?? `Redirect Import ${imported + 1}`,
        urlFilter: '', useRegex: false,
        headers: [], redirects, queryParams: [], mocks: [],
      });
      imported++;
    }
  }

  return results.length > 0 ? results : null;
}

function parseHeaderCraft(data) {
  if (!data) return null;
  const incoming = Array.isArray(data) ? data : [data];
  const results = [];
  for (const raw of incoming) {
    if (!raw || typeof raw !== 'object') continue;
    if (raw.name && (Array.isArray(raw.headers) || Array.isArray(raw.redirects) || Array.isArray(raw.queryParams) || Array.isArray(raw.mocks))) {
      results.push({
        ...raw,
        id: crypto.randomUUID(),
        enabled: false,
      });
    }
  }
  return results.length > 0 ? results : null;
}

// ── Cookie Vault Helper for Importers ──
function addCookieToVault(domain, cookieObj) {
  if (!domain || !cookieObj || !cookieObj.name) return;
  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^\*?\./, '');
  if (!cleanDomain) return;

  let store = cookieVault.find(s => s.domain === cleanDomain);
  if (!store) {
    store = {
      id: crypto.randomUUID(),
      domain: cleanDomain,
      enabled: true,
      cookies: [],
    };
    cookieVault.push(store);
  }

  const existingIdx = store.cookies.findIndex(c => c.name === cookieObj.name);
  if (existingIdx >= 0) {
    store.cookies[existingIdx] = { ...store.cookies[existingIdx], ...cookieObj };
  } else {
    store.cookies.push({
      id: crypto.randomUUID(),
      name: cookieObj.name,
      value: cookieObj.value ?? '',
      path: cookieObj.path || '/',
      enabled: cookieObj.enabled !== false,
      secure: !!cookieObj.secure,
      httpOnly: !!cookieObj.httpOnly,
    });
  }
}

// ── Insomnia v4/v5 Parser ──
function parseInsomnia(json) {
  if (!json || typeof json !== 'object') return null;
  const isInsomnia = json._type === 'export' || Array.isArray(json.resources);
  if (!isInsomnia) return null;

  const resources = json.resources || [];
  const reqs = resources.filter(r => r._type === 'request');
  const envs = resources.filter(r => r._type === 'environment');
  const cookieJars = resources.filter(r => r._type === 'cookie_jar');
  const workspace = resources.find(r => r._type === 'workspace');

  // Extract variables
  const customVars = [];
  for (const env of envs) {
    if (env.data && typeof env.data === 'object') {
      for (const [k, v] of Object.entries(env.data)) {
        if (k && !customVars.some(cv => cv.key === k)) {
          customVars.push({ id: crypto.randomUUID(), key: k, value: String(v ?? '') });
        }
      }
    }
  }

  // Extract cookies into Cookie Vault
  for (const cj of cookieJars) {
    for (const c of cj.cookies || []) {
      if (c && c.key && c.domain) {
        addCookieToVault(c.domain, {
          name: c.key,
          value: c.value ?? '',
          path: c.path || '/',
          enabled: !c.disabled,
          secure: !!c.secure,
          httpOnly: !!c.httpOnly,
        });
      }
    }
  }

  const allHeaders = [];
  const allQueryParams = [];
  let detectedHost = '';

  for (const req of reqs) {
    if (req.url && !detectedHost) {
      try { detectedHost = new URL(req.url).hostname; } catch (_) {}
    }

    for (const h of req.headers || []) {
      if (h.name && h.name.trim() && !allHeaders.some(ex => ex.name.toLowerCase() === h.name.trim().toLowerCase() && ex.value === h.value)) {
        allHeaders.push({
          id: crypto.randomUUID(),
          name: h.name.trim(),
          value: h.value ?? '',
          operation: 'set',
          type: 'request',
          enabled: h.disabled !== true,
        });
      }
    }

    if (req.authentication) {
      const auth = req.authentication;
      if (auth.type === 'bearer' && auth.token && !allHeaders.some(h => h.name.toLowerCase() === 'authorization')) {
        allHeaders.push({
          id: crypto.randomUUID(),
          name: 'Authorization',
          value: `Bearer ${auth.token}`,
          operation: 'set',
          type: 'request',
          enabled: auth.disabled !== true,
        });
      } else if (auth.type === 'basic' && (auth.username || auth.password) && !allHeaders.some(h => h.name.toLowerCase() === 'authorization')) {
        try {
          const basic = btoa(`${auth.username || ''}:${auth.password || ''}`);
          allHeaders.push({
            id: crypto.randomUUID(),
            name: 'Authorization',
            value: `Basic ${basic}`,
            operation: 'set',
            type: 'request',
            enabled: auth.disabled !== true,
          });
        } catch (_) {}
      } else if (auth.type === 'apikey' && auth.key && auth.value) {
        allHeaders.push({
          id: crypto.randomUUID(),
          name: auth.key,
          value: auth.value,
          operation: 'set',
          type: 'request',
          enabled: auth.disabled !== true,
        });
      }
    }

    if (Array.isArray(req.parameters)) {
      const addParams = req.parameters
        .filter(p => p.name && p.name.trim())
        .map(p => ({ key: p.name.trim(), value: p.value ?? '' }));
      if (addParams.length > 0) {
        allQueryParams.push({
          id: crypto.randomUUID(),
          enabled: true,
          urlFilter: req.url || '',
          useRegex: false,
          addOrReplace: addParams,
          remove: [],
        });
      }
    }
  }

  saveStorage();
  return [{
    id: crypto.randomUUID(),
    name: 'Insomnia: ' + (workspace?.name || 'Workspace'),
    enabled: false,
    urlFilter: detectedHost ? `*${detectedHost}*` : '',
    useRegex: false,
    headers: allHeaders,
    redirects: [],
    queryParams: allQueryParams,
    mocks: [],
    customVars,
  }];
}

// ── Bruno Collection & .bru Parser ──
function parseBruno(text, json) {
  // If JSON format
  if (json && (json.version === '1' || json.bruno || Array.isArray(json.requests) || (json.name && json.type === 'collection'))) {
    const headers = [];
    const queryParams = [];
    const customVars = [];
    let host = '';

    const reqList = json.requests || (json.items || []).map(i => i.request).filter(Boolean);
    for (const req of reqList) {
      if (req.url && !host) {
        try { host = new URL(req.url).hostname; } catch (_) {}
      }
      for (const h of req.headers || []) {
        if (h.name && !headers.some(ex => ex.name.toLowerCase() === h.name.toLowerCase())) {
          headers.push({ id: crypto.randomUUID(), name: h.name, value: h.value ?? '', operation: 'set', type: 'request', enabled: h.enabled !== false });
        }
      }
    }

    return [{
      id: crypto.randomUUID(),
      name: 'Bruno: ' + (json.name || 'Collection'),
      enabled: false,
      urlFilter: host ? `*${host}*` : '',
      useRegex: false,
      headers,
      redirects: [],
      queryParams,
      mocks: [],
      customVars,
    }];
  }

  // If .bru text format
  if (typeof text === 'string' && (text.includes('meta {') || text.includes('headers {') || text.includes('vars {') || text.includes('vars:pre-request {'))) {
    const nameMatch = text.match(/name:\s*(.+)/i);
    const name = nameMatch ? nameMatch[1].trim() : 'Bruno Request';

    let url = '';
    const httpMatch = text.match(/(get|post|put|delete|patch|options|head)\s*\{\s*url:\s*(.+?)\s*\}/i);
    if (httpMatch) {
      url = httpMatch[2].trim();
    }

    const headers = [];
    const headersBlock = text.match(/headers\s*\{([\s\S]*?)\}/i);
    if (headersBlock) {
      const lines = headersBlock[1].split('\n');
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const hName = line.slice(0, colonIdx).trim();
          const hVal = line.slice(colonIdx + 1).trim();
          if (hName && !hName.startsWith('~')) {
            headers.push({
              id: crypto.randomUUID(),
              name: hName,
              value: hVal,
              operation: 'set',
              type: 'request',
              enabled: true,
            });
          }
        }
      }
    }

    const customVars = [];
    const varsBlock = text.match(/vars(?::pre-request)?\s*\{([\s\S]*?)\}/i);
    if (varsBlock) {
      const lines = varsBlock[1].split('\n');
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const vKey = line.slice(0, colonIdx).trim();
          const vVal = line.slice(colonIdx + 1).trim();
          if (vKey) {
            customVars.push({ id: crypto.randomUUID(), key: vKey, value: vVal });
          }
        }
      }
    }

    let host = '';
    try { if (url) host = new URL(url).hostname; } catch (_) {}

    return [{
      id: crypto.randomUUID(),
      name: `Bruno: ${name}`,
      enabled: false,
      urlFilter: host ? `*${host}*` : (url ? `*${url}*` : ''),
      useRegex: false,
      headers,
      redirects: [],
      queryParams: [],
      mocks: [],
      customVars,
    }];
  }

  return null;
}

// ── OpenAPI 3.x & Swagger 2.0 Parser ──
function parseOpenApi(json, text = '') {
  let spec = json;
  if (!spec && typeof text === 'string') {
    if (text.includes('openapi:') || text.includes('swagger:')) {
      const pathsMatch = text.match(/paths:([\s\S]*)/i);
      if (pathsMatch) {
        spec = { openapi: '3.0.0', info: { title: 'OpenAPI Spec' }, paths: {} };
        const pathLines = pathsMatch[1].match(/^\s{2,4}(\/[^:\s]+):/gm);
        if (pathLines) {
          pathLines.forEach(pl => {
            const p = pl.trim().replace(':', '');
            spec.paths[p] = { get: { summary: p } };
          });
        }
      }
    }
  }

  if (!spec || typeof spec !== 'object') return null;
  const isOpenApi = (spec.openapi && spec.paths) || (spec.swagger && spec.paths);
  if (!isOpenApi) return null;

  let baseUrl = '';
  if (spec.servers && spec.servers[0]?.url) {
    baseUrl = spec.servers[0].url;
  } else if (spec.host) {
    const scheme = (spec.schemes && spec.schemes[0]) || 'https';
    baseUrl = `${scheme}://${spec.host}${spec.basePath || ''}`;
  }

  let host = '';
  try { if (baseUrl) host = new URL(baseUrl).hostname; } catch (_) {}

  const allHeaders = [];
  const allQueryParams = [];
  const allMocks = [];

  for (const [pathStr, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue;
    for (const [method, op] of Object.entries(pathItem)) {
      if (!op || typeof op !== 'object' || ['parameters', 'summary', 'description', '$ref'].includes(method)) continue;

      const pathUrlFilter = host ? `*${host}${pathStr.replace(/\{.+?\}/g, '*')}*` : `*${pathStr.replace(/\{.+?\}/g, '*')}*`;

      // Parameters
      const params = [...(pathItem.parameters || []), ...(op.parameters || [])];
      const qParams = [];
      for (const p of params) {
        if (!p || !p.name) continue;
        if (p.in === 'header' && !allHeaders.some(h => h.name.toLowerCase() === p.name.toLowerCase())) {
          allHeaders.push({
            id: crypto.randomUUID(),
            name: p.name,
            value: p.example || p.schema?.default || p.default || '',
            operation: 'set',
            type: 'request',
            enabled: true,
          });
        } else if (p.in === 'query') {
          qParams.push({ key: p.name, value: String(p.example || p.schema?.default || p.default || '') });
        }
      }
      if (qParams.length > 0) {
        allQueryParams.push({
          id: crypto.randomUUID(),
          enabled: true,
          urlFilter: pathUrlFilter,
          useRegex: false,
          addOrReplace: qParams,
          remove: [],
        });
      }

      // Mock Responses
      if (op.responses) {
        for (const [statusStr, resp] of Object.entries(op.responses)) {
          const status = parseInt(statusStr, 10);
          if (isNaN(status)) continue;
          let mockBody = '';
          if (resp.content && resp.content['application/json']) {
            const jsonContent = resp.content['application/json'];
            if (jsonContent.example) {
              mockBody = JSON.stringify(jsonContent.example, null, 2);
            } else if (jsonContent.examples) {
              const firstEx = Object.values(jsonContent.examples)[0]?.value;
              if (firstEx) mockBody = JSON.stringify(firstEx, null, 2);
            }
          } else if (resp.schema) {
            mockBody = JSON.stringify(resp.schema.example || { message: resp.description || 'Mock response' }, null, 2);
          }
          if (mockBody) {
            allMocks.push({
              id: crypto.randomUUID(),
              enabled: true,
              urlFilter: pathUrlFilter,
              useRegex: false,
              statusCode: status,
              responseBody: mockBody,
              contentType: 'application/json',
              delay: 0,
            });
            break;
          }
        }
      }
    }
  }

  return [{
    id: crypto.randomUUID(),
    name: 'OpenAPI: ' + (spec.info?.title || 'API Specification'),
    enabled: false,
    urlFilter: host ? `*${host}*` : '',
    useRegex: false,
    headers: allHeaders,
    redirects: [],
    queryParams: allQueryParams,
    mocks: allMocks,
    customVars: [],
  }];
}

// ── HAR (HTTP Archive) Parser ──
function parseHar(json) {
  if (!json || !json.log || !Array.isArray(json.log.entries)) return null;
  const entries = json.log.entries;
  if (!entries.length) return null;

  const headers = [];
  const queryParams = [];
  const mocks = [];
  let host = '';

  for (const entry of entries) {
    if (!entry.request) continue;
    const req = entry.request;
    if (!host && req.url) {
      try { host = new URL(req.url).hostname; } catch (_) {}
    }

    // Headers
    for (const h of req.headers || []) {
      if (h.name && !h.name.startsWith(':') && h.name.toLowerCase() !== 'cookie') {
        if (!headers.some(x => x.name.toLowerCase() === h.name.toLowerCase())) {
          headers.push({
            id: crypto.randomUUID(),
            name: h.name,
            value: h.value ?? '',
            operation: 'set',
            type: 'request',
            enabled: true,
          });
        }
      }
    }

    // Cookies -> Cookie Vault
    if (Array.isArray(req.cookies) && req.cookies.length > 0) {
      let reqHost = '';
      try { reqHost = new URL(req.url).hostname; } catch (_) {}
      if (reqHost) {
        for (const c of req.cookies) {
          if (c.name) {
            addCookieToVault(reqHost, {
              name: c.name,
              value: c.value ?? '',
              path: '/',
              enabled: true,
            });
          }
        }
      }
    }

    // Query params
    if (Array.isArray(req.queryString) && req.queryString.length > 0) {
      queryParams.push({
        id: crypto.randomUUID(),
        enabled: true,
        urlFilter: req.url,
        useRegex: false,
        addOrReplace: req.queryString.map(q => ({ key: q.name, value: q.value ?? '' })),
        remove: [],
      });
    }

    // Mocks from response
    if (entry.response && entry.response.status && entry.response.content?.text) {
      const mime = entry.response.content.mimeType || 'application/json';
      mocks.push({
        id: crypto.randomUUID(),
        enabled: true,
        urlFilter: req.url,
        useRegex: false,
        statusCode: entry.response.status,
        responseBody: entry.response.content.text,
        contentType: mime.includes('json') ? 'application/json' : 'text/plain',
        delay: 0,
      });
    }
  }

  saveStorage();
  return [{
    id: crypto.randomUUID(),
    name: 'HAR: ' + (host || 'Network Capture'),
    enabled: false,
    urlFilter: host ? `*${host}*` : '',
    useRegex: false,
    headers: headers.slice(0, 30),
    redirects: [],
    queryParams: queryParams.slice(0, 20),
    mocks: mocks.slice(0, 20),
    customVars: [],
  }];
}

// ── SoapUI & WSDL Project Parser ──
function parseSoapUi(text) {
  if (!text || typeof text !== 'string') return null;
  const isSoap = text.includes('<con:soapui-project') || text.includes('<wsdl:definitions') || text.includes('<soapenv:Envelope') || text.includes('<wsdl:service');
  if (!isSoap) return null;

  let endpoint = '';
  const epMatch = text.match(/<con:endpoint>(.*?)<\/con:endpoint>/i) ||
                  text.match(/soap:address\s+location=["'](.*?)["']/i) ||
                  text.match(/location=["'](https?:\/\/.*?)["']/i) ||
                  text.match(/targetNamespace=["'](https?:\/\/.*?)["']/i);
  if (epMatch) endpoint = epMatch[1].trim();

  const actions = [];
  const actionMatches = text.matchAll(/soapAction=["'](.*?)["']/gi);
  for (const m of actionMatches) {
    if (m[1] && !actions.includes(m[1])) actions.push(m[1]);
  }

  const headers = [
    {
      id: crypto.randomUUID(),
      name: 'Content-Type',
      value: 'text/xml; charset=utf-8',
      operation: 'set',
      type: 'request',
      enabled: true,
    }
  ];

  if (actions[0]) {
    headers.push({
      id: crypto.randomUUID(),
      name: 'SOAPAction',
      value: `"${actions[0]}"`,
      operation: 'set',
      type: 'request',
      enabled: true,
    });
  }

  let host = '';
  try { if (endpoint && endpoint.startsWith('http')) host = new URL(endpoint).hostname; } catch (_) {}

  return [{
    id: crypto.randomUUID(),
    name: 'SoapUI: ' + (host || 'SOAP Web Service'),
    enabled: false,
    urlFilter: host ? `*${host}*` : (endpoint ? `*${endpoint}*` : ''),
    useRegex: false,
    headers,
    redirects: [],
    queryParams: [],
    mocks: [],
    customVars: [],
  }];
}

async function parseUniversalPayload(rawInput) {
  if (!rawInput || typeof rawInput !== 'string') return null;
  const text = rawInput.trim();
  if (!text) return null;

  // 1. Stateless HeaderCraft Share Code (HC:... or URL with #import=)
  if (text.startsWith('HC:') || text.includes('#import=') || text.includes('import=')) {
    try {
      let token = text;
      if (token.startsWith('HC:')) token = token.slice(3);
      if (token.includes('#import=')) token = token.split('#import=')[1];
      else if (token.includes('import=')) token = token.split('import=')[1];
      const decompressed = await decompressProfile(decodeURIComponent(token.trim()));
      if (decompressed && typeof decompressed === 'object') {
        return [{
          ...decompressed,
          id: crypto.randomUUID(),
          name: (decompressed.name || 'Shared Profile') + ' (Imported)',
          enabled: false,
        }];
      }
    } catch (_) {}
  }

  // 2. SoapUI / WSDL XML Parser
  const soapRes = parseSoapUi(text);
  if (soapRes && soapRes.length > 0) return soapRes;

  // 3. Bruno .bru plaintext Parser
  const brunoBruRes = parseBruno(text, null);
  if (brunoBruRes && brunoBruRes.length > 0) return brunoBruRes;

  // 4. JSON Parser (Postman, Insomnia, OpenAPI, HAR, Bruno JSON, HeaderCraft, ModHeader/Requestly)
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const json = JSON.parse(text);

      // Try Insomnia
      const insomniaRes = parseInsomnia(json);
      if (insomniaRes && insomniaRes.length > 0) return insomniaRes;

      // Try OpenAPI / Swagger JSON
      const openApiRes = parseOpenApi(json, text);
      if (openApiRes && openApiRes.length > 0) return openApiRes;

      // Try HAR (HTTP Archive)
      const harRes = parseHar(json);
      if (harRes && harRes.length > 0) return harRes;

      // Try Bruno Collection JSON
      const brunoJsonRes = parseBruno(text, json);
      if (brunoJsonRes && brunoJsonRes.length > 0) return brunoJsonRes;

      // Try Postman Collection or Environment
      const postmanRes = parsePostman(json);
      if (postmanRes && postmanRes.length > 0) return postmanRes;

      // Try Native HeaderCraft
      const hcRes = parseHeaderCraft(json);
      if (hcRes && hcRes.length > 0) return hcRes;

      // Try ModHeader / Requestly
      const modRes = parseModHeader(json);
      if (modRes && modRes.length > 0) return modRes;
    } catch (_) {}
  }

  // 5. OpenAPI YAML fallback
  if (text.includes('openapi:') || text.includes('swagger:')) {
    const openApiYamlRes = parseOpenApi(null, text);
    if (openApiYamlRes && openApiYamlRes.length > 0) return openApiYamlRes;
  }

  // 6. cURL Command Parser
  const curlRes = parseCurlCommand(text);
  if (curlRes) return [curlRes];

  // 7. Raw URL with parameters or host
  if (text.startsWith('http://') || text.startsWith('https://') || text.includes('.')) {
    const urlCurl = parseCurlCommand(`curl "${text}"`);
    if (urlCurl) return [urlCurl];
  }

  return null;
}

function detectImportPayload(rawInput) {
  if (!rawInput || !rawInput.trim()) {
    return { valid: false, type: '', summary: '', details: '' };
  }
  const text = rawInput.trim();

  if (text.startsWith('HC:') || text.includes('#import=')) {
    return {
      valid: true,
      type: 'HeaderCraft Share Code',
      summary: 'Stateless profile link',
      details: 'Compressed profile code ready to import.',
    };
  }

  if (text.includes('<con:soapui-project') || text.includes('<wsdl:definitions') || text.includes('<soapenv:Envelope')) {
    return {
      valid: true,
      type: 'SoapUI / WSDL Project',
      summary: 'SOAP Web Service Specification',
      details: 'Extracts endpoints, SOAPAction headers, and XML payloads.',
    };
  }

  if (text.includes('meta {') && (text.includes('url:') || text.includes('headers {') || text.includes('type: http'))) {
    return {
      valid: true,
      type: 'Bruno (.bru) File',
      summary: 'Bruno HTTP Request',
      details: 'Extracts URL, method, headers, and pre-request variables.',
    };
  }

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const json = JSON.parse(text);

      if (json._type === 'export' || (Array.isArray(json.resources) && json.resources.some(r => r._type === 'request'))) {
        return {
          valid: true,
          type: 'Insomnia Export',
          summary: `${(json.resources || []).filter(r => r._type === 'request').length} Requests`,
          details: 'Imports headers, auth, environments, and Cookie Jars.',
        };
      }

      if ((json.openapi && json.paths) || (json.swagger && json.paths)) {
        return {
          valid: true,
          type: 'OpenAPI / Swagger Spec',
          summary: json.info?.title || 'OpenAPI 3.x / Swagger Spec',
          details: `${Object.keys(json.paths || {}).length} Endpoints • Headers & Mock Responses`,
        };
      }

      if (json.log && Array.isArray(json.log.entries)) {
        return {
          valid: true,
          type: 'HAR (HTTP Archive)',
          summary: `${json.log.entries.length} Network Entries`,
          details: 'Extracts requests, headers, query params, cookies, and mock responses.',
        };
      }

      if (json.bruno || json.version === '1' || (json.name && json.type === 'collection')) {
        return {
          valid: true,
          type: 'Bruno Collection',
          summary: json.name || 'Bruno Collection',
          details: 'Bruno collection requests and environment variables.',
        };
      }

      if (json.info && (json.item || json.info.schema)) {
        return {
          valid: true,
          type: 'Postman Collection',
          summary: json.info.name || 'Collection',
          details: `Collection with ${(json.item || []).length} items/folders.`,
        };
      }
      if (json.values && Array.isArray(json.values)) {
        return {
          valid: true,
          type: 'Postman Environment',
          summary: json.name || 'Environment',
          details: `${json.values.length} variables.`,
        };
      }
      if (json.name && Array.isArray(json.headers)) {
        return {
          valid: true,
          type: 'HeaderCraft Profile',
          summary: json.name,
          details: `${json.headers.length} headers • ${(json.queryParams || []).length} query params`,
        };
      }
      if (json.headers || json.respHeaders || json.rules) {
        return {
          valid: true,
          type: 'ModHeader / Requestly',
          summary: 'Rules File',
          details: 'Headers and rewrite rules.',
        };
      }
    } catch (_) {}
  }

  if (text.includes('openapi:') || text.includes('swagger:')) {
    return {
      valid: true,
      type: 'OpenAPI Spec (YAML)',
      summary: 'OpenAPI API Definition',
      details: 'Endpoints and mock responses from YAML spec.',
    };
  }

  if (text.toLowerCase().includes('curl') || text.includes('-H ') || text.includes('--header')) {
    const curl = parseCurlCommand(text);
    if (curl) {
      return {
        valid: true,
        type: 'cURL Command',
        summary: `${curl.headers.length} Headers • ${curl.queryParams.length} Query Params`,
        details: `Target: ${curl.urlFilter || 'Any'} (${curl.method || 'GET'})`,
      };
    }
  }

  if (text.startsWith('http://') || text.startsWith('https://')) {
    try {
      const u = new URL(text);
      return {
        valid: true,
        type: 'API URL',
        summary: u.hostname,
        details: `Path: ${u.pathname}`,
      };
    } catch (_) {}
  }

  return {
    valid: false,
    type: 'Unknown Format',
    summary: 'Paste cURL, Postman, Insomnia, Bruno, OpenAPI, HAR, or SoapUI',
    details: 'Could not detect supported structure yet.',
  };
}

// ── Import / Export Handlers ──────────────────────────────────────────────────

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

async function importProfilesIntoState(newProfiles) {
  if (!Array.isArray(newProfiles) || newProfiles.length === 0) {
    showToast('No valid profiles could be imported', 'error');
    return;
  }

  for (const raw of newProfiles) {
    profiles.push(migrateProfile(raw));
  }

  selectedProfileId = profiles.at(-1).id;
  await saveStorage();
  render();
  showToast(`Successfully imported ${newProfiles.length} profile${newProfiles.length > 1 ? 's' : ''}`, 'success');
}

async function handleUniversalFileInput(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const importedList = await parseUniversalPayload(text);
    if (!importedList || importedList.length === 0) {
      showToast('Unrecognized format in file', 'error');
      return;
    }
    await importProfilesIntoState(importedList);
    closeImportHubModal();
  } catch (err) {
    showToast('Failed to read or parse file', 'error');
    console.error(err);
  }
}

async function importProfile(e) {
  const file = e.target.files[0];
  if (file) await handleUniversalFileInput(file);
  e.target.value = '';
}

async function importFromModHeader(e) {
  const file = e.target.files[0];
  if (file) await handleUniversalFileInput(file);
  e.target.value = '';
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

// ── Import Hub Modal Controller ──────────────────────────────────────────────

function openImportHubModal() {
  if (!importHubModal) return;
  importHubModal.classList.remove('hidden');
  if (importHubTextarea) {
    importHubTextarea.value = '';
    updateImportPreview();
    setTimeout(() => importHubTextarea.focus(), 50);
  }
}

function closeImportHubModal() {
  if (importHubModal) importHubModal.classList.add('hidden');
}

function updateImportPreview() {
  if (!importHubTextarea || !importPreviewBox) return;
  const text = importHubTextarea.value;
  const detection = detectImportPayload(text);

  if (!text.trim() || !detection.valid) {
    importPreviewBox.classList.add('hidden');
    return;
  }

  importPreviewBox.classList.remove('hidden');
  if (importDetectedPill) importDetectedPill.textContent = `Detected: ${detection.type}`;
  if (importPreviewSummary) importPreviewSummary.textContent = detection.summary;
  if (importPreviewDetails) importPreviewDetails.textContent = detection.details;
}

// Attach Import Hub Modal event listeners
if (tabImportText && tabImportFile) {
  tabImportText.addEventListener('click', () => {
    tabImportText.classList.add('active');
    tabImportFile.classList.remove('active');
    importContentText.classList.remove('hidden');
    importContentFile.classList.add('hidden');
    importHubTextarea.focus();
  });
  tabImportFile.addEventListener('click', () => {
    tabImportFile.classList.add('active');
    tabImportText.classList.remove('active');
    importContentFile.classList.remove('hidden');
    importContentText.classList.add('hidden');
  });
}

if (importHubTextarea) {
  importHubTextarea.addEventListener('input', updateImportPreview);
  importHubTextarea.addEventListener('paste', () => setTimeout(updateImportPreview, 10));
}

if (btnImportPasteSample) {
  btnImportPasteSample.addEventListener('click', () => {
    importHubTextarea.value = `curl -X POST "https://api.staging.example.com/v1/users?role=admin&debug=true" \\\n  -H "Authorization: Bearer dev_secret_token_123" \\\n  -H "X-Client-Version: 2.5.0" \\\n  -H "Accept: application/json"`;
    updateImportPreview();
    showToast('Sample cURL loaded', 'info');
  });
}

if (btnImportClearText) {
  btnImportClearText.addEventListener('click', () => {
    importHubTextarea.value = '';
    updateImportPreview();
    importHubTextarea.focus();
  });
}

if (btnImportHubSubmit) {
  btnImportHubSubmit.addEventListener('click', async () => {
    const text = importHubTextarea.value.trim();
    if (!text) {
      showToast('Please paste a cURL command, Postman JSON, URL, or Share Code', 'error');
      return;
    }

    try {
      const importedList = await parseUniversalPayload(text);
      if (!importedList || importedList.length === 0) {
        showToast('Could not parse input. Please check the syntax.', 'error');
        return;
      }
      await importProfilesIntoState(importedList);
      closeImportHubModal();
    } catch (err) {
      showToast('Import error: ' + (err.message || 'Invalid format'), 'error');
      console.error(err);
    }
  });
}

if (btnCloseImportHub) btnCloseImportHub.addEventListener('click', closeImportHubModal);
if (importHubModal) {
  importHubModal.addEventListener('click', (e) => {
    if (e.target === importHubModal) closeImportHubModal();
  });
}

// Drag & Drop in File tab
if (importDropZone && importHubFileInput) {
  importDropZone.addEventListener('click', () => importHubFileInput.click());
  importDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    importDropZone.classList.add('dragover');
  });
  importDropZone.addEventListener('dragleave', () => importDropZone.classList.remove('dragover'));
  importDropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    importDropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) await handleUniversalFileInput(file);
  });
  importHubFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await handleUniversalFileInput(file);
    e.target.value = '';
  });
}

if (cardFormatPostman) cardFormatPostman.addEventListener('click', () => importHubFileInput?.click());
if (cardFormatInsomnia) cardFormatInsomnia.addEventListener('click', () => importHubFileInput?.click());
if (cardFormatBruno) cardFormatBruno.addEventListener('click', () => importHubFileInput?.click());
if (cardFormatOpenapi) cardFormatOpenapi.addEventListener('click', () => importHubFileInput?.click());
if (cardFormatHar) cardFormatHar.addEventListener('click', () => importHubFileInput?.click());
if (cardFormatSoapui) cardFormatSoapui.addEventListener('click', () => importHubFileInput?.click());
if (cardFormatHeadercraft) cardFormatHeadercraft.addEventListener('click', () => importHubFileInput?.click());
if (cardFormatModheader) cardFormatModheader.addEventListener('click', () => importHubFileInput?.click());

if (btnImportHub) btnImportHub.addEventListener('click', openImportHubModal);

// ── Event Listeners ───────────────────────────────────────────────────────────

btnAddProfile.addEventListener('click', () => addProfile());
btnShareProfile.addEventListener('click', openShareModal);
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
    if (ruleSearchInput) ruleSearchInput.value = '';
    if (ruleSearchClear) ruleSearchClear.classList.add('hidden');
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
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (enabled) {
    activeProfileId = selectedProfileId;
    if (profile) profile.enabled = true;
    if (profile?.autoDisableAt && profile.autoDisableAt > Date.now()) {
      startCountdownDisplay();
    }
  } else {
    resetHitCounters(); // clear hit counters when profile is turned off
    clearAutoDisableTimer();
    autoDisableCountdown?.classList.add('hidden');
    if (autoDisableSelect) autoDisableSelect.value = '0';
    if (profile) {
      profile.enabled = false;
      delete profile.autoDisableAt;
    }
  }
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

// ── Workspace & Folder Event Listeners ──
if (btnWorkspaceSwitcher) {
  btnWorkspaceSwitcher.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWorkspaceDropdown();
  });
}

if (btnCreateWorkspace) {
  btnCreateWorkspace.addEventListener('click', () => {
    closeWorkspaceDropdown();
    handleCreateWorkspace();
  });
}

if (btnRenameWorkspace) {
  btnRenameWorkspace.addEventListener('click', () => {
    closeWorkspaceDropdown();
    handleRenameWorkspace();
  });
}

if (btnDeleteWorkspace) {
  btnDeleteWorkspace.addEventListener('click', () => {
    closeWorkspaceDropdown();
    handleDeleteWorkspace();
  });
}

if (btnAddFolder) {
  btnAddFolder.addEventListener('click', () => {
    handleCreateFolder();
  });
}

if (btnProfileFolderSelect) {
  btnProfileFolderSelect.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFolderDropdown();
  });
}

// Dismiss workspace & folder dropdowns on outside click
document.addEventListener('click', (e) => {
  if (workspaceDropdown && !workspaceDropdown.classList.contains('hidden')) {
    if (!workspaceDropdown.contains(e.target) && !btnWorkspaceSwitcher?.contains(e.target)) {
      closeWorkspaceDropdown();
    }
  }
  if (profileFolderDropdown && !profileFolderDropdown.classList.contains('hidden')) {
    if (!profileFolderDropdown.contains(e.target) && !btnProfileFolderSelect?.contains(e.target)) {
      closeFolderDropdown();
    }
  }
});

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

// ── Custom Dynamic Variables ─────────────────────────────────────────────────

const saveStorageDebounced = debounce(() => saveStorage(), 300);

function openVarsModal() {
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (!profile) return;
  if (varsModalProfileBadge) {
    varsModalProfileBadge.textContent = profile.name || 'Profile';
  }
  renderCustomVars(profile);
  if (varsModal) varsModal.classList.remove('hidden');
}

function closeVarsModal() {
  if (varsModal) varsModal.classList.add('hidden');
}

function renderCustomVars(profile) {
  if (!profile) return;
  if (!profile.customVars) profile.customVars = [];

  // Update badge count
  if (profileVarsCount) {
    profileVarsCount.textContent = String(profile.customVars.length);
  }

  // Render variables modal list
  if (varsModalList) {
    varsModalList.innerHTML = '';
    for (const v of profile.customVars) {
      varsModalList.appendChild(buildCustomVarRow(profile, v, false));
    }
  }
  if (varsModalEmptyHint) {
    varsModalEmptyHint.classList.toggle('hidden', profile.customVars.length > 0);
  }

  // Render help modal list
  if (customVarsList) {
    customVarsList.innerHTML = '';
    for (const v of profile.customVars) {
      customVarsList.appendChild(buildCustomVarRow(profile, v, true));
    }
  }
  if (customVarsHint) {
    customVarsHint.classList.toggle('hidden', profile.customVars.length > 0);
  }
}

function buildCustomVarRow(profile, v, isHelpModal = false) {
  const row = document.createElement('div');
  row.className = 'custom-var-row';
  row.dataset.varId = v.id;

  const keyWrap = document.createElement('div');
  keyWrap.className = 'custom-var-key-wrap';

  const braceL = document.createElement('span');
  braceL.className = 'var-brace';
  braceL.textContent = '{{';

  const keyInput = document.createElement('input');
  keyInput.type = 'text';
  keyInput.className = 'custom-var-key mono';
  keyInput.placeholder = 'var_name';
  keyInput.value = v.key ?? '';
  keyInput.spellcheck = false;

  const braceR = document.createElement('span');
  braceR.className = 'var-brace';
  braceR.textContent = '}}';

  keyWrap.append(braceL, keyInput, braceR);

  const valInput = document.createElement('input');
  valInput.type = 'text';
  valInput.className = 'custom-var-val mono';
  valInput.placeholder = 'value';
  valInput.value = v.value ?? '';
  valInput.spellcheck = false;

  const copyBtn = document.createElement('button');
  copyBtn.className = 'var-action-btn var-copy-btn has-tooltip';
  copyBtn.setAttribute('data-tooltip', `Copy {{${v.key || 'var'}}}`);
  copyBtn.setAttribute('aria-label', 'Copy variable');
  copyBtn.innerHTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="12" height="12">
      <rect x="5" y="5" width="8" height="8" rx="1.5"/>
      <path d="M3 11V3h8" stroke-linecap="round"/>
    </svg>`;

  const delBtn = document.createElement('button');
  delBtn.className = 'var-action-btn var-del-btn has-tooltip';
  delBtn.setAttribute('data-tooltip', 'Delete variable');
  delBtn.setAttribute('aria-label', 'Delete variable');
  delBtn.innerHTML = `
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" width="12" height="12">
      <path d="M3 4h10M6 4V2h4v2M5 7v5M8 7v5M11 7v5M4 4l.8 9.2A1.5 1.5 0 006.3 14h3.4a1.5 1.5 0 001.5-1.3L12 4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  // Real-time synchronization & debounced save
  keyInput.addEventListener('input', () => {
    v.key = keyInput.value.replace(/[{}$]/g, '').trim();
    copyBtn.setAttribute('data-tooltip', `Copy {{${v.key || 'var'}}}`);
    syncVarInput(v.id, '.custom-var-key', keyInput.value);
    saveStorageDebounced();
  });

  valInput.addEventListener('input', () => {
    v.value = valInput.value;
    syncVarInput(v.id, '.custom-var-val', valInput.value);
    saveStorageDebounced();
  });

  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const token = `{{${v.key || 'var'}}}`;
    navigator.clipboard.writeText(token).then(() => {
      copyBtn.classList.add('copied');
      showToast(`Copied ${token}`, 'success');
      setTimeout(() => copyBtn.classList.remove('copied'), 1500);
    });
  });

  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    profile.customVars = (profile.customVars || []).filter(item => item.id !== v.id);
    await saveStorage();
    renderCustomVars(profile);
    showToast('Variable deleted', 'info');
  });

  row.append(keyWrap, valInput, copyBtn, delBtn);
  return row;
}

function syncVarInput(varId, selector, newVal) {
  const allMatching = document.querySelectorAll(`.custom-var-row[data-var-id="${varId}"] ${selector}`);
  allMatching.forEach(el => {
    if (el !== document.activeElement && el.value !== newVal) {
      el.value = newVal;
    }
  });
}

async function addCustomVar(profile) {
  if (!profile) return;
  if (!profile.customVars) profile.customVars = [];
  const newVar = {
    id: crypto.randomUUID(),
    key: '',
    value: '',
  };
  profile.customVars.push(newVar);
  await saveStorage();
  renderCustomVars(profile);

  // Focus key input
  setTimeout(() => {
    const activeList = (varsModal && !varsModal.classList.contains('hidden'))
      ? varsModalList
      : customVarsList;
    const input = activeList?.querySelector(`[data-var-id="${newVar.id}"] .custom-var-key`);
    if (input) input.focus();
  }, 50);
}

if (btnToggleProfileVars) {
  btnToggleProfileVars.addEventListener('click', openVarsModal);
}

if (btnCloseVarsModal) {
  btnCloseVarsModal.addEventListener('click', closeVarsModal);
}

if (btnVarsModalDone) {
  btnVarsModalDone.addEventListener('click', closeVarsModal);
}

if (btnModalAddVar) {
  btnModalAddVar.addEventListener('click', () => {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (profile) addCustomVar(profile);
  });
}

if (btnAddCustomVar) {
  btnAddCustomVar.addEventListener('click', () => {
    const profile = profiles.find(p => p.id === selectedProfileId);
    if (profile) addCustomVar(profile);
  });
}

if (varsModal) {
  // Close on backdrop click
  varsModal.addEventListener('click', (e) => {
    if (e.target === varsModal) closeVarsModal();
  });

  // Click-to-Copy tokens inside vars modal
  varsModal.addEventListener('click', (e) => {
    const copyTarget = e.target.closest('[data-copy]');
    if (!copyTarget || copyTarget.closest('.var-copy-btn')) return;
    const text = copyTarget.dataset.copy;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied ${text}`, 'success');
    });
  });
}

// ── Cookie Vault Controller (Per-Domain Session Cookie Store) ─────────────────

function openCookieVaultModal() {
  if (!cookieVaultModal) return;

  // If cookieVault is empty, seed with current profile host or default
  if (!cookieVault.length) {
    const profile = profiles.find(p => p.id === selectedProfileId);
    let initialDomain = 'api.example.com';
    if (profile?.urlFilter && !profile.urlFilter.includes('*') && !profile.useRegex) {
      initialDomain = profile.urlFilter;
    }
    cookieVault.push({
      id: crypto.randomUUID(),
      domain: initialDomain,
      enabled: true,
      cookies: [
        {
          id: crypto.randomUUID(),
          name: 'session_id',
          value: 'sk_test_' + Math.random().toString(36).substring(2, 10),
          path: '/',
          enabled: true,
          secure: true,
          httpOnly: false,
        }
      ],
    });
    saveStorage();
  }

  selectedCookieDomainId = selectedCookieDomainId || cookieVault[0]?.id;
  cookieVaultModal.classList.remove('hidden');
  renderCookieVault();
}

function closeCookieVaultModal() {
  if (cookieVaultModal) cookieVaultModal.classList.add('hidden');
  const profile = profiles.find(p => p.id === selectedProfileId);
  if (profile) renderMainPanel();
}

function renderCookieVault() {
  if (!cookieDomainSelect) return;
  cookieDomainSelect.innerHTML = '';

  for (const store of cookieVault) {
    const opt = document.createElement('option');
    opt.value = store.id;
    opt.textContent = `🌐 ${store.domain} (${(store.cookies || []).length})`;
    if (store.id === selectedCookieDomainId) opt.selected = true;
    cookieDomainSelect.appendChild(opt);
  }

  const activeStore = cookieVault.find(s => s.id === selectedCookieDomainId) || cookieVault[0];
  if (!activeStore) {
    if (cookieRowsContainer) cookieRowsContainer.innerHTML = '';
    if (cookieEmptyHint) cookieEmptyHint.classList.remove('hidden');
    if (cookieCountLabel) cookieCountLabel.textContent = 'No domains in Cookie Vault';
    return;
  }

  selectedCookieDomainId = activeStore.id;

  if (cookieDomainEnabled) {
    cookieDomainEnabled.checked = activeStore.enabled !== false;
  }

  const cookies = activeStore.cookies || [];
  if (cookieCountLabel) {
    cookieCountLabel.textContent = `${cookies.length} cookie${cookies.length !== 1 ? 's' : ''} stored for ${activeStore.domain}`;
  }

  if (cookieRowsContainer) {
    cookieRowsContainer.innerHTML = '';
    for (const c of cookies) {
      cookieRowsContainer.appendChild(buildCookieRow(activeStore, c));
    }
  }

  if (cookieEmptyHint) {
    cookieEmptyHint.classList.toggle('hidden', cookies.length > 0);
  }
}

function buildCookieRow(store, c) {
  const row = document.createElement('div');
  row.className = 'cookie-row';
  row.dataset.cookieId = c.id;

  // 1. Enabled checkbox
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.checked = c.enabled !== false;
  check.title = 'Enable / disable this cookie';
  check.addEventListener('change', () => {
    c.enabled = check.checked;
    saveStorage();
  });

  // 2. Name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'cookie_name';
  nameInput.value = c.name ?? '';
  nameInput.spellcheck = false;
  nameInput.addEventListener('input', () => {
    c.name = nameInput.value.trim();
    saveStorage();
  });

  // 3. Value input with toggle visibility & copy
  const valWrap = document.createElement('div');
  valWrap.className = 'cookie-val-wrap';

  const valInput = document.createElement('input');
  valInput.type = 'password';
  valInput.placeholder = 'cookie_value';
  valInput.value = c.value ?? '';
  valInput.spellcheck = false;
  valInput.addEventListener('input', () => {
    c.value = valInput.value;
    saveStorage();
  });

  const toggleVisBtn = document.createElement('button');
  toggleVisBtn.type = 'button';
  toggleVisBtn.className = 'cookie-toggle-vis';
  const eyeOpenSvg = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/></svg>';
  const eyeClosedSvg = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z"/><path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/><path d="M3.35 5.47q-.27.24-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z"/></svg>';
  toggleVisBtn.innerHTML = eyeOpenSvg;
  toggleVisBtn.title = 'Toggle show/hide value';
  toggleVisBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isPwd = valInput.type === 'password';
    valInput.type = isPwd ? 'text' : 'password';
    toggleVisBtn.innerHTML = isPwd ? eyeClosedSvg : eyeOpenSvg;
  });

  valWrap.append(valInput, toggleVisBtn);

  // 4. Path input
  const pathInput = document.createElement('input');
  pathInput.type = 'text';
  pathInput.placeholder = '/';
  pathInput.value = c.path || '/';
  pathInput.spellcheck = false;
  pathInput.addEventListener('input', () => {
    c.path = pathInput.value.trim() || '/';
    saveStorage();
  });

  // 5. Actions (Copy & Delete)
  const actions = document.createElement('div');
  actions.className = 'cookie-row-actions';

  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'cookie-btn-icon';
  copyBtn.innerHTML = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>';
  copyBtn.title = 'Copy value';
  copyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(c.value ?? '').then(() => {
      showToast(`Copied cookie ${c.name}`, 'success');
    });
  });

  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'cookie-btn-icon danger';
  delBtn.innerHTML = '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>';
  delBtn.title = 'Delete cookie';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    store.cookies = store.cookies.filter(x => x.id !== c.id);
    await saveStorage();
    renderCookieVault();
    showToast('Cookie deleted', 'info');
  });

  actions.append(copyBtn, delBtn);
  row.append(check, nameInput, valWrap, pathInput, actions);
  return row;
}

async function handleAddCookieDomain() {
  const domain = await openPromptDialog({
    title: 'New Domain Store',
    desc: 'Enter domain (e.g. api.example.com, localhost:3000):',
    placeholder: 'api.example.com',
    confirmText: 'Add Domain',
  });
  if (!domain) return;

  const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^\*?\./, '');
  if (!cleanDomain) return;

  const existing = cookieVault.find(s => s.domain === cleanDomain);
  if (existing) {
    selectedCookieDomainId = existing.id;
    renderCookieVault();
    showToast(`Domain ${cleanDomain} already exists`, 'info');
    return;
  }

  const newStore = {
    id: crypto.randomUUID(),
    domain: cleanDomain,
    enabled: true,
    cookies: [],
  };

  cookieVault.push(newStore);
  selectedCookieDomainId = newStore.id;
  await saveStorage();
  renderCookieVault();
  showToast(`Added domain store: "${cleanDomain}"`, 'success');
}

async function handleDeleteCookieDomain() {
  const activeStore = cookieVault.find(s => s.id === selectedCookieDomainId);
  if (!activeStore) return;

  cookieVault = cookieVault.filter(s => s.id !== activeStore.id);
  selectedCookieDomainId = cookieVault[0]?.id || null;
  await saveStorage();
  renderCookieVault();
  showToast(`Deleted domain store: "${activeStore.domain}"`, 'info');
}

async function handleAddCookieRow() {
  const activeStore = cookieVault.find(s => s.id === selectedCookieDomainId);
  if (!activeStore) return;

  const newCookie = {
    id: crypto.randomUUID(),
    name: '',
    value: '',
    path: '/',
    enabled: true,
    secure: false,
    httpOnly: false,
  };

  activeStore.cookies = activeStore.cookies || [];
  activeStore.cookies.push(newCookie);
  await saveStorage();
  renderCookieVault();

  setTimeout(() => {
    const input = cookieRowsContainer?.querySelector(`[data-cookie-id="${newCookie.id}"] input[placeholder="cookie_name"]`);
    if (input) input.focus();
  }, 50);
}

function handleToggleCookieStringBox() {
  if (!cookieStringImporter) return;
  const isHidden = cookieStringImporter.classList.toggle('hidden');
  if (!isHidden && cookieStringInput) {
    cookieStringInput.value = '';
    cookieStringInput.focus();
  }
}

async function handleSubmitCookieString() {
  const activeStore = cookieVault.find(s => s.id === selectedCookieDomainId);
  if (!activeStore || !cookieStringInput) return;

  let raw = cookieStringInput.value.trim();
  if (!raw) return;

  raw = raw.replace(/^Cookie:\s*/i, '').replace(/^(?:curl\s+.*?)?(?:--cookie|-b)\s+['"]?/i, '').replace(/['"]$/, '');
  const pairs = raw.split(';');
  let added = 0;

  activeStore.cookies = activeStore.cookies || [];
  for (const pair of pairs) {
    const p = pair.trim();
    if (!p) continue;
    const eqIdx = p.indexOf('=');
    if (eqIdx > 0) {
      const k = p.slice(0, eqIdx).trim();
      const v = p.slice(eqIdx + 1).trim();
      if (k) {
        const existing = activeStore.cookies.find(x => x.name === k);
        if (existing) {
          existing.value = v;
        } else {
          activeStore.cookies.push({
            id: crypto.randomUUID(),
            name: k,
            value: v,
            path: '/',
            enabled: true,
            secure: false,
            httpOnly: false,
          });
        }
        added++;
      }
    }
  }

  cookieStringInput.value = '';
  if (cookieStringImporter) cookieStringImporter.classList.add('hidden');
  await saveStorage();
  renderCookieVault();
  showToast(`Parsed and added ${added} cookies`, 'success');
}

async function handleFetchTabCookies() {
  const activeStore = cookieVault.find(s => s.id === selectedCookieDomainId);
  if (!activeStore) return;

  try {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });

    let domainToSearch = activeStore.domain;
    if (tab?.url) {
      try {
        const tabUrl = new URL(tab.url);
        if (!domainToSearch || domainToSearch === 'api.example.com') {
          domainToSearch = tabUrl.hostname;
          activeStore.domain = domainToSearch;
        }
      } catch (_) {}
    }

    let cookies = [];
    if (chrome.cookies) {
      cookies = await chrome.cookies.getAll({ domain: domainToSearch });
      if (!cookies.length && tab?.url) {
        cookies = await chrome.cookies.getAll({ url: tab.url });
      }
    }

    if (!cookies || cookies.length === 0) {
      showToast(`No live cookies found for ${domainToSearch}`, 'info');
      return;
    }

    activeStore.cookies = activeStore.cookies || [];
    for (const c of cookies) {
      const existing = activeStore.cookies.find(x => x.name === c.name);
      if (existing) {
        existing.value = c.value;
        existing.path = c.path || '/';
      } else {
        activeStore.cookies.push({
          id: crypto.randomUUID(),
          name: c.name,
          value: c.value,
          path: c.path || '/',
          enabled: true,
          secure: !!c.secure,
          httpOnly: !!c.httpOnly,
        });
      }
    }

    await saveStorage();
    renderCookieVault();
    showToast(`Imported ${cookies.length} live cookies from ${domainToSearch}`, 'success');
  } catch (err) {
    showToast('Failed to fetch cookies from browser', 'error');
    console.error(err);
  }
}

async function handleSyncBrowserCookies() {
  const activeStore = cookieVault.find(s => s.id === selectedCookieDomainId);
  if (!activeStore) return;

  if (!chrome.cookies) {
    showToast('Chrome cookies API unavailable', 'error');
    return;
  }

  try {
    let count = 0;
    const protocol = activeStore.domain.includes('localhost') ? 'http' : 'https';
    const cleanDom = activeStore.domain.replace(/^\*?\./, '');

    for (const c of activeStore.cookies || []) {
      if (c.enabled === false || !c.name) continue;
      const url = `${protocol}://${cleanDom}${c.path || '/'}`;
      await chrome.cookies.set({
        url,
        name: c.name,
        value: c.value ?? '',
        path: c.path || '/',
      });
      count++;
    }

    showToast(`Synced ${count} cookies into Chrome for ${activeStore.domain}`, 'success');
  } catch (err) {
    showToast('Failed to sync cookies to browser', 'error');
    console.error(err);
  }
}

function handleCopyCookieHeader() {
  const activeStore = cookieVault.find(s => s.id === selectedCookieDomainId);
  if (!activeStore) return;

  const valid = (activeStore.cookies || []).filter(c => c.enabled !== false && c.name);
  if (!valid.length) {
    showToast('No active cookies to copy', 'info');
    return;
  }

  const str = `Cookie: ${valid.map(c => `${c.name}=${c.value ?? ''}`).join('; ')}`;
  navigator.clipboard.writeText(str).then(() => {
    showToast('Copied "Cookie: ..." header to clipboard', 'success');
  });
}

// ── Cookie Vault Event Listeners ──
if (btnCookieVault) btnCookieVault.addEventListener('click', openCookieVaultModal);
if (btnProfileCookieVault) btnProfileCookieVault.addEventListener('click', openCookieVaultModal);
if (btnCloseCookieVault) btnCloseCookieVault.addEventListener('click', closeCookieVaultModal);
if (btnCookieVaultDone) btnCookieVaultDone.addEventListener('click', closeCookieVaultModal);

if (cookieDomainSelect) {
  cookieDomainSelect.addEventListener('change', () => {
    selectedCookieDomainId = cookieDomainSelect.value;
    renderCookieVault();
  });
}

if (cookieDomainEnabled) {
  cookieDomainEnabled.addEventListener('change', async () => {
    const activeStore = cookieVault.find(s => s.id === selectedCookieDomainId);
    if (activeStore) {
      activeStore.enabled = cookieDomainEnabled.checked;
      await saveStorage();
      showToast(`Cookie auto-injection for ${activeStore.domain} ${activeStore.enabled ? 'enabled' : 'disabled'}`, 'info');
    }
  });
}

if (btnAddCookieDomain) btnAddCookieDomain.addEventListener('click', handleAddCookieDomain);
if (btnDelCookieDomain) btnDelCookieDomain.addEventListener('click', handleDeleteCookieDomain);
if (btnFetchTabCookies) btnFetchTabCookies.addEventListener('click', handleFetchTabCookies);
if (btnSyncBrowserCookies) btnSyncBrowserCookies.addEventListener('click', handleSyncBrowserCookies);
if (btnCopyCookieHeader) btnCopyCookieHeader.addEventListener('click', handleCopyCookieHeader);
if (btnToggleCookieStringBox) btnToggleCookieStringBox.addEventListener('click', handleToggleCookieStringBox);
if (btnSubmitCookieString) btnSubmitCookieString.addEventListener('click', handleSubmitCookieString);
if (btnCancelCookieString) btnCancelCookieString.addEventListener('click', handleToggleCookieStringBox);
if (btnAddCookieRow) btnAddCookieRow.addEventListener('click', handleAddCookieRow);

if (cookieVaultModal) {
  cookieVaultModal.addEventListener('click', (e) => {
    if (e.target === cookieVaultModal) closeCookieVaultModal();
  });
}

// ── Expand to Full Tab ───────────────────────────────────────────────────────

/** Detect if we are already running in a full browser tab (not a popup). */
function isFullTabMode() {
  const hasParam = new URLSearchParams(window.location.search).has('fullTab');
  const isPopup = window.innerWidth <= 600 && window.innerHeight <= 620;
  return hasParam || (!isPopup && window.innerWidth > 600);
}

function initFullTabMode() {
  if (isFullTabMode()) {
    document.documentElement.classList.add('full-tab-mode');
    document.body.classList.add('full-tab-mode');
    if (btnExpandTab) btnExpandTab.style.display = 'none';
  }
}

if (btnExpandTab) {
  btnExpandTab.addEventListener('click', () => {
    const url = chrome.runtime.getURL('popup/popup.html') + '?fullTab=1';
    chrome.tabs.create({ url });
    window.close();
  });
}

// ── Help & Syntax Reference Modal ────────────────────────────────────────────

function openHelpModal() {
  if (helpModal) helpModal.classList.remove('hidden');
}

function closeHelpModal() {
  if (helpModal) helpModal.classList.add('hidden');
}

if (btnHelp) {
  btnHelp.addEventListener('click', openHelpModal);
}

if (btnCloseHelp) {
  btnCloseHelp.addEventListener('click', closeHelpModal);
}

if (helpModal) {
  // Close on backdrop click
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) closeHelpModal();
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (varsModal && !varsModal.classList.contains('hidden')) closeVarsModal();
      if (helpModal && !helpModal.classList.contains('hidden')) closeHelpModal();
      if (cookieVaultModal && !cookieVaultModal.classList.contains('hidden')) closeCookieVaultModal();
    }
  });

  // Click-to-Copy buttons inside help modal
  helpModal.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.help-copy-btn');
    if (!copyBtn) return;
    const text = copyBtn.dataset.copy;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
        copyBtn.classList.remove('copied');
      }, 1500);
    });
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async () => {
  initFullTabMode();
  initRuleSearch();
  await loadStorage();
  selectedProfileId = activeProfileId ?? profiles[0]?.id ?? null;
  render();
  // Resume any active countdown timers
  startCountdownDisplay();
})();
