# HeaderCraft — Pre-Deployment Manual QA Test Plan

> **Target Audience:** QA Testers, Product Managers, Non-Technical Reviewers  
> **Version:** 1.3.0  
> **Goal:** Verify all features of the HeaderCraft Chrome Extension step-by-step before submission to the Chrome Web Store. No programming or technical knowledge required!

---

## 📋 Prerequisites & Setup

1. Open Chrome and go to `chrome://extensions/` in the address bar.
2. Turn ON **Developer mode** using the toggle switch in the top right corner.
3. Click **Load unpacked** in the top left corner.
4. Select the `HeaderCraft` project folder.
5. Confirm that **HeaderCraft** icon appears in your Chrome extensions toolbar (click the puzzle piece icon 🧩 at the top right and pin HeaderCraft).

---

## 🧪 Test Cases Checklist

### Test Case 1: Extension Launch & Initial Interface
**Goal:** Verify the extension opens smoothly and displays default profiles and tabs.

- **Step 1:** Click the **HeaderCraft** icon in your browser toolbar.
- **Step 2:** Check that the popup window opens cleanly with a dark indigo theme.
- **Step 3:** Confirm you see:
  - Header bar with title **HeaderCraft** and action icons on the right.
  - Left sidebar showing a profile named **Default Profile** (active with a green dot).
  - Main panel showing 4 tabs: **Headers**, **Redirects**, **Query Params**, **Mocks**.
  - ON/OFF switch set to **ON**.
  - **All Tabs** scoping button next to the ON switch.
- **Expected Result:** Extension loads instantly without visual glitches or missing icons.

---

### Test Case 2: Creating, Renaming, & Deleting Profiles
**Goal:** Verify you can create multiple profiles, rename them, and delete them.

- **Step 1:** In the left sidebar under "PROFILES", click the **`+`** button.
- **Step 2:** A new profile named **New Profile** appears in the sidebar list.
- **Step 3:** Click the edit icon (✏️ pencil next to profile name at the top) or type directly in the **Profile Name** input box. Rename it to `Staging API Test`.
- **Step 4:** Observe the left sidebar — the profile name updates to `Staging API Test` in real time.
- **Step 5:** Hover over the profile item in the sidebar and click the delete button (🗑️ trash icon). Confirm the profile is deleted and the active selection switches back to **Default Profile**.
- **Expected Result:** Profiles can be created, renamed, switched, and deleted seamlessly.

---

### Test Case 3: Global ON/OFF Switch & Auto-Disable Timer
**Goal:** Verify turning off the extension stops rules, and setting a timer automatically turns off the profile.

- **Step 1:** Select **Default Profile**. Ensure the top right switch says **ON** (green).
- **Step 2:** Click the **ON** switch once.
  - **Result:** The switch changes to **OFF** (gray), and a notice "Profile is disabled" appears.
- **Step 3:** Click the switch again to turn it back **ON**.
- **Step 4:** Next to the switch, click the timer dropdown (currently showing `Off`).
- **Step 5:** Select **15 minutes**.
  - **Result:** A countdown badge appears next to the timer showing `15m 00s` counting down in real time.
- **Step 6:** Change the timer back to **Off**.
  - **Result:** The countdown badge disappears.
- **Expected Result:** Turning OFF stops all header modifications, and setting a timer starts an active countdown display.

---

### Test Case 4: Isolated Tab Scoping ("This Tab" vs "All Tabs")
**Goal:** Ensure header overrides can be restricted to only ONE tab without leaking to other tabs.

- **Step 1:** Open a tab and visit `https://httpbin.org/headers`.
- **Step 2:** Open the HeaderCraft popup. Next to the ON switch, click **🎯 All Tabs**.
  - **Result:** The button turns purple and changes to **🎯 This Tab**. Hovering shows `Scoped to: httpbin.org`.
- **Step 3:** Under the **Headers** tab, click **+ Add Header**.
- **Step 4:** Set Name = `X-Scoped-Token`, Value = `Secret123`. Ensure Type is `REQ` (Request).
- **Step 5:** Refresh `https://httpbin.org/headers` in that tab.
  - **Result:** Under `"headers"`, `"X-Scoped-Token": "Secret123"` IS present!
- **Step 6:** Open a brand new browser tab and visit `https://httpbin.org/headers`.
  - **Result:** Under `"headers"`, `X-Scoped-Token` is **NOT** present! (Zero leak to other tabs).
- **Step 7:** Go back to HeaderCraft and click **🎯 This Tab** to switch it back to **All Tabs**.
- **Expected Result:** Tab scoping strictly isolates rules to the selected tab only.

