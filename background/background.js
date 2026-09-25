/**
 * background.js — HeaderCraft Service Worker (v1.1)
 *
 * Handles all DNR rule construction for:
 *  1. Header modification  (modifyHeaders)
 *  2. URL redirects        (redirect → url)
 *  3. Query-param rules    (redirect → transform → queryTransform)
 *  4. Dynamic variables    {{$uuid}} {{$timestamp}} {{$isodate}} — resolved at rule-build time,
 *     refreshed every minute via chrome.alarms (MV3 minimum alarm period).
 *
 * Mock response rules are handled by content scripts (mock-bridge + mock-interceptor).
 *
 * DNR rule ID allocation per active profile:
 *   Base offset = profileIndex * 600
 *   0–199   → header rules
 *   200–399 → redirect rules
 *   400–599 → query-param rules
 *
 * All state is read from chrome.storage on EVERY event — the service worker
 * is ephemeral and must never store state in module-level variables.
 */

// ── Dynamic Variable Resolution ───────────────────────────────────────────────

function resolveDynamicVars(value) {
  if (!value || !value.includes('{{')) return value;
  return value
    .replace(/\{\{\$uuid\}\}/gi,      () => crypto.randomUUID())
    .replace(/\{\{\$timestamp\}\}/gi, () => String(Date.now()))
    .replace(/\{\{\$isodate\}\}/gi,   () => new Date().toISOString())
    .replace(/\{\{\$date\}\}/gi,      () => new Date().toISOString().slice(0, 10));
}

// ── Condition Builder ─────────────────────────────────────────────────────────

const ALL_RESOURCE_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image',
  'font', 'object', 'xmlhttprequest', 'ping', 'media', 'websocket', 'other',
];

function buildCondition(urlFilter, useRegex, resourceTypes = ALL_RESOURCE_TYPES, tabId = null) {
  const condition = { resourceTypes };
  if (urlFilter && urlFilter.trim()) {
    if (useRegex) {
      condition.regexFilter = urlFilter.trim();
    } else {
      condition.urlFilter = urlFilter.trim();
    }
  }
  // Isolated Tab Scoping: DNR rule only fires for requests originating from this tab ID
  if (typeof tabId === 'number' && tabId > 0) {
    condition.tabIds = [tabId];
  }
  return condition;
}

// ── Rule Builders ─────────────────────────────────────────────────────────────

/** Header modification rules (one DNR rule per enabled header entry). */
function buildHeaderRules(profile, idBase) {
  const rules = [];
  let i = 0;
  for (const h of profile.headers ?? []) {
    if (!h.enabled || !h.name) continue;

    const entry = {
      header: h.name,
      operation: h.operation ?? 'set',
      ...(h.operation !== 'remove' && { value: resolveDynamicVars(h.value ?? '') }),
    };

    const action = { type: 'modifyHeaders' };
    if (h.type === 'response') {
      action.responseHeaders = [entry];
    } else {
      action.requestHeaders = [entry];
    }

    rules.push({
      id: idBase + (i++),
      priority: 1,
      action,
      condition: buildCondition(profile.urlFilter, profile.useRegex, ALL_RESOURCE_TYPES, profile.scopedTabId),
    });

    if (i >= 200) break; // ID slot limit
  }
  return rules;
}

/** URL redirect rules — each rule has its own fromUrl condition.
 *
 *  BUG FIX (v1.1.1): normalise toUrl — users often type "localhost:3000/..."
 *  without the http:// prefix. Chrome's DNR silently skips rules whose redirect
 *  target is not an absolute http/https URL. Auto-prefix to fix this.
 */
function buildRedirectRules(profile, idBase) {
  const rules = [];
  let i = 0;
  for (const r of profile.redirects ?? []) {
    if (!r.enabled || !r.fromUrl || !r.toUrl) continue;

    // Normalise scheme
    let toUrl = r.toUrl.trim();
    if (/^localhost(:\d+)?(\/|$)/.test(toUrl)) toUrl = 'http://' + toUrl;

    // Skip rules with no valid absolute URL — log clearly so devs can debug
    if (!toUrl.startsWith('http://') && !toUrl.startsWith('https://') &&
        !toUrl.startsWith('chrome-extension://')) {
      console.warn(`[HeaderCraft] Redirect skipped — toUrl must start with http(s)://, got: "${toUrl}"`);
      continue;
    }

    const resourceTypes = r.resourceTypes?.length ? r.resourceTypes : ALL_RESOURCE_TYPES;

    rules.push({
      id: idBase + (i++),
      priority: 3, // Higher than headers so redirects always fire
      action: {
        type: 'redirect',
        redirect: { url: toUrl },
      },
      condition: buildCondition(r.fromUrl, r.useRegex ?? false, resourceTypes, profile.scopedTabId),
    });

    if (i >= 200) break;
  }
  return rules;
}

