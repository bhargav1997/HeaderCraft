/**
 * mock-bridge.js — Isolated World Content Script
 *
 * Reads active mock rules from chrome.storage.local and forwards
 * them to the MAIN world via a CustomEvent so mock-interceptor.js
 * can intercept fetch / XMLHttpRequest calls without a server.
 *
 * Features:
 *  1. Isolated Tab Scoping: ensures mocks are only applied if this tab
 *     matches the profile's scopedTabId (if tab scoping is active).
 *  2. Stateless URL Sharing: listens for web-triggered import messages
 *     (e.g. from headercraft.dev/#import=...) and passes them to the background.
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

async function sendMocks() {
  try {
    const { profiles = [], activeProfileId = null } =
      await chrome.storage.local.get(['profiles', 'activeProfileId']);

    if (!Array.isArray(profiles) || !activeProfileId) {
      dispatchMocks([]);
      return;
    }

    const profile = profiles.find(p => p.id === activeProfileId && p.enabled);
    if (!profile) {
      dispatchMocks([]);
      return;
    }

    // Isolated Tab Scoping: if profile is scoped to a specific tab, check match
    if (typeof profile.scopedTabId === 'number' && profile.scopedTabId > 0) {
      const myTabId = await getTabId();
      if (myTabId !== profile.scopedTabId) {
        dispatchMocks([]); // Do not apply mocks in un-scoped tabs
        return;
      }
    }

    const activeMocks = (profile.mocks ?? []).filter(m => m.enabled);
    dispatchMocks(activeMocks);
  } catch (_) {
    dispatchMocks([]);
  }
}

function dispatchMocks(mocks) {
  document.dispatchEvent(
    new CustomEvent('__headercraft_mocks__', { detail: JSON.stringify(mocks) })
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