---

### Test Case 5: Request & Response Header Rules
**Goal:** Verify adding custom request and response headers.

- **Step 1:** Open the **Headers** tab in HeaderCraft.
- **Step 2:** Click **+ Add Header** (or click **Presets** and select **Bearer Auth**).
- **Step 3:** Set:
  - Header Name: `Authorization`
  - Operation: `set`
  - Header Value: `Bearer my-secret-jwt-token`
  - Type: `REQ` (Request header)
- **Step 4:** Visit `https://httpbin.org/headers` in your browser.
  - **Result:** You should see `"Authorization": "Bearer my-secret-jwt-token"` in the JSON response.
- **Step 5:** Notice the **hits** badge on the rule card in HeaderCraft updates (e.g. `1 hits` with a green pulse dot).
- **Step 6:** Click the **Add note** button on the rule card, type `Production JWT Token`.
  - **Result:** Note input collapses/expands smoothly and saves your comment.
- **Step 7:** Try the **Live URL Tester**: In the test box at the bottom of the card, paste `https://httpbin.org/headers`.
  - **Result:** Green checkmark "Matches active profile filter" appears.
- **Expected Result:** Header modification works on live web requests and hit counters track usage.

---

### Test Case 6: Redirect Rules (URL Rewriting & Localhost Mapping)
**Goal:** Verify mapping one web URL to another (e.g., redirecting production to local server).

- **Step 1:** Click the **Redirects** tab in HeaderCraft.
- **Step 2:** Click **+ Add Redirect**.
- **Step 3:** Set:
  - Match Type: `Prefix`
  - From URL: `https://example.com`
  - To URL: `https://httpbin.org/headers`
- **Step 4:** Open a new browser tab and type `https://example.com`.
- **Expected Result:** Browser automatically redirects to `https://httpbin.org/headers`.

---

### Test Case 7: Query Parameter Rules (Injecting & Stripping URL Params)
**Goal:** Verify automatically adding or removing URL parameters (like UTM tracking codes).

- **Step 1:** Click the **Query Params** tab in HeaderCraft.
- **Step 2:** Click **Presets** dropdown at top right and select **Add UTM Campaign Tracking**.
- **Step 3:** Observe the created rule:
  - Add/Replace parameter: `utm_source` = `headercraft`, `utm_medium` = `dev_extension`
- **Step 4:** Open a new tab and visit `https://httpbin.org/get`.
- **Expected Result:** The page loads with parameters `https://httpbin.org/get?utm_source=headercraft&utm_medium=dev_extension` in the URL!

---

### Test Case 8: API Response Mock Interceptor (Client-Side fetch & XHR)
**Goal:** Intercept JavaScript `fetch()` and `XMLHttpRequest` API network calls on any web page and return fake JSON mock data, error status codes (200, 404, 500), and custom response delays without requiring a backend server.

- **Step 1:** Click the **Mocks** tab in HeaderCraft.
- **Step 2:** Click **+ Add Mock** (or select Preset **Mock 500 Server Error**).
- **Step 3:** Set:
  - **Method:** `*` (or `GET`)
  - **URL Filter:** `/api/v1/users` (or `https://httpbin.org/get`)
  - **Status Code:** `500` (or `200`)
  - **Response Body:** `{"error": "Internal Server Error", "mockedBy": "HeaderCraft"}`
  - **Response Delay:** `0` ms
- **Step 4:** Open any website in your browser (e.g., `https://httpbin.org` or `https://example.com`), and open DevTools Console (`F12` or `Cmd+Option+I` -> Console tab).
- **Step 5:** Run a test fetch in the Console:
  ```javascript
  fetch('https://httpbin.org/get').then(res => res.json()).then(data => console.log('Result:', data));
  ```
- **Expected Result:**
  1. The DevTools console immediately prints HeaderCraft's formatted interception log:
     `[HeaderCraft] Intercepted (fetch) GET https://httpbin.org/get -> Mocked 500`
  2. The response receives your custom fake JSON body:
     `Result: { error: "Internal Server Error", mockedBy: "HeaderCraft" }`
- **Step 6:** Turn **OFF** the mock rule toggle in HeaderCraft and re-run the same `fetch()` in the Console — the real network response is restored!

---

### Test Case 9: 1-Click Developer Presets
**Goal:** Verify 1-click preset buttons quickly inject rules.

- **Step 1:** In the **Headers** tab, click **Presets** in the toolbar strip or top right.
- **Step 2:** Click **Bypass CORS (All Origins)**.
  - **Result:** Instantly adds response headers `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Methods`.
