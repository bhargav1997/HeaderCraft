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
 * via a CustomEvent dispatched by mock-bridge.js (isolated world) and
 * document.documentElement.dataset.hcMocks.
 */

(function () {
  'use strict';

  // ── Mock store ──────────────────────────────────────────────────────────────

  let mocks = [];
  let consoleLogging = true;

  function updateMocksFromDetail(detail) {
    if (!detail) return;
    try {
      const parsed = typeof detail === 'string' ? JSON.parse(detail) : detail;
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
  }

  function syncMocksFromDOM() {
    try {
      const raw = document.documentElement?.dataset?.hcMocks;
      if (raw) {
        updateMocksFromDetail(raw);
      }
    } catch (_) {}
  }

  // Initial sync from DOM
  syncMocksFromDOM();

  // Listen for live updates via CustomEvents
  document.addEventListener('__headercraft_mocks__', (e) => updateMocksFromDetail(e.detail));
  window.addEventListener('__headercraft_mocks__', (e) => updateMocksFromDetail(e.detail));

  // Request latest mocks from bridge
  function requestMocks() {
    document.dispatchEvent(new CustomEvent('__headercraft_request_mocks__', { bubbles: true, composed: true }));
    window.dispatchEvent(new CustomEvent('__headercraft_request_mocks__', { bubbles: true, composed: true }));
  }
  requestMocks();

  function findMock(url, method) {
    if (!url || typeof url !== 'string') return null;

    if (!mocks.length) {
      syncMocksFromDOM();
    }

    return mocks.find((m) => {
      if (!m.urlFilter || !m.urlFilter.trim()) return false;

      const filter = m.urlFilter.trim();
      let urlMatch = false;

      try {
        if (m.useRegex) {
          urlMatch = new RegExp(filter, 'i').test(url);
        } else {
          urlMatch = url.includes(filter) ||
                     url.toLowerCase().includes(filter.toLowerCase());
          if (!urlMatch && filter.startsWith('/')) {
            try {
              const parsedUrl = new URL(url, window.location.href);
              urlMatch = parsedUrl.pathname.includes(filter) ||
                         (parsedUrl.pathname + parsedUrl.search).includes(filter);
            } catch (_) {}
          }
        }
      } catch (_) {
        urlMatch = url.includes(filter);
      }

      const reqMethod = (method || 'GET').toUpperCase();
      const mockMethod = (m.method || '*').toUpperCase();
      const methodMatch = mockMethod === '*' || mockMethod === reqMethod;

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

    const status = Number(mock.statusCode) || 200;
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
      const parsed = typeof mock.responseBody === 'string' ? JSON.parse(mock.responseBody) : mock.responseBody;
      console.log('%cMocked Response (JSON):', 'color: #94a3b8; font-weight: bold;', parsed);
    } catch (_) {
      console.log('%cMocked Response (Raw):', 'color: #94a3b8; font-weight: bold;', mock.responseBody ?? '');
    }
    console.groupEnd();
  }

  // ── Patch fetch ─────────────────────────────────────────────────────────────

  const _fetch = window.fetch?.bind(window);

  if (_fetch) {
    window.fetch = async function (...args) {
      const [resource, options = {}] = args;

      let url = '';
      try {
        url = typeof resource === 'string'  ? resource
            : resource instanceof URL       ? resource.href
            : resource?.url ?? '';
      } catch (_) { /* Request object access failed */ }

      const method = (options?.method || (typeof resource === 'object' && resource?.method) || 'GET').toUpperCase();

      const mock = findMock(url, method);
      if (mock) {
        logDevToolsBridge('fetch', method, url, mock);
        const delayMs = Number(mock.delayMs) || 0;
        const respond = () => {
          const bodyText = typeof mock.responseBody === 'string' ? mock.responseBody : JSON.stringify(mock.responseBody ?? '');
          const status = Number(mock.statusCode) || 200;
          return new Response(bodyText, {
            status: status,
            statusText: status >= 200 && status < 300 ? 'OK' : status === 404 ? 'Not Found' : status === 500 ? 'Internal Server Error' : 'Mocked',
            headers: new Headers(buildHeaders(mock)),
          });
        };
        if (delayMs > 0) {
          return new Promise(resolve => setTimeout(() => resolve(respond()), delayMs));
        }
        return respond();
      }

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
        _method = (method || 'GET').toUpperCase();
        _url    = url ? String(url) : '';
        _mock   = _url ? findMock(_url, _method) : null;
        if (!_mock) return _open(method, url, async, ...rest);
      };

      const _send = xhr.send.bind(xhr);
      xhr.send = function (body) {
        if (!_mock) return _send(body);

        const mock = _mock;
        logDevToolsBridge('XHR', _method, _url, mock);
        const delayMs = Number(mock.delayMs) || 0;

        setTimeout(() => {
          const bodyText = typeof mock.responseBody === 'string' ? mock.responseBody : JSON.stringify(mock.responseBody ?? '');
          const status = Number(mock.statusCode) || 200;

          const define = (key, val) =>
            Object.defineProperty(xhr, key, { get: () => val, configurable: true });

          define('readyState',  4);
          define('status',      status);
          define('statusText',  status >= 200 && status < 300 ? 'OK' : status === 404 ? 'Not Found' : status === 500 ? 'Internal Server Error' : 'Mocked');
          define('responseText', bodyText);
          define('response',     bodyText);
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
