# AGENTS.md

Instructions for future AI coding agents working in this repository.

## Project purpose

`ai-network-debug-copier` is a local-first Chrome DevTools extension. It captures Network requests visible to DevTools and lets the user copy one selected request as an AI-friendly debug bundle.

The core user workflow is:

1. Open Chrome DevTools.
2. Open the `AI Network` panel.
3. Reproduce the issue.
4. Select one request.
5. Copy Markdown, JSON, or cURL.

## Non-goals

- Do not inject custom items into Chrome's built-in Network panel context menu.
- Do not build a backend service.
- Do not add account login, cloud sync, remote storage, or telemetry.
- Do not turn this into a full HAR analysis suite.
- Do not add framework complexity unless it clearly reduces maintenance cost.

## Architecture

- Chrome Extension Manifest V3.
- `devtools_page` registers a custom DevTools panel.
- `chrome.devtools.panels.create` creates the `AI Network` panel.
- `chrome.devtools.network.onRequestFinished` captures finished network requests.
- `request.getContent()` loads response bodies lazily after selection/copy.
- Captured requests are normalized into a small internal model.
- Redaction happens before display/copy unless `Include sensitive values` is enabled.
- Captured data is stored only in panel memory.

## File map

- `public/manifest.json`: Chrome extension manifest.
- `src/devtools.html`: DevTools page entry HTML.
- `src/devtools.ts`: Creates the `AI Network` panel.
- `src/panel.html`: Panel UI markup.
- `src/panel.ts`: Request capture, state, filtering, detail rendering, and copy actions.
- `src/panel.css`: Compact DevTools-style UI.
- `src/types.ts`: Internal TypeScript types.
- `src/utils.ts`: HAR normalization, formatting helpers, resource-type helpers.
- `src/redact.ts`: Header, JSON body, and text redaction.
- `src/formatters/markdown.ts`: AI Markdown output.
- `src/formatters/json.ts`: Structured JSON output.
- `tests/manual-server.mjs`: Local manual test server.
- `README.md`: Public project documentation.

## Chrome extension constraints

- Keep manifest permissions minimal.
- Prefer no `host_permissions`.
- Prefer no background worker unless a future feature strictly needs it.
- Do not request broader Chrome permissions than necessary.
- Do not load scripts from CDNs or remote origins.
- The extension must work as an unpacked extension from `dist`.

## Security and privacy rules

- Do not add remote telemetry.
- Do not add analytics.
- Do not add tracking.
- Do not add external scripts from CDN.
- Do not store captured request data persistently by default.
- Do not require a backend.
- Do not weaken redaction defaults.
- Do not log sensitive request data to the console.
- Keep captured requests in memory only unless the user explicitly approves a storage feature.
- Make privacy and redaction tradeoffs visible in the UI and README.

## Redaction rules

Redaction must preserve field names and replace sensitive values with `[REDACTED]`.

Sensitive header names include or equal:

- `authorization`
- `cookie`
- `set-cookie`
- `x-api-key`
- `api-key`
- `x-auth-token`
- `x-access-token`
- `x-refresh-token`
- `csrf-token`
- `x-csrf-token`
- `x-xsrf-token`
- `proxy-authorization`

Sensitive body keys include or equal:

- `password`
- `pass`
- `token`
- `access_token`
- `refresh_token`
- `id_token`
- `secret`
- `client_secret`
- `api_key`
- `apikey`
- `authorization`
- `cookie`
- `session`
- `csrf`
- `xsrf`
- `jwt`
- `private_key`

Redaction should work recursively for JSON bodies. Non-JSON token-pattern redaction should stay conservative to avoid corrupting useful debug text.

## UI/UX rules

- Keep the UI compact and DevTools-like.
- Use clear buttons: `Copy AI Markdown`, `Copy JSON`, `Copy cURL`, `Clear`.
- Markdown is the primary copy format.
- Show whether redaction happened.
- Default `Include sensitive values` to off.
- Show a warning when `Include sensitive values` is on.
- Use monospace blocks for headers and bodies.
- Avoid visual clutter.
- Keep light/dark mode friendly through CSS variables.
- Do not add a landing page or marketing surface inside the extension.

## Coding style

- Use plain TypeScript, HTML, and CSS.
- Keep modules small and purpose-specific.
- Prefer browser APIs and small helpers over dependencies.
- Keep strict TypeScript passing.
- Avoid unrelated refactors.
- Preserve the smallest clean implementation that satisfies the user workflow.
- Prefer explicit names over clever abstractions.

## Testing checklist

Use `npm run typecheck` and `npm run build` when verification is requested or before release.

Manual request cases to cover:

- GET request with query params
- POST JSON request
- 400, 401, and 500 responses
- JSON response
- text response
- missing response body
- large response body
- headers containing `Authorization` or `Cookie`
- body containing `password`, `token`, or nested secret fields

## Manual QA checklist

1. Run `npm install`.
2. Run `npm run build`.
3. Load `dist` in `chrome://extensions`.
4. Open DevTools on a test page.
5. Open the `AI Network` panel.
6. Reload or trigger requests.
7. Confirm requests appear.
8. Confirm filters work.
9. Select a request.
10. Confirm response body loads when available.
11. Copy Markdown and confirm sensitive values are redacted.
12. Toggle `Include sensitive values` and confirm warning appears.
13. Copy JSON and cURL.
14. Click `Clear` and confirm memory is cleared.

## Do-not-do list

- Do not add remote telemetry.
- Do not add external scripts from CDN.
- Do not store captured request data persistently by default.
- Do not weaken redaction defaults.
- Do not require a backend.
- Do not request broader Chrome permissions than necessary.
- Do not add React or another framework without a strong maintenance reason.
- Do not mutate Chrome's native Network panel context menu.
- Do not make copied output include secrets by default.
- Do not publish real sensitive debug bundles in docs, tests, issues, or screenshots.
