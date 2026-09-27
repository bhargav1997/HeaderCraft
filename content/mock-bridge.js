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

// ── Environment Badge Injection ───────────────────────────────────────────────

const PROFILE_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#f97316', '#06b6d4',
];

function getProfileColor(profileId) {
  // Deterministic color from profile id
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) hash = (hash * 31 + profileId.charCodeAt(i)) >>> 0;
  return PROFILE_COLORS[hash % PROFILE_COLORS.length];
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
  label.style.cssText = `
    position:fixed;top:6px;right:10px;z-index:2147483647;
    font-family:'Inter',system-ui,sans-serif;font-size:10px;font-weight:600;
    letter-spacing:.04em;color:#fff;background:${color};border-radius:4px;
    padding:2px 8px;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.4);
    opacity:.9;white-space:nowrap;max-width:200px;overflow:hidden;text-overflow:ellipsis;
  `;
  label.textContent = `HeaderCraft: ${profileName}`;

  document.documentElement.appendChild(bar);
  document.documentElement.appendChild(label);
}

function removeEnvBadge() {
  document.getElementById('hc-env-badge')?.remove();
  document.getElementById('hc-env-badge-label')?.remove();
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

    const activeMocks = (profile.mocks ?? []).filter(m => m.enabled);
    dispatchMocks({
      mocks: activeMocks,
      consoleLogging: profile.consoleLogging !== false,
    });

    // Inject environment badge
    injectEnvBadge(profile.name, profile.id);
  } catch (_) {
    dispatchMocks({ mocks: [], consoleLogging: true });
    removeEnvBadge();
  }
}

function dispatchMocks(payload) {
  document.dispatchEvent(
    new CustomEvent('__headercraft_mocks__', { detail: JSON.stringify(payload) })
  );
}

// Send on page start and whenever storage changes
sendMocks();
chrome.storage.onChanged.addListener((_, area) => {
  if (area === 'local') sendMocks();
});

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

