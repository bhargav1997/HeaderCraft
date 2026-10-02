# HeaderCraft Dev Privacy Policy

**Last updated: October 2, 2026**

## Overview

HeaderCraft Dev ("HeaderCraft", "the extension") is a developer and QA testing browser extension that allows users to configure HTTP header modifications, URL redirects, query-parameter rules, API mocks, and session-cookie testing workflows.

HeaderCraft is designed to operate locally in the browser. The extension does not operate a backend service for collecting or analyzing user data and does not use third-party advertising, analytics, or tracking services.

## 1. Information Handled by HeaderCraft

HeaderCraft may process and store information that users voluntarily configure or provide through the extension's developer-testing features.

This may include:

* **Workspaces and Folders:** Names, organization settings, and configuration data used to organize testing profiles.
* **Profiles and Rules:** User-created HTTP header rules, URL redirect rules, query-parameter rules, and mock-response configurations.
* **Variables:** User-defined testing variables, which may contain values such as environment names, API keys, tokens, timestamps, or other test data.
* **Cookie Vault:** Cookies that the user chooses to view, import, create, store, or restore for supported testing workflows.
* **Imported Files:** Data contained in files imported by the user, such as Postman collections, Insomnia workspaces, Bruno collections, HAR files, OpenAPI/Swagger specifications, SoapUI/WSDL files, or cURL commands.

Imported files are processed locally by the extension. They are not uploaded to a HeaderCraft server.

## 2. Data Storage

HeaderCraft uses Chrome's extension storage mechanisms to store user configuration and testing data locally on the user's device.

Depending on the feature being used, locally stored information may include testing rules, workspaces, variables, mock responses, and Cookie Vault data.

Some user-provided testing data may contain sensitive information, such as authentication tokens or session cookies. Users should avoid storing credentials that are not necessary for their testing workflows.

## 3. Information HeaderCraft Does Not Collect

HeaderCraft does not:

* Sell user data.
* Use user data for advertising.
* Use third-party advertising or tracking services.
* Use third-party analytics or metrics SDKs.
* Maintain a cloud database containing user profiles, rules, or cookies.
* Transmit Cookie Vault data to HeaderCraft servers.
* Transmit imported files to HeaderCraft servers.
* Collect browsing history for analytics or profiling purposes.

HeaderCraft does not intentionally collect or transmit the contents of web pages for purposes unrelated to its developer-testing functionality.

## 4. Network and Cookie Access

HeaderCraft provides network-testing functionality that may require access to requests, responses, URLs, headers, and cookies associated with domains selected or configured by the user.

This access is necessary to provide features such as:

* HTTP header modification.
* URL redirection.
* Query-parameter modification.
* API mocking.
* Cookie Vault functionality.
* Local development and QA testing.

Cookie functionality uses Chrome's Cookies API to access and modify cookies for hosts for which the extension has the required host permissions.

HeaderCraft processes this information only as necessary to provide the configured developer-testing functionality.

## 5. Chrome Permissions

### `declarativeNetRequest`

Used to apply user-configured network rules, including supported HTTP header modifications and URL redirects.

### `storage`

Used to store user-created workspaces, folders, profiles, rules, variables, mock configurations, and other extension settings locally.

### `cookies`

Used by Cookie Vault to read, create, update, and remove cookies for supported testing domains. This enables developers and QA testers to reproduce authenticated browser sessions during testing.

### `alarms`

Used for local scheduled extension tasks, such as automatically disabling temporary testing profiles.

### Host Permissions

Host permissions are required so HeaderCraft can apply configured network-testing rules to the websites and API endpoints selected by the user, including development, staging, localhost, and other testing environments.

## 6. Data Sharing

HeaderCraft does not sell or share user data with advertisers, analytics providers, data brokers, or other third parties.

The extension does not provide a HeaderCraft cloud service for uploading user testing data.

If a future version introduces a service that transmits or processes user data remotely, this Privacy Policy will be updated before that functionality is introduced.

## 7. Data Deletion

Users can delete their locally stored HeaderCraft data through the extension's available deletion controls.

Users can also remove the extension from Chrome. Extension-managed local storage is removed as part of Chrome's extension data lifecycle when the extension is uninstalled.

Cookies created or modified through Chrome's Cookies API may have their own browser cookie lifecycle and should be removed through the extension or Chrome's cookie controls where applicable.

## 8. Security

HeaderCraft is designed to minimize external data exposure by processing developer-testing configurations locally in Chrome and by not transmitting those configurations to HeaderCraft servers.

Users are responsible for protecting sensitive values they choose to store in testing profiles, variables, or Cookie Vault.

## 9. Changes to This Privacy Policy

This Privacy Policy may be updated when HeaderCraft's functionality, permissions, or data practices change.

The "Last updated" date will be revised when material changes are made.

## 10. Contact

For questions, privacy concerns, or support:

**GitHub Repository:**
https://github.com/bhargav1997/HeaderCraft

Users may also contact the developer through the support information provided on the Chrome Web Store listing.
