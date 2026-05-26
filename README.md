# ai-network-debug-copier

Local-first Chrome DevTools extension that captures Network requests and copies one selected request as an AI-friendly debug bundle.

## Screenshot

Screenshot placeholder:

```text
Chrome DevTools > AI Network panel > request list + selected request detail + copy buttons
```

## Why this exists

Debugging HTTP issues with AI tools often requires copying the important parts of one request: URL, method, headers, request body, response body, status, and timing. Chrome DevTools already sees this data, but it is easy to copy it incompletely.

This extension adds a custom DevTools panel named `AI Network`. It does not modify Chrome's built-in Network request context menu.

## Features

- Custom Chrome DevTools panel: `AI Network`
- Captures finished Network requests while DevTools is open
- Compact request list with method, status, URL/path, MIME type, duration, and resource type
- Filters by URL/search text, status bucket, resource type, and failed requests
- Request detail view with headers, query params, bodies, and timing
- Copy one selected request as AI-friendly Markdown
- Copy structured JSON
- Copy a best-effort cURL command
- Redacts sensitive headers and JSON body keys by default
- Optional `Include sensitive values` toggle with an in-panel warning
- In-memory only; no backend, telemetry, analytics, sync, or remote code

## Installation

```bash
npm install
npm run build
```

Then load the unpacked extension:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click `Load unpacked`.
4. Select the built extension directory: `dist`.
5. Open DevTools on a page.
6. Open the `AI Network` panel.
7. Reload or reproduce the issue.
8. Select one request and click `Copy AI Markdown`.

## Development setup

```bash
npm install
npm run dev
```

For actual Chrome extension loading, use the production build:

```bash
npm run build
```

Available scripts:

- `npm run dev` starts Vite for local development.
- `npm run build` creates the unpacked extension in `dist`.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run lint` currently aliases TypeScript checking.
- `npm run format` formats the repo with Prettier.
- `npm run test:manual` starts a small local HTTP server for manual request testing.

## Usage workflow

1. Open the page you want to debug.
2. Open Chrome DevTools.
3. Open the `AI Network` panel.
4. Reproduce the issue or reload the page.
5. Use filters to find the relevant request.
6. Select one request.
7. Review the redacted detail view.
8. Click `Copy AI Markdown`, `Copy JSON`, or `Copy cURL`.

## What data is captured

The extension captures request and response metadata provided by the Chrome DevTools Network API:

- Method
- URL
- Status and status text
- Request headers
- Query parameters
- Request body or post data when available
- Response headers
- Response body from `request.getContent()` when available
- MIME type
- Resource type
- Timing data

Captured data is stored only in the DevTools panel memory. It is cleared when DevTools closes or when you click `Clear`.

## Redaction behavior

Secrets are redacted by default. Field names are preserved and sensitive values are replaced with `[REDACTED]`.

Sensitive headers include:

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

Sensitive JSON body keys include names containing:

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

For non-JSON bodies, the extension applies conservative token-like text redaction patterns. This is helpful, but not a guarantee. Always review copied bundles before sharing them.

## Security and privacy

- No remote network calls are made by the extension.
- No telemetry, analytics, tracking, cloud sync, or external CDN scripts are included.
- No backend is required.
- No captured request data is persisted by default.
- Captured requests remain in memory only while the DevTools panel is open.
- The manifest requests no extra Chrome permissions.

Important: this extension can view sensitive request and response data while DevTools is open. Do not publish debug bundles that contain secrets, tokens, cookies, personal data, private URLs, customer data, or internal system details.

## Known limitations

- Only captures requests while DevTools is open and the panel listener is active.
- Some requests may be missing if DevTools was opened after page load; reload the page.
- Response body availability depends on Chrome DevTools API behavior and resource type.
- Binary responses are not intended for readable copy output.
- This is not a replacement for a full HAR when debugging complex multi-request flows.
- It does not modify Chrome's native Network panel context menu.
- cURL output is best-effort and may need manual cleanup for complex browser requests.

## Manual testing

Start the manual test server:

```bash
npm run test:manual
```

Open `http://127.0.0.1:8787`, open DevTools, open the `AI Network` panel, then click the page buttons to generate:

- GET request with query params
- POST JSON request with `password` and `token` fields
- 400, 401, and 500 responses
- JSON response
- text response
- missing response body
- large response body
- request headers containing `Authorization`

## Roadmap

- Export a small selected-request HAR subset
- Add keyboard shortcuts inside the panel
- Add optional per-session copy templates
- Add tests for redaction helpers and formatters
- Add optional user-defined redaction keys

## Contributing

Keep the project local-first and privacy-conscious. Prefer simple TypeScript, HTML, and CSS over framework complexity. Do not add remote telemetry, external scripts, broad Chrome permissions, or persistent captured-data storage by default.

## License

MIT
