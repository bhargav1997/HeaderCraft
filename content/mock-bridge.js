/**
 * mock-bridge.js — Isolated World Content Script (v1.3.0)
 *
 * Reads active mock rules from chrome.storage.local and forwards
 * them to the MAIN world via a CustomEvent so mock-interceptor.js
 * can intercept fetch / XMLHttpRequest calls without a server.
 *
 * v1.3.0 additions:
 *  - Environment Badge: injects a colored top-bar indicator + label
 *    on pages where a HeaderCraft profile is active, so QA engineers
 *    always know which environment they are intercepting.
 */

'use strict';

let currentTabId = null;
let badgeDismissed = false;

async function getTabId() {
  if (currentTabId !== null) return currentTabId;
  try {
    const res = await chrome.runtime.sendMessage({ type: 'GET_TAB_ID' });
    currentTabId = res?.tabId ?? null;
  } catch (_) {
    currentTabId = null;
  }
  return currentTabId;
}

// ── Environment Badge & Target Detection ─────────────────────────────────────

const PROFILE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#f97316', '#06b6d4',
];

function getProfileColor(profileId) {
  let hash = 0;
  for (let i = 0; i < (profileId || '').length; i++) hash = (hash * 31 + profileId.charCodeAt(i)) >>> 0;
  return PROFILE_COLORS[hash % PROFILE_COLORS.length];
}

function urlMatchesPattern(currentUrl, pattern, isRegex = false) {
  if (!pattern || typeof pattern !== 'string') return false;
  const p = pattern.trim();
  if (!p) return false;
  try {
    if (isRegex) {
      return new RegExp(p, 'i').test(currentUrl);
    }
    if (p.includes('*')) {
      const regexStr = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      return new RegExp(regexStr, 'i').test(currentUrl);
    }
    return currentUrl.toLowerCase().includes(p.toLowerCase());
  } catch (_) {
    return false;
  }
}

function isPageTargetForProfile(profile) {
  if (!profile) return false;
  const currentUrl = window.location.href;
  const currentHost = window.location.hostname;

  // 1. Check profile-level URL Filter
  if (profile.urlFilter && profile.urlFilter.trim()) {
    if (urlMatchesPattern(currentUrl, profile.urlFilter, profile.useRegex)) {
      return true;
    }
  }

  // 2. Check rule-level URL filters (Redirects, Params, Mocks)
  if (Array.isArray(profile.redirects)) {
    for (const r of profile.redirects) {
      if (r.enabled && r.from && urlMatchesPattern(currentUrl, r.from, r.useRegex)) {
        return true;
      }
    }
  }

  if (Array.isArray(profile.queryParams)) {
    for (const q of profile.queryParams) {
      const filter = q.urlFilter?.trim() || profile.urlFilter?.trim();
      if (q.enabled && filter && urlMatchesPattern(currentUrl, filter, q.useRegex)) {
        return true;
      }
    }
  }

  if (Array.isArray(profile.mocks)) {
    for (const m of profile.mocks) {
      if (m.enabled && m.urlFilter && m.urlFilter.trim()) {
        const filter = m.urlFilter.trim();
        if (urlMatchesPattern(currentUrl, filter, m.useRegex)) {
          return true;
        }
        if (filter.startsWith('/') && window.location.pathname.startsWith(filter)) {
          return true;
        }
      }
    }
  }

  // 3. If profile has no explicit URL filter, target local development / test hosts
  const isDevHost = currentHost === 'localhost' ||
    currentHost === '127.0.0.1' ||
    currentHost === '0.0.0.0' ||
    currentHost.endsWith('.local') ||
    currentHost.endsWith('.test') ||
    currentHost.endsWith('.internal');

  if (isDevHost && (!profile.urlFilter || !profile.urlFilter.trim())) {
    return true;
  }

  return false;
}