/** Query-parameter transform rules using DNR's built-in queryTransform.
 *
 *  BUG FIX (v1.1.1): was using a small hardcoded resource-type list which caused
 *  the rule to silently miss most real-world requests. Now uses ALL_RESOURCE_TYPES.
 */
function buildQueryParamRules(profile, idBase) {
  const rules = [];
  let i = 0;
  for (const q of profile.queryParams ?? []) {
    if (!q.enabled) continue;

    const addOrReplaceParams = (q.addOrReplace ?? []).filter(p => p.key?.trim());
    const removeParams       = (q.remove ?? []).filter(Boolean);

    if (!addOrReplaceParams.length && !removeParams.length) continue;

    const queryTransform = {};
    if (addOrReplaceParams.length) queryTransform.addOrReplaceParams = addOrReplaceParams;
    if (removeParams.length)       queryTransform.removeParams = removeParams;

    // Use the rule's own urlFilter if set, fall back to the profile-level filter.
    const effectiveFilter = q.urlFilter?.trim() || profile.urlFilter;

    rules.push({
      id: idBase + (i++),
      priority: 2,
      action: {
        type: 'redirect',
        redirect: { transform: { queryTransform } },
      },
      condition: buildCondition(
        effectiveFilter,
        q.useRegex ?? profile.useRegex,
        ALL_RESOURCE_TYPES,
        profile.scopedTabId,
      ),
    });

    if (i >= 200) break;
  }
  return rules;
}

// ── Main Rebuild ──────────────────────────────────────────────────────────────

async function rebuildRules() {
  try {
    const { profiles = [], activeProfileId = null } = await chrome.storage.local.get([
      'profiles', 'activeProfileId',
    ]);

    // Query both dynamic rules and session rules
    const existingDynamic = await chrome.declarativeNetRequest.getDynamicRules();
    const existingSession = await chrome.declarativeNetRequest.getSessionRules();

    const removeDynamicIds = existingDynamic.map(r => r.id);
    const removeSessionIds = existingSession.map(r => r.id);

    const addDynamicRules = [];
    const addSessionRules = [];

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i];
      if (profile.id !== activeProfileId || !profile.enabled) continue;

      const base = (i + 1) * 600;
      const rules = [
        ...buildHeaderRules(profile,     base),
        ...buildRedirectRules(profile,   base + 200),
        ...buildQueryParamRules(profile, base + 400),
      ];

      // Chrome DNR Requirement: `condition.tabIds` is ONLY supported in session rules!
      // Dynamic rules do not support `tabIds` and will fail if passed.
      if (profile.scopedTabId) {
        addSessionRules.push(...rules);
      } else {
        addDynamicRules.push(...rules);
      }
    }

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeDynamicIds,
      addRules: addDynamicRules,
    });

    await chrome.declarativeNetRequest.updateSessionRules({
      removeRuleIds: removeSessionIds,
      addRules: addSessionRules,
    });

    console.log(`[HeaderCraft] Rules rebuilt — Dynamic: ${addDynamicRules.length}, Session (Tab-Scoped): ${addSessionRules.length}`);
  } catch (err) {
    console.error('[HeaderCraft] Rule rebuild error:', err);
  }
}

// ── Listeners ─────────────────────────────────────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if ('profiles' in changes || 'activeProfileId' in changes) rebuildRules();
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-active-profile') return;
  const { profiles = [], activeProfileId = null } = await chrome.storage.local.get([
    'profiles', 'activeProfileId',
  ]);
  const updated = profiles.map(p =>
    p.id === activeProfileId ? { ...p, enabled: !p.enabled } : p
  );
  await chrome.storage.local.set({ profiles: updated });
});

/** Periodic refresh so {{$uuid}} / {{$timestamp}} values stay fresh. */
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'hc-dynamic-refresh') rebuildRules();
});

