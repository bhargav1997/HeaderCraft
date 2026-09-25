# Chrome Web Store Listing — HeaderCraft

> Last Updated: 2026-09-25

## Store Listing

**Extension Name**
HeaderCraft

**Short Description**
Add, modify, or remove HTTP request & response headers locally. No cloud, no subscription, zero data exfiltration.

**Detailed Description**
HeaderCraft lets developers and QA engineers add, modify, or remove HTTP request and response headers directly in Chrome — all processed on your machine, never on a remote server.

Key features:
Create unlimited header profiles, each with its own URL filter and header rules.
Toggle profiles on or off with one click or the Alt+Shift+H keyboard shortcut.
Add Authorization tokens, custom User-Agents, CORS headers, or any request/response header you need.
Scope headers to exact domains, paths, or regex patterns so sensitive tokens never leak to unrelated sites.
Import and export profiles as JSON files to share with teammates via Slack or Git.
Works on all HTTP/HTTPS traffic including XHR, Fetch, main-frame, scripts, and more.

How to use:
1. Open the HeaderCraft popup from the browser toolbar.
2. Click the + button to create a new profile and give it a name.
3. Set an optional URL filter (e.g., api.example.com or a regex like .*staging.* ).
4. Click Add Header to define a header name, value, and operation (set/append/remove).
5. Toggle the profile On to activate the rules. Chrome applies them instantly.

Privacy and permissions:
HeaderCraft uses Chrome's declarativeNetRequest API, which modifies headers at the browser level without exposing raw request data to any extension code. Your header configurations are stored exclusively in chrome.storage.local on your own device. No analytics, no telemetry, no remote servers of any kind are used.

**Category**
Developer Tools

**Single Purpose**
Adds, modifies, or removes HTTP request and response headers for specified URLs using Chrome's local declarativeNetRequest API.

**Primary Language**
English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `icons/icon-128.png` |
| Screenshot 1 | 1280×800 or 640×400 | ⬜ Not created | Profile list + header rules UI |
| Screenshot 2 | 1280×800 or 640×400 | ⬜ Not created | URL filter with regex mode active |
| Screenshot 3 | 1280×800 or 640×400 | ⬜ Not created | JSON import/export flow |
| Small Promo Tile | 440×280 | ⬜ Not created | |

### Screenshot Notes
- Screenshot 1: Show the full popup with a profile selected, 2–3 header rules visible (e.g., Authorization, User-Agent), and the profile toggled On.
- Screenshot 2: Show the URL filter field with a regex like `.*\.staging\..*` and the `.*` regex badge highlighted.
- Screenshot 3: Show the export button triggering a download and a JSON snippet.

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `declarativeNetRequest` | permissions | Required to add, modify, and remove HTTP request and response headers using Chrome's privacy-preserving, browser-level rule engine. Without this permission the extension cannot perform its core function. |
| `declarativeNetRequestFeedback` | permissions | Required during development to verify that DNR rules are being matched correctly via `onRuleMatchedDebug`. This permission is used only for debugging and can be removed in a production-only build. |
| `storage` | permissions | Required to persist user-created profiles (header names, values, URL filters) to `chrome.storage.local` on the user's device. Without this, all configurations would be lost when the popup closes. |
| `<all_urls>` | host_permissions | Required because users may configure header rules for any arbitrary domain (e.g., internal staging environments, localhost, third-party APIs). The extension cannot know which domains the user will target at install time. No request data is read by the extension; Chrome's DNR API applies the rules internally without exposing traffic to extension code. |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No

The extension stores header configuration profiles (header names, values, URL patterns) in `chrome.storage.local`. This data:
- Never leaves the user's device.
- Is never transmitted to any external server.
- Is never read by any third party.
- Can be fully deleted by the user via the Delete Profile button or by uninstalling the extension.

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | — | No |
| Health info | No | No | — | No |
| Financial info | No | No | — | No |
| Authentication info | No (stored only if user explicitly types a token) | No | Local DNR rule only | No |
| Personal communications | No | No | — | No |
| Location | No | No | — | No |
| Web history | No | No | — | No |
| User activity | No | No | — | No |
| Website content | No | No | — | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes

---

## Privacy Policy

**Privacy Policy URL** — To be hosted at: `https://github.com/[your-handle]/headercraft/blob/main/PRIVACY.md`

See `PRIVACY.md` in this repository for the full policy text.

---

## Distribution

**Visibility**: Public
**Regions**: All regions
**Pricing**: Free

---

## Developer Info

**Publisher Name**: [Your Name / Studio Name]
**Contact Email**: [your@email.com]
**Support URL**: https://github.com/[your-handle]/headercraft/issues
**Homepage URL**: https://github.com/[your-handle]/headercraft

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2026-09-25 | Initial release: profiles, header rules (set/append/remove), URL filter, regex mode, JSON import/export, keyboard shortcut | Draft |

---

## Review Notes

### Known Issues / Limitations
- `declarativeNetRequestFeedback` permission may prompt a review question. Justification: used only for development-time rule debugging via `onRuleMatchedDebug`. Can be removed from the production ZIP if it causes a rejection.
- `<all_urls>` host permission will trigger a scrutiny question. Justification is detailed above — the user's target domains are unknown at install time, and the DNR API never exposes raw traffic to extension code.

### Rejection History
<!-- None yet. -->
