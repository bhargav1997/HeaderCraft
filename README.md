# HeaderCraft

> **The 100% free, local-first Manifest V3 HTTP header modifier.**  
> Built for developers and QA engineers who need to test CORS, inject Bearer tokens, and manipulate User-Agents — without their traffic being sent to remote servers.

---

## Why HeaderCraft?

ModHeader was removed from the Chrome Web Store in July 2026 for embedding a malware exfiltration SDK. Enterprise alternatives charge monthly fees. HeaderCraft is:

- **Free forever** — no paywalls, no tiers
- **Local-first** — zero cloud backend, zero telemetry
- **Privacy-preserving** — uses Chrome's `declarativeNetRequest` API, which applies rules at the browser level without ever exposing your raw network traffic to extension code
- **Open source** — the entire codebase is auditable

---

## Features

### V1 (current)
- ✅ Add, modify, or remove **request headers** (e.g., `Authorization`, `User-Agent`, `X-Custom-Header`)
- ✅ Add, modify, or remove **response headers** (e.g., `Access-Control-Allow-Origin`)
- ✅ **Multiple profiles** — group rules by environment (`Localhost`, `Staging QA`, `Production`)
- ✅ **Targeted URL filtering** — scope rules to specific domains so tokens don't leak elsewhere
- ✅ **Regex URL filter** mode for advanced routing
- ✅ **JSON import/export** — share profiles with teammates via Slack or Git
- ✅ **Keyboard shortcut** `Alt+Shift+H` to toggle the active profile without opening the popup
- ✅ Per-rule enable/disable without deleting rules
- ✅ Operations: `set`, `append`, `remove`

---

## Architecture

| Component | Technology | Purpose |
|-----------|------------|---------|
| Popup UI | Vanilla JS + CSS | Manage profiles and header rules |
| State | `chrome.storage.local` | Persists config on-device only |
| Service Worker | Vanilla JS (ESM) | Translates UI state → DNR rules |
| Network Engine | `declarativeNetRequest` | Chrome-native, privacy-first header modification |

**No React. No build step. No bundler.** Load the directory directly in `chrome://extensions` developer mode and it works.

---

## Installation (Development)

```bash
git clone https://github.com/[your-handle]/headercraft.git
cd headercraft

# Generate icons (one-time)
npm install
node generate_icons.js
```

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select the `HeaderCraft/` directory
4. The extension icon appears in your toolbar

---

## Usage

1. Click the HeaderCraft toolbar icon
2. Click **+** to create a profile (e.g., "Staging API")
3. Set a URL filter: `api.staging.example.com` (or enable regex for `.*\.staging\..*`)
4. Click **Add Header** and configure:
   - **Name**: `Authorization`
   - **Operation**: `set`
   - **Value**: `Bearer eyJhbGci...`
   - **Type**: `REQ` (request) or `RES` (response)
5. Toggle the profile **On** — rules apply instantly
6. Use `Alt+Shift+H` to toggle the active profile without opening the popup

---

## JSON Profile Format

Profiles can be exported and imported as JSON. Example:

```json
{
  "name": "Staging QA",
  "urlFilter": "api.staging.example.com",
  "useRegex": false,
  "enabled": false,
  "headers": [
    {
      "name": "Authorization",
      "value": "Bearer <token>",
      "operation": "set",
      "type": "request",
      "enabled": true
    },
    {
      "name": "X-QA-Environment",
      "value": "staging",
      "operation": "set",
      "type": "request",
      "enabled": true
    }
  ]
}
```

Share this file with teammates — they can import it directly into their own HeaderCraft install.

---

## Privacy

HeaderCraft has no servers. Configuration data is stored exclusively in `chrome.storage.local` on your device and is never transmitted anywhere. See [PRIVACY.md](PRIVACY.md) for the full policy.

---

## Contributing

PRs welcome. The extension has no build step — edit the files and reload the unpacked extension.

```
HeaderCraft/
├── manifest.json
├── background/
│   └── background.js      # Service worker → DNR rule engine
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js           # UI controller
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── generate_icons.js      # One-time icon generator
├── CHROMEWEBSTORE.md      # Store listing metadata
└── PRIVACY.md
```

---

## License

MIT