- **Step 3:** Click **No-Cache / Force Refresh**.
  - **Result:** Instantly adds request headers `Cache-Control: no-cache` and `Pragma: no-cache`.
- **Expected Result:** Presets immediately populate ready-to-use developer rules.

---

### Test Case 10: Real-Time Rule Search & Filtering
**Goal:** Verify searching rules by name, value, note, or URL filter.

- **Step 1:** Ensure you have 2 or 3 rules added in the **Headers** tab.
- **Step 2:** In the search bar at the top of the rules list (`Search rules…`), type `Authorization`.
  - **Result:** Only the Authorization rule remains visible. Other rules hide.
- **Step 3:** Type `nonexistent_xyz`.
  - **Result:** All rules hide, and a message `No rules matching "nonexistent_xyz"` appears.
- **Step 4:** Click the **×** clear search button on the right of the search input.
  - **Result:** Search clears and all rules reappear.
- **Expected Result:** Search instantly filters rules across all fields and input boxes.

---

### Test Case 11: Dynamic Variable Generation (`{{$uuid}}`, `{{$timestamp}}`)
**Goal:** Verify dynamic variables automatically generate unique values per request.

- **Step 1:** In the **Headers** tab, add a rule with Name = `X-Request-ID`, Value = `{{$uuid}}`.
- **Step 2:** Visit `https://httpbin.org/headers`.
  - **Result:** `"X-Request-ID"` is populated with a real UUID (e.g. `f47ac10b-58cc-4372-a567-0e02b2c3d479`).
- **Step 3:** Refresh the page again.
  - **Result:** A brand new, unique UUID is generated for the new request!
- **Step 4:** In HeaderCraft header bar, click the **Refresh variables** button (🔄 circular arrows).
  - **Result:** Toast notice "Variables refreshed" appears.
- **Expected Result:** Dynamic variables generate fresh unique strings for every web request.

---

### Test Case 12: Universal Import Hub (cURL Commands, URLs & Share Codes)
**Goal:** Verify pasting cURL commands, API URLs, Postman JSON, or HeaderCraft share codes with real-time detection preview and 1-click import.

- **Step 1:** Click the **Import Hub** icon (box with arrow and badge) in the top header bar.
  - **Result:** The **Universal Import Hub** modal opens with tabs `cURL / URL / Code` and `Upload File (JSON)`.
- **Step 2:** Click **Paste Sample cURL** (or paste any cURL command from terminal / DevTools).
  - **Result:** Live preview instantly detects `cURL Command` and highlights the parsed headers (`Authorization`, `X-Client-Version`, `Accept`) and query parameters (`role=admin`, `debug=true`)!
- **Step 3:** Click **Import as Profile**.
  - **Result:** A new profile is created with all headers, URL filter, and query parameters pre-configured!
- **Step 4:** In the Import Hub, paste a raw API URL (e.g. `https://httpbin.org/get?user=qa_test&token=secret123`) and click Import.
  - **Result:** Extracts domain `httpbin.org` as URL filter and creates a Query Parameter rule for `user` and `token`.
- **Expected Result:** Any cURL command or URL parses into a ready-to-use profile in seconds.

---

### Test Case 13: Postman Collection & Environment JSON File Import
**Goal:** Verify importing Postman Collections (v2.0/v2.1) and Environment JSON files.

- **Step 1:** Click the **Import Hub** icon, then switch to the **Upload File (JSON)** tab (or click the **Import JSON** icon directly).
- **Step 2:** Drag-and-drop or select any Postman Collection JSON file (`collection.json`) or Postman Environment JSON (`environment.json`).
- **Step 3:** Observe the imported profile:
  - Collection name becomes the Profile Name (e.g., `Postman: E-Commerce API`).
  - Auth tokens (Bearer, Basic, APIKey) are converted to `Authorization` headers.
  - Request headers (`Accept`, `Content-Type`, custom headers) are imported.
  - Query parameters and Collection variables (`{{baseUrl}}`, `{{apiKey}}`) are converted into Custom Variables and Query Param rules!
  - Saved mock responses in Postman are converted to Mock rules.
- **Expected Result:** Seamless 1-click migration from Postman collections and environments into HeaderCraft.

---

### Test Case 14: Custom Dynamic Variables
**Goal:** Verify users can define static key-value variables and reference them via `{{var_name}}`.

- **Step 1:** In the profile topbar, click the **Variables** button (shows current count `Variables 0` or `Variables 2`).
  - **Result:** A dedicated **Custom Variables** modal popup dialog opens displaying the active profile name badge and variables list.
