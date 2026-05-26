import "./panel.css";

import { formatJson } from "./formatters/json";
import { formatMarkdown } from "./formatters/markdown";
import { prepareRequestForCopy } from "./redact";
import type { CapturedRequest, HeaderPair, ResourceType } from "./types";
import {
  NO_RESPONSE_BODY,
  RESPONSE_BODY_UNAVAILABLE,
  contentTypeLabel,
  formatDuration,
  isFailedStatus,
  isProbablyBinary,
  normalizeRequest,
  pathFromUrl,
  statusBucket,
} from "./utils";

const requests: CapturedRequest[] = [];

let sequence = 0;
let selectedRequestId: string | null = null;

const elements = {
  statusText: byId("statusText", HTMLElement),
  includeSensitive: byId("includeSensitive", HTMLInputElement),
  sensitiveWarning: byId("sensitiveWarning", HTMLElement),
  copyLimit: byId("copyLimit", HTMLSelectElement),
  clearButton: byId("clearButton", HTMLButtonElement),
  searchInput: byId("searchInput", HTMLInputElement),
  statusFilter: byId("statusFilter", HTMLSelectElement),
  typeFilter: byId("typeFilter", HTMLSelectElement),
  failedOnly: byId("failedOnly", HTMLInputElement),
  requestRows: byId("requestRows", HTMLElement),
  emptyState: byId("emptyState", HTMLElement),
  detailsTitle: byId("detailsTitle", HTMLElement),
  detailsMeta: byId("detailsMeta", HTMLElement),
  detailContent: byId("detailContent", HTMLElement),
  copyStatus: byId("copyStatus", HTMLElement),
  copyMarkdown: byId("copyMarkdown", HTMLButtonElement),
  copyJson: byId("copyJson", HTMLButtonElement),
  copyCurl: byId("copyCurl", HTMLButtonElement),
};

chrome.devtools.network.onRequestFinished.addListener((sourceRequest) => {
  const captured = normalizeRequest(sourceRequest, sequence++);
  requests.unshift(captured);

  if (!selectedRequestId) {
    selectedRequestId = captured.id;
    void loadResponseBody(captured).then(render);
  }

  render();
});

elements.searchInput.addEventListener("input", render);
elements.statusFilter.addEventListener("change", render);
elements.typeFilter.addEventListener("change", render);
elements.failedOnly.addEventListener("change", render);
elements.copyLimit.addEventListener("change", renderSelectedDetails);

elements.includeSensitive.addEventListener("change", () => {
  elements.sensitiveWarning.hidden = !elements.includeSensitive.checked;
  renderSelectedDetails();
});

elements.clearButton.addEventListener("click", () => {
  requests.length = 0;
  selectedRequestId = null;
  render();
});

elements.copyMarkdown.addEventListener("click", () => copySelected("markdown"));
elements.copyJson.addEventListener("click", () => copySelected("json"));
elements.copyCurl.addEventListener("click", () => copySelected("curl"));

render();

function render(): void {
  renderList();
  renderSelectedDetails();
  elements.statusText.textContent = `${requests.length} request${requests.length === 1 ? "" : "s"} captured. Data is memory-only.`;
}

function renderList(): void {
  const visibleRequests = filteredRequests();
  elements.requestRows.textContent = "";
  elements.emptyState.classList.toggle("visible", visibleRequests.length === 0);

  const fragment = document.createDocumentFragment();

  for (const request of visibleRequests) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `request-row${request.id === selectedRequestId ? " selected" : ""}`;
    row.title = request.url;
    row.dataset.requestId = request.id;
    row.innerHTML = `
      <span class="method">${escapeHtml(request.method)}</span>
      <span class="status ${isFailedStatus(request.status) ? "failed" : "ok"}">${request.status || "-"}</span>
      <span class="url">${escapeHtml(pathFromUrl(request.url))}</span>
      <span class="mime">${escapeHtml(request.mimeType ?? "-")}</span>
      <span class="duration">${escapeHtml(formatDuration(request.time))}</span>
      <span class="type">${escapeHtml(request.resourceType)}</span>
    `;

    row.addEventListener("click", () => {
      selectedRequestId = request.id;
      render();
      void loadResponseBody(request).then(renderSelectedDetails);
    });

    fragment.append(row);
  }

  elements.requestRows.append(fragment);
}