function injectEnvBadge(profileName, profileId) {
  removeEnvBadge(); // remove any existing badge first

  const color = getProfileColor(profileId);

  const bar = document.createElement('div');
  bar.id = 'hc-env-badge';
  bar.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:2147483647;
    height:3px;pointer-events:none;border:none;margin:0;padding:0;
    background:linear-gradient(90deg,${color} 0%,transparent 100%);
  `;

  const label = document.createElement('div');
  label.id = 'hc-env-badge-label';
  label.title = 'HeaderCraft Dev active environment (click to dismiss)';
  label.style.cssText = `
    position:fixed;top:6px;right:10px;z-index:2147483647;
    font-family:'Inter',system-ui,sans-serif;font-size:10px;font-weight:600;
    letter-spacing:.04em;color:#fff;background:${color};border-radius:4px;
    padding:2px 8px;cursor:pointer;pointer-events:auto;box-shadow:0 2px 8px rgba(0,0,0,.4);
    opacity:.9;white-space:nowrap;max-width:220px;overflow:hidden;text-overflow:ellipsis;
    transition:opacity 0.2s, transform 0.2s;user-select:none;
  `;
  label.textContent = `HeaderCraft Dev: ${profileName} ✕`;
  label.addEventListener('click', () => {
    badgeDismissed = true;
    removeEnvBadge();
  });

  document.documentElement.appendChild(bar);
  document.documentElement.appendChild(label);
}

function removeEnvBadge() {
  document.getElementById('hc-env-badge')?.remove();
  document.getElementById('hc-env-badge-label')?.remove();
}

function resolveDynamicVars(value, customVars = []) {
  if (!value || typeof value !== 'string' || !value.includes('{{')) return value;
  let resolved = value;

  if (resolved.includes('{{$')) {
    resolved = resolved
      .replace(/\{\{\$uuid\}\}/gi,      () => crypto.randomUUID())
      .replace(/\{\{\$timestamp\}\}/gi, () => String(Date.now()))
      .replace(/\{\{\$isodate\}\}/gi,   () => new Date().toISOString())
      .replace(/\{\{\$date\}\}/gi,      () => new Date().toISOString().slice(0, 10))
      .replace(/\{\{\$randomInt\}\}/gi, () => String(Math.floor(Math.random() * 90000) + 10000));
  }

  if (Array.isArray(customVars)) {
    for (const cv of customVars) {
      if (cv && cv.key && cv.key.trim()) {
        const cleanKey = cv.key.replace(/^\{\{|\}\}$/g, '').trim();
        if (cleanKey) {
          const escaped = cleanKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`\\{\\{\\s*\\$?${escaped}\\s*\\}\\}`, 'gi');
          resolved = resolved.replace(regex, cv.value ?? '');
        }
      }
    }
  }

  return resolved;
}

// ── Mock Bridge ───────────────────────────────────────────────────────────────

async function sendMocks() {
  try {
    const { profiles = [], activeProfileId = null } =
      await chrome.storage.local.get(['profiles', 'activeProfileId']);

    if (!Array.isArray(profiles) || !activeProfileId) {
      dispatchMocks({ mocks: [], consoleLogging: true });
      removeEnvBadge();
      return;
    }

    const profile = profiles.find(p => p.id === activeProfileId && p.enabled);
    if (!profile) {
      dispatchMocks({ mocks: [], consoleLogging: true });
      removeEnvBadge();
      return;
    }

    // Isolated Tab Scoping: if profile is scoped to a specific tab, check match
    if (typeof profile.scopedTabId === 'number' && profile.scopedTabId > 0) {
      const myTabId = await getTabId();
      if (myTabId !== profile.scopedTabId) {
        dispatchMocks({ mocks: [], consoleLogging: true }); // Do not apply mocks in un-scoped tabs
        removeEnvBadge();
        return;
      }
    }

    const activeMocks = (profile.mocks ?? [])
      .filter(m => m.enabled)
      .map(m => ({
        ...m,
        urlFilter: resolveDynamicVars(m.urlFilter ?? '', profile.customVars),
        responseBody: resolveDynamicVars(m.responseBody ?? '', profile.customVars),
      }));

    dispatchMocks({
      mocks: activeMocks,
      consoleLogging: profile.consoleLogging !== false,
    });

    // Inject environment badge only on targeted testing sites
    if (isPageTargetForProfile(profile) && !badgeDismissed) {
      injectEnvBadge(profile.name, profile.id);
    } else {
      removeEnvBadge();
    }
  } catch (_) {
    dispatchMocks({ mocks: [], consoleLogging: true });
    removeEnvBadge();
  }
}

function dispatchMocks(payload) {
  const detail = JSON.stringify(payload);
  if (document.documentElement) {
    document.documentElement.dataset.hcMocks = detail;
  }
  document.dispatchEvent(
    new CustomEvent('__headercraft_mocks__', { bubbles: true, composed: true, detail })
  );
  window.dispatchEvent(
    new CustomEvent('__headercraft_mocks__', { bubbles: true, composed: true, detail })
  );
}

// Send on page start and whenever storage changes
sendMocks();
chrome.storage.onChanged.addListener((_, area) => {
  if (area === 'local') sendMocks();
});

// Bi-directional handshake: listen for mock requests from MAIN world interceptor
document.addEventListener('__headercraft_request_mocks__', () => sendMocks());
window.addEventListener('__headercraft_request_mocks__', () => sendMocks());

// ── Web Page Share Import Listener (The Landing Page Bridge) ─────────────────

window.addEventListener('message', async (event) => {
  if (event.data?.type === 'HEADERCRAFT_IMPORT' && event.data.payload) {
    chrome.runtime.sendMessage({
      type: 'IMPORT_SHARE_PROFILE',
      payload: event.data.payload,
    }, (response) => {
      if (response?.success) {
        window.postMessage({ type: 'HEADERCRAFT_IMPORT_SUCCESS', profileName: response.profileName }, '*');
      }
    });
  }
});

// Auto-detect import hash if browsing the official landing page or docs
if (window.location.hash.includes('import=') && (window.location.hostname.includes('headercraft') || window.location.hostname === 'localhost')) {
  const hash = window.location.hash;
  chrome.runtime.sendMessage({ type: 'IMPORT_SHARE_PROFILE', payload: hash });
}

