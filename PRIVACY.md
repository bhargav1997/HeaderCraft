# HeaderCraft Privacy Policy

**Last updated: September 25, 2026**

## Overview

HeaderCraft ("the extension") is a Chrome browser extension that allows users to add, modify, and remove HTTP request and response headers for specified URLs. This policy describes what data the extension handles and how.

## Data Collected

**HeaderCraft collects no personal data.**

The extension stores the following information exclusively in `chrome.storage.local` on your local device:

- **Profile names** you create (e.g., "Staging QA")
- **Header names and values** you configure (e.g., `Authorization: Bearer <token>`)
- **URL filter patterns** you specify
- **Profile settings** (enabled/disabled state, regex mode)

This information is necessary for the extension to function. It is:
- Stored only on your device
- Never transmitted to any external server
- Never shared with any third party
- Never used for advertising, analytics, or any purpose other than applying your configured header rules

## Data We Do NOT Collect

- We do not collect your browsing history
- We do not read the content of web pages you visit
- We do not log network requests
- We do not use analytics or crash-reporting SDKs
- We have no backend server

## Permissions Used

- **`declarativeNetRequest`**: Allows Chrome to apply your header rules at the browser level. Your actual network traffic is never exposed to the extension's code.
- **`storage`**: Allows saving your profiles to `chrome.storage.local` on your device.
- **`<all_urls>`** (host permission): Required because users configure rules for arbitrary domains. Chrome applies rules internally; extension code never reads request data.

## Data Deletion

You can delete all stored data at any time by:
1. Opening the extension popup and deleting all profiles, or
2. Uninstalling the extension (Chrome automatically removes all `chrome.storage.local` data on uninstall)

## Changes to This Policy

If this policy changes materially, we will update the "Last updated" date and publish the change in the GitHub repository.

## Contact

For questions or concerns: [your@email.com]  
GitHub Issues: https://github.com/[your-handle]/headercraft/issues
