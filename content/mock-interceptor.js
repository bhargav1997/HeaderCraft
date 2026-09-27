/**
 * mock-interceptor.js — MAIN World Content Script
 *
 * Patches window.fetch and XMLHttpRequest so matching requests are
 * short-circuited and return a user-defined mock response — entirely
 * client-side, no proxy server required.
 *
 * This script runs in Chrome's MAIN world (declared in manifest.json):
 *   "world": "MAIN"
 * Therefore it CANNOT access chrome.* APIs. It receives its configuration
 * via a CustomEvent dispatched by mock-bridge.js (isolated world).
 *
 * Key safety rules:
 *  1. NEVER intercept a request if urlFilter is empty — that would match everything.
 *  2. ALWAYS call the native fetch/XHR with the global scope (window) as `this`,
 *     not the caller's `this`. Chrome's native fetch validates its `this` binding
 *     and throws "Failed to fetch" when called with the wrong context.
 *  3. Guard against window.fetch being absent or already replaced.
 */

(function () {
  'use strict';

  // ── Mock store ──────────────────────────────────────────────────────────────

  let mocks = [];
  let consoleLogging = true;

  document.addEventListener('__headercraft_mocks__', (e) => {
    try {
      const parsed = JSON.parse(e.detail);
      if (Array.isArray(parsed)) {
        mocks = parsed;
        consoleLogging = true;
      } else if (parsed && typeof parsed === 'object') {
        mocks = parsed.mocks ?? [];
        consoleLogging = parsed.consoleLogging !== false;
      }
    } catch (_) {
      mocks = [];
    }
  });

  function findMock(url, method) {
    return mocks.find((m) => {
      // BUG FIX #1: never match when urlFilter is blank — url.includes('') is
      // always true, which would intercept every request on every site.
      if (!m.urlFilter || !m.urlFilter.trim()) return false;

      let urlMatch = false;
      try {
        urlMatch = m.useRegex
          ? new RegExp(m.urlFilter).test(url)
          : url.includes(m.urlFilter);
      } catch (_) { urlMatch = false; }

      const methodMatch =
        !m.method || m.method === '*' ||
        m.method.toUpperCase() === (method || 'GET').toUpperCase();

      return urlMatch && methodMatch;
    });
  }

  function buildHeaders(mock) {
    return {
      'Content-Type': mock.contentType || 'application/json',
      'X-HeaderCraft-Mocked': 'true',
    };
  }

  function logDevToolsBridge(type, method, url, mock) {
    if (!consoleLogging) return;

    // Requirement: In-Console Interception Logger
    console.log(
      '%c[HeaderCraft] Mocked %s',
      'background: #059669; color: white; padding: 2px 4px; border-radius: 2px;',
      url
    );

    const status = mock.statusCode ?? 200;
    const isError = status >= 400;
    const badgeColor = isError ? '#f87171' : '#34d399';
    const badgeBg = isError ? '#450a0a' : '#064e3b';

    console.groupCollapsed(
      `%c[HeaderCraft] Intercepted (${type})%c ${method} ${url} %c-> Mocked ${status} `,
      'background: #312e81; color: #a5b4fc; font-weight: bold; padding: 2px 6px; border-radius: 3px 0 0 3px;',
      'background: #27272a; color: #f4f4f5; padding: 2px 6px; font-family: monospace;',
      `background: ${badgeBg}; color: ${badgeColor}; font-weight: bold; padding: 2px 6px; border-radius: 0 3px 3px 0;`
    );
    console.log('%cURL Filter:%c ' + mock.urlFilter, 'color: #94a3b8; font-weight: bold;', 'color: #e2e8f0;');
    console.log('%cStatus Code:%c ' + status, 'color: #94a3b8; font-weight: bold;', `color: ${badgeColor}; font-weight: bold;`);
    console.log('%cHeaders:', 'color: #94a3b8; font-weight: bold;', buildHeaders(mock));
    try {
      const parsed = JSON.parse(mock.responseBody ?? '');
      console.log('%cMocked Response (JSON):', 'color: #94a3b8; font-weight: bold;', parsed);
    } catch (_) {
      console.log('%cMocked Response (Raw):', 'color: #94a3b8; font-weight: bold;', mock.responseBody ?? '');
    }
    console.groupEnd();
  }

  // ── Patch fetch ─────────────────────────────────────────────────────────────

  // BUG FIX #2: guard against window.fetch being absent (service worker pages,
  // some sandboxed iframes, or scripts that replace fetch before ours runs).
  const _fetch = window.fetch?.bind(window); // bind to window NOW, not at call time

  if (_fetch) {
    window.fetch = async function (...args) {
      const [resource, options = {}] = args;

      // Safely extract the URL regardless of argument type
      let url = '';
      try {
        url = typeof resource === 'string'  ? resource
            : resource instanceof URL       ? resource.href
            : resource?.url ?? '';
      } catch (_) { /* Request object access failed, pass through */ }

      const method = (options?.method || 'GET').toUpperCase();

      const mock = findMock(url, method);
      if (mock) {
        logDevToolsBridge('fetch', method, url, mock);
        const delayMs = mock.delayMs ?? 0;
        const respond = () => new Response(mock.responseBody ?? '', {
          status:  mock.statusCode  ?? 200,
          headers: buildHeaders(mock),
        });
        if (delayMs > 0) {
          return new Promise(resolve => setTimeout(() => resolve(respond()), delayMs));
        }
        return respond();
      }

      // BUG FIX #3: use the pre-bound _fetch (bound to window at capture time)
      // instead of _fetch.apply(this, args). Chrome's native fetch validates its
      // `this` binding — passing the caller's `this` (which may not be window)
      // throws "TypeError: Failed to fetch" even for completely valid requests.
      return _fetch(...args);
    };
  }

  // ── Patch XMLHttpRequest ─────────────────────────────────────────────────────

  const _XHR = window.XMLHttpRequest;

  if (_XHR) {
    window.XMLHttpRequest = function () {
      const xhr     = new _XHR();
      let _url      = '';
      let _method   = 'GET';
      let _mock     = null;

      const _open = xhr.open.bind(xhr);
      xhr.open = function (method, url, async = true, ...rest) {
        _method = method;
        _url    = url;
        // Only look for a mock when urlFilter is non-empty (same safety check as fetch)
        _mock   = url ? findMock(url, method) : null;
        if (!_mock) return _open(method, url, async, ...rest);
      };

      const _send = xhr.send.bind(xhr);
      xhr.send = function (body) {
        if (!_mock) return _send(body);

        const mock = _mock;
        logDevToolsBridge('XHR', _method, _url, mock);
        const delayMs = mock.delayMs ?? 0;

        setTimeout(() => {
          const define = (key, val) =>
            Object.defineProperty(xhr, key, { get: () => val, configurable: true });

          define('readyState',  4);
          define('status',      mock.statusCode ?? 200);
          define('statusText',  'OK');
          define('responseText', mock.responseBody ?? '');
          define('response',     mock.responseBody ?? '');
          define('responseURL',  _url);

          xhr.dispatchEvent(new ProgressEvent('readystatechange'));
          xhr.dispatchEvent(new ProgressEvent('load'));
          xhr.dispatchEvent(new ProgressEvent('loadend'));
        }, delayMs > 0 ? delayMs : 0);
      };

      return xhr;
    };
  }
})();