- **Step 2:** Click **+ Add Variable**.
  - **Result:** A new variable row appears with `{` `}` around the name field and an input for value.
- **Step 3:** Enter variable name: `tenant_id` and value: `acme_corp_42`.
- **Step 4:** Click the Copy icon on the variable row.
  - **Result:** Toast shows "Copied {{tenant_id}}" and button indicates "Copied!".
- **Step 5:** Click **Done** or press `Escape` to close the modal popup.
  - **Result:** The modal closes and the button badge updates to `Variables 1` (or count).
- **Step 6:** Add a Header rule: Name `X-Tenant-ID`, Value `{{tenant_id}}`.
- **Step 7:** Turn profile ON and navigate to `https://httpbin.org/headers`.
  - **Result:** The outgoing request header `X-Tenant-ID` is sent as `acme_corp_42`.
- **Expected Result:** Custom variables resolve dynamically across headers, redirects, and query parameters.

---

### Test Case 15: Expand to Full Tab (Pop-Out Mode)
**Goal:** Verify opening HeaderCraft in a full browser tab for responsive wide-screen editing.

- **Step 1:** In the top header bar, click the **Expand** button (⤢ pop-out icon).
  - **Result:** A new full browser tab opens at `chrome-extension://.../popup/popup.html?fullTab=1`, and the popup window closes.
- **Step 2:** Notice the layout in the tab:
  - **Result:** Responsive spacious layout, wider cards, larger inputs, and the Expand button is hidden since you are already in a tab.
- **Step 3:** Make a change (add a rule or toggle profile).
  - **Result:** Saves immediately and persists when reopening the regular popup.
- **Expected Result:** Full Tab mode works seamlessly with responsive typography and full control.

### Test Case 16: In-App Help & Syntax Reference Modal
**Goal:** Verify the in-app help modal provides dynamic variables reference and regex syntax.

- **Step 1:** Click the **?** (Help) button in the top header.
  - **Result:** A dark modal overlay opens titled "Help & Syntax Reference".
- **Step 2:** Click the "Copy" button next to `{{$uuid}}`.
  - **Result:** Button changes to "Copied!" and copies `{{$uuid}}` to clipboard.
- **Step 3:** Under "Custom Variables", verify your custom variables are listed and can be added/edited directly from the modal.
- **Step 4:** Press the `Escape` key (or click outside the card).
  - **Result:** Modal closes cleanly.
- **Expected Result:** Help and syntax reference is easily accessible with working copy actions.

---

### Test Case 17: Multi-Workspace Isolation (Postman / Requestly Style)
**Goal:** Verify creating separate workspaces to isolate projects and environments.

- **Step 1:** In the left sidebar header, click the **Workspace Switcher** (showing `Personal ▾`).
  - **Result:** Dropdown opens showing current workspace with a checkmark `✓` and actions: `+ New Workspace`, `✏️ Rename`, `🗑️ Delete`.
- **Step 2:** Click **+ New Workspace**.
  - **Result:** An in-app prompt modal opens asking for workspace name.
- **Step 3:** Enter `Staging QA` and click **Create Workspace**.
  - **Result:** Workspace switches to `Staging QA`. The profile list updates to show an empty state for this new isolated workspace.
- **Step 4:** Click **+** to add a new profile named `Staging Headers`.
- **Step 5:** Switch back to `Personal` using the switcher.
  - **Result:** You see all your original profiles from the `Personal` workspace.
- **Step 6:** Rename `Staging QA` to `Staging Environment` using the `✏️ Rename` option.
  - **Result:** Workspace name updates immediately in the UI.
- **Expected Result:** Workspaces provide full isolation of testing profiles and folders.

---

### Test Case 18: Collapsible Folders, Drag & Drop & Direct Profile Creation
**Goal:** Verify organizing profiles inside custom collapsible folders, drag-and-drop movements, and 1-click profile creation within folders.

- **Step 1:** In the sidebar header under PROFILES, hover over the **New Folder** icon button.
  - **Result:** The tooltip "Create new folder" appears completely visible without clipping.
- **Step 2:** Click the button, enter `Auth Services`, and click **Create Folder**.
  - **Result:** A folder named `Auth Services` appears with crisp SVG folder & chevron icons, folder count `(0)`, and a quick `+` button.
- **Step 3 (Direct Profile Creation in Folder):** Hover over the `Auth Services` folder and click the quick `+` (Add profile) button.
  - **Result:** A new profile `Auth Services Profile` is immediately created inside `Auth Services`, folder auto-expands, and profile is selected for editing.
