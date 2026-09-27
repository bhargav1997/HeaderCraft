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

### Test Case 8: API Response Mock Interceptor
**Goal:** Intercept API network calls and return fake JSON mock data or error codes (200, 404, 500).

- **Step 1:** Click the **Mocks** tab in HeaderCraft.
- **Step 2:** Click **+ Add Mock** (or select Preset **Mock 500 Server Error**).
- **Step 3:** Set:
  - URL Filter: `https://httpbin.org/get`
  - Status Code: `500`
  - Response Body: `{"error": "Internal Server Error", "mockedBy": "HeaderCraft"}`
- **Step 4:** Visit `https://httpbin.org/get` in your browser.
- **Expected Result:** Instead of the normal page, you get a 500 error response with body `{"error": "Internal Server Error", "mockedBy": "HeaderCraft"}`!
- **Step 5:** Turn OFF the mock rule toggle and refresh — normal page restores.

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

### Test Case 12: Profile Export & Import (JSON & ModHeader/Requestly)
**Goal:** Verify exporting your configuration and restoring it from a file.

- **Step 1:** Click the **Export** icon (⬇️ arrow pointing down to container) in top header bar.
  - **Result:** A file named `headercraft-profile-default-profile.json` downloads to your computer.
- **Step 2:** Delete a rule from HeaderCraft.
- **Step 3:** Click the **Import JSON** icon (⬆️ arrow pointing up) in top header bar.
- **Step 4:** Select the downloaded JSON file.
  - **Result:** Toast notice "Profile imported successfully" appears, and your deleted rule is fully restored!
- **Step 5:** Click the **Import ModHeader / Requestly** icon (plus icon inside circle). Select any ModHeader or Requestly export file.
  - **Result:** Rules are automatically converted and imported into HeaderCraft.
- **Expected Result:** Exporting and importing works flawlessly without losing settings.

---

### Test Case 13: Share Link & URL Import Modal
**Goal:** Verify sharing a profile via a lightweight URL or code link.

- **Step 1:** Click the **Share profile** link icon (🔗 link icon) in top header bar.
  - **Result:** A modal popup opens showing a share link (e.g. `https://headercraft.dev/import#...`) and a short import code.
- **Step 2:** Click **Copy Link**.
  - **Result:** Toast notice "Copied link to clipboard" appears.
- **Step 3:** Click the **Import from Link** icon (link with plus) in header bar.
- **Step 4:** Paste the link into the box and click **Import Profile**.
  - **Result:** Profile is created and populated with all shared rules!
- **Expected Result:** Sharing and receiving profiles via stateless URLs works without any external server required.

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

---

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

## ✅ QA Sign-Off Criteria

Before approving for Chrome Web Store release, confirm:
1. All 16 test cases pass with expected results.
2. No errors or red warning messages appear in Chrome Developer Tools (`F12` console).
3. The popup opens in under 100 milliseconds.
4. Memory usage remains low and stable.

*Test Plan Created & Verified for HeaderCraft v1.3.0 Release Candidate.*