function renderSelectedDetails(): void {
  const request = selectedRequest();
  const hasSelection = Boolean(request);

  elements.copyMarkdown.disabled = !hasSelection;
  elements.copyJson.disabled = !hasSelection;
  elements.copyCurl.disabled = !hasSelection;

  if (!request) {
    elements.detailsTitle.textContent = "Select a request";
    elements.detailsMeta.textContent = "No request selected.";
    elements.detailContent.textContent = "";
    elements.copyStatus.textContent = "";
    return;
  }

  const copyLimit = currentCopyLimitBytes();
  const prepared = prepareRequestForCopy(
    request,
    elements.includeSensitive.checked,
    copyLimit,
  );
  const displayRequest = prepared.value;

  elements.detailsTitle.textContent = `${request.method} ${pathFromUrl(request.url)}`;
  elements.detailsMeta.textContent = `${request.status || "-"} ${request.statusText ?? ""} · ${contentTypeLabel(request)} · ${formatDuration(request.time)}`;
  elements.copyStatus.textContent = prepared.redacted
    ? "Sensitive values are redacted in this view and copied output."
    : elements.includeSensitive.checked
      ? "Sensitive value redaction is disabled."
      : "No sensitive values were detected by the redaction rules.";

  elements.detailContent.innerHTML = [
    renderSummary(displayRequest),
    renderPairSection("Request Headers", displayRequest.requestHeaders),
    renderPairSection("Query Parameters", displayRequest.queryParams),
    renderTextSection(
      "Request Body",
      displayRequest.requestBody ?? "[No request body]",
    ),
    renderPairSection("Response Headers", displayRequest.responseHeaders),
    renderTextSection(
      "Response Body",
      displayRequest.responseBody ?? responseBodyPlaceholder(request),
    ),
    renderTiming(displayRequest.timings),
  ].join("");
}

async function copySelected(
  format: "markdown" | "json" | "curl",
): Promise<void> {
  const request = selectedRequest();
  if (!request) {
    return;
  }

  await loadResponseBody(request);

  const prepared = prepareRequestForCopy(
    request,
    elements.includeSensitive.checked,
    currentCopyLimitBytes(),
  );
  const copyText =
    format === "markdown"
      ? formatMarkdown(prepared.value, prepared.redacted)
      : format === "json"
        ? formatJson(prepared.value, prepared.redacted)
        : formatCurl(prepared.value);

  try {
    await navigator.clipboard.writeText(copyText);
    elements.copyStatus.textContent = `Copied ${format === "markdown" ? "AI Markdown" : format.toUpperCase()}${prepared.redacted ? " with redactions." : "."}`;
  } catch (error) {
    elements.copyStatus.textContent = `Clipboard copy failed: ${error instanceof Error ? error.message : "unknown error"}`;
  }

  renderSelectedDetails();
}

function filteredRequests(): CapturedRequest[] {
  const search = elements.searchInput.value.trim().toLowerCase();
  const status = elements.statusFilter.value;
  const type = elements.typeFilter.value as ResourceType | "all";
  const failedOnly = elements.failedOnly.checked;

  return requests.filter((request) => {
    const matchesSearch =
      !search ||
      `${request.method} ${request.status} ${request.url} ${request.mimeType ?? ""} ${request.resourceType}`
        .toLowerCase()
        .includes(search);
    const matchesStatus =
      status === "all" || statusBucket(request.status) === status;
    const matchesType = type === "all" || request.resourceType === type;
    const matchesFailure = !failedOnly || isFailedStatus(request.status);

    return matchesSearch && matchesStatus && matchesType && matchesFailure;
  });
}