- **Step 4 (Drag & Drop into Folder):** Click and drag an existing unassigned profile from the sidebar and drop it onto `Auth Services`.
  - **Result:** The folder glows with an indigo drag-hover indicator, and upon drop, the profile moves into the folder with an instant confirmation toast.
- **Step 5 (Drag out to Root):** Drag the profile out of the folder and drop it onto the **"Drop here for Root (No Folder)"** zone.
  - **Result:** The profile moves back to the root level.
- **Step 6 (Full-Tab Expansion):** Click the **⛶ (Full Tab)** button in the header.
  - **Result:** Folder headers, SVG icons, text, and quick action buttons scale up proportionally and render sharply.
- **Expected Result:** Folders allow developers to structure complex test suites with native drag-and-drop and instant 1-click profile creation.

---

### Test Case 19: Cookie Vault (Per-Domain Session Cookie Store)
**Goal:** Verify storing, managing, and injecting persistent session cookies per domain.

- **Step 1:** In the top header bar, click the **🍪 Cookie Vault** button (or click **Cookie Vault** in the profile toolbar).
  - **Result:** The Cookie Vault modal opens with a dark modern UI, displaying the domain selector, active toggle, and cookie table.
- **Step 2:** Click **+ Add Domain**, enter `httpbin.org`, and click Add Domain.
  - **Result:** `httpbin.org` is created as an active domain store.
- **Step 3:** Click **+ Add Cookie**.
  - **Result:** A new cookie row appears. Enter Name: `hc_session_id`, Value: `auth_sec_999`, Path: `/`.
- **Step 4:** Click the 👁️ eye toggle icon next to the value.
  - **Result:** The value masks/unmasks between password dots and plain text.
- **Step 5:** Click **Paste Cookie String**. Paste `cf_token=abc12345; user_role=admin` and click **Parse & Add**.
  - **Result:** Both cookies are parsed into individual rows and the count updates to 3 cookies!
- **Step 6:** Click **📋 Copy Header**.
  - **Result:** Toast shows "Copied 'Cookie: ...' header to clipboard".
- **Step 7:** With `httpbin.org` active in Cookie Vault, visit `https://httpbin.org/cookies` in your browser.
  - **Result:** The page returns `"cookies": { "hc_session_id": "auth_sec_999", "cf_token": "abc12345", "user_role": "admin" }`!
- **Step 8:** Click **📥 Fetch from Tab** while on a logged-in site.
  - **Result:** Live browser cookies for that tab are automatically cloned into the Cookie Vault!
- **Expected Result:** Session cookies persist and auto-inject into matching domain requests without manual header crafting.

---

### Test Case 20: Expanded Universal Migration Hub (Insomnia, Bruno, OpenAPI, HAR, SoapUI)
**Goal:** Verify 1-click import of Insomnia, Bruno, OpenAPI, HAR, and SoapUI files into HeaderCraft.

- **Step 1:** In the top header bar, click the **Import Hub** icon.
- **Step 2:** In the Text tab, paste a Bruno `.bru` snippet:
  ```
  meta {
    name: Get Customer Orders
    type: http
  }
  get {
    url: https://api.store.com/v1/orders
  }
  headers {
    Authorization: Bearer test_token_xyz
    X-Client-Id: client_456
  }
  ```
  - **Result:** Live preview detects: `Detected: Bruno (.bru) File`! Click **Import as Profile**. Profile imports with URL filter `api.store.com` and both headers.
- **Step 3:** Switch to the **Upload File** tab. Confirm format cards for: **Postman**, **Insomnia**, **Bruno**, **OpenAPI**, **HAR Dump**, **SoapUI / WSDL**, and **HeaderCraft**.
- **Step 4:** Drag-and-drop or select an OpenAPI/Swagger JSON or YAML spec.
  - **Result:** Endpoints, headers, query parameters, and mock responses are extracted into an active testing profile!
- **Step 5:** Select a Chrome DevTools Network `.har` file.
  - **Result:** Reconstructs requests, headers, and extracts response payloads into Mock rules and request cookies into Cookie Vault!
- **Expected Result:** Seamless migration from all major developer API tools without rewriting tests.

---

## ✅ QA Sign-Off Criteria

Before approving for Chrome Web Store release, confirm:
1. All 20 test cases pass with expected results.
2. No errors or red warning messages appear in Chrome Developer Tools (`F12` console).
3. The popup opens in under 100 milliseconds.
4. Memory usage remains low and stable.

*Test Plan Created & Verified for HeaderCraft v1.3.0 Release Candidate.*