// ── Stateless URL Sharing & Tab Helpers ───────────────────────────────────────

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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_TAB_ID') {
    sendResponse({ tabId: sender.tab?.id ?? null });
    return false;
  }

  if (message.type === 'IMPORT_SHARE_PROFILE' && message.payload) {
    (async () => {
      try {
        let raw = message.payload;
        if (raw.includes('#import=')) raw = raw.split('#import=')[1];
        if (raw.includes('import=')) raw = raw.split('import=')[1];
        const profile = await decompressProfile(decodeURIComponent(raw));
        if (!profile || typeof profile !== 'object') {
          sendResponse({ success: false, error: 'Invalid profile data' });
          return;
        }

        profile.id = crypto.randomUUID();
        profile.name = (profile.name || 'Shared Profile') + ' (Imported)';
        profile.enabled = false;

        const { profiles = [] } = await chrome.storage.local.get(['profiles']);
        profiles.unshift(profile);
        await chrome.storage.local.set({ profiles, activeProfileId: profile.id });
        console.log(`[HeaderCraft] Imported profile from share link: "${profile.name}"`);
        sendResponse({ success: true, profileName: profile.name });
      } catch (err) {
        console.error('[HeaderCraft] Share import failed:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep message channel open for async response
  }
});

// Clear tab scoping when the scoped tab is closed by the user
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { profiles = [] } = await chrome.storage.local.get(['profiles']);
  let changed = false;
  const updated = profiles.map(p => {
    if (p.scopedTabId === tabId) {
      changed = true;
      return { ...p, scopedTabId: null, scopedTabTitle: null };
    }
    return p;
  });
  if (changed) {
    await chrome.storage.local.set({ profiles: updated });
    console.log(`[HeaderCraft] Scoped tab ${tabId} closed; profile scope reset to all tabs.`);
  }
});

// ── Example Profile Generator (All-in-One) ───────────────────────────────────

function createUnifiedExampleProfile() {
  const uid = () => crypto.randomUUID();
  return {
    id: uid(),
    name: '📖 Example – All Features',
    urlFilter: '',
    useRegex: false,
    enabled: false, // Disabled by default for safety; toggle On to test

    // Tab 1: Headers (Auth, UUID session tracking, CORS headers, timestamps)
    headers: [
      {
        id: uid(), enabled: true,
        name: 'Authorization', value: 'Bearer YOUR_TOKEN_HERE',
        operation: 'set', type: 'request',
      },
      {
        id: uid(), enabled: true,
        name: 'X-Correlation-ID', value: '{{$uuid}}', // refreshed per minute
        operation: 'set', type: 'request',
      },
      {
        id: uid(), enabled: true,
        name: 'Access-Control-Allow-Origin', value: '*',
        operation: 'set', type: 'response',
      },
      {
        id: uid(), enabled: false, // toggle on to test
        name: 'X-Debug-Timestamp', value: '{{$timestamp}}',
        operation: 'set', type: 'request',
      },
    ],

    // Tab 2: Redirects (Map local bundle, proxy API, regex redirect)
    redirects: [
      {
        id: uid(), enabled: true,
        fromUrl: 'myapp.com/static/bundle.min.js', // url matching this substring
        toUrl: 'http://localhost:3000/bundle.js',  // redirected to local dev server
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

    // Tab 3: Query Params (Inject debug params, strip tracking params)
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

    // Tab 4: API Mocks (Simulate 200 OK JSON, 500 error boundaries, 401 auth)
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

/**
 * Seeds the single all-in-one example profile once.
 * Cleans out any old multi-example profiles so user gets a clean single profile.
 */
async function seedUnifiedExampleProfile() {
  const { profiles: existing = [], activeProfileId, exampleSeededV3 } =
    await chrome.storage.local.get(['profiles', 'activeProfileId', 'exampleSeededV3']);

  if (exampleSeededV3) return;

  // Clean out any legacy "📖 Example" profiles (e.g. from the previous 4-profile scheme)
  const remaining = existing.filter(p => !p.name?.startsWith('📖 Example'));
  const example = createUnifiedExampleProfile();
  const merged = [example, ...remaining];

  await chrome.storage.local.set({
    profiles: merged,
    activeProfileId: activeProfileId ?? example.id,
    exampleSeededV3: true,
  });
  console.log('[HeaderCraft] Seeded 1 unified example profile.');
}

// ── Lifecycle Listeners ───────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  await seedUnifiedExampleProfile();
  // Refresh dynamic variable rules every minute (MV3 minimum alarm period)
  await chrome.alarms.create('hc-dynamic-refresh', { periodInMinutes: 1 });
  console.log('[HeaderCraft] v1.1.2 installed / updated.');
});

// Run once on service worker startup in case installed event was missed
seedUnifiedExampleProfile();