async function loadResponseBody(request: CapturedRequest): Promise<void> {
  if (request.responseBodyLoaded || !request.sourceRequest) {
    return;
  }

  request.responseBodyLoaded = true;

  try {
    const [content, encoding] = await new Promise<
      [string | undefined, string | undefined]
    >((resolve) => {
      request.sourceRequest?.getContent((body, bodyEncoding) =>
        resolve([body, bodyEncoding]),
      );
    });

    request.responseBodyEncoding = encoding;

    if (!content) {
      request.responseBody = NO_RESPONSE_BODY;
      return;
    }

    if (isProbablyBinary(request.mimeType, encoding)) {
      request.responseBody = `[Binary or encoded response omitted. MIME type: ${request.mimeType || "unknown"}; encoding: ${
        encoding || "none"
      }; size: ${content.length} characters]`;
      return;
    }

    request.responseBody = content;
  } catch (error) {
    request.responseBodyError =
      error instanceof Error ? error.message : "Unknown error";
    request.responseBody = RESPONSE_BODY_UNAVAILABLE;
  }
}

function selectedRequest(): CapturedRequest | undefined {
  return requests.find((request) => request.id === selectedRequestId);
}

function currentCopyLimitBytes(): number {
  return Number(elements.copyLimit.value) * 1024;
}

function responseBodyPlaceholder(request: CapturedRequest): string {
  if (request.responseBodyError) {
    return `${RESPONSE_BODY_UNAVAILABLE}: ${request.responseBodyError}`;
  }

  return request.responseBodyLoaded
    ? NO_RESPONSE_BODY
    : "[Response body loads when selected or copied]";
}

function renderSummary(request: CapturedRequest): string {
  return `<section class="detail-section">
    <h3>Summary</h3>
    <dl class="kv-grid">
      <dt>Method</dt><dd>${escapeHtml(request.method)}</dd>
      <dt>URL</dt><dd>${escapeHtml(request.url)}</dd>
      <dt>Status</dt><dd>${request.status} ${escapeHtml(request.statusText ?? "")}</dd>
      <dt>MIME</dt><dd>${escapeHtml(request.mimeType ?? "-")}</dd>
      <dt>Content Type</dt><dd>${escapeHtml(contentTypeLabel(request))}</dd>
      <dt>Resource Type</dt><dd>${escapeHtml(request.resourceType)}</dd>
      <dt>Duration</dt><dd>${escapeHtml(formatDuration(request.time))}</dd>
      <dt>Started At</dt><dd>${escapeHtml(request.startedDateTime ?? "-")}</dd>
    </dl>
  </section>`;
}

function renderPairSection(title: string, pairs: HeaderPair[]): string {
  const text =
    pairs.length === 0
      ? "[None]"
      : pairs.map((pair) => `${pair.name}: ${pair.value}`).join("\n");
  return renderTextSection(title, text);
}

function renderTextSection(title: string, value: string): string {
  return `<section class="detail-section">
    <h3>${escapeHtml(title)}</h3>
    <pre>${escapeHtml(value)}</pre>
  </section>`;
}

function renderTiming(timings?: Record<string, number>): string {
  const text =
    !timings || Object.keys(timings).length === 0
      ? "[No timing data]"
      : Object.entries(timings)
          .map(([key, value]) => `${key}: ${value} ms`)
          .join("\n");

  return renderTextSection("Timing", text);
}

function formatCurl(request: CapturedRequest): string {
  const lines = [`curl ${shellQuote(request.url)}`];

  for (const header of request.requestHeaders) {
    lines.push(`  -H ${shellQuote(`${header.name}: ${header.value}`)}`);
  }

  if (request.requestBody && request.requestBody !== "[No request body]") {
    lines.push(`  --data-raw ${shellQuote(request.requestBody)}`);
  }

  if (request.method.toUpperCase() !== "GET" || request.requestBody) {
    lines.push(`  -X ${shellQuote(request.method)}`);
  }

  return lines.join(" \\\n");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function byId<T extends typeof HTMLElement>(
  id: string,
  constructor: T,
): InstanceType<T> {
  const element = document.getElementById(id);
  if (!(element instanceof constructor)) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as InstanceType<T>;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return character;
    }
  });
}
