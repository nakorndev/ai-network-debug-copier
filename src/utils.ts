import type { CapturedRequest, HeaderPair, ResourceType } from "./types";

type HarHeader = {
  name?: string;
  value?: string;
};

type HarPostData = {
  text?: string;
};

type HarEntry = {
  startedDateTime?: string;
  time?: number;
  timings?: Record<string, unknown>;
  _resourceType?: string;
  request?: {
    method?: string;
    url?: string;
    headers?: HarHeader[];
    queryString?: HarHeader[];
    postData?: HarPostData;
  };
  response?: {
    status?: number;
    statusText?: string;
    headers?: HarHeader[];
    content?: {
      mimeType?: string;
    };
  };
};

export const NO_REQUEST_BODY = "[No request body]";
export const NO_RESPONSE_BODY = "[No response body available]";
export const RESPONSE_BODY_UNAVAILABLE = "[Unable to read response body]";

export function normalizeRequest(
  sourceRequest: chrome.devtools.network.Request,
  sequence: number,
): CapturedRequest {
  const entry = sourceRequest as unknown as HarEntry;
  const request = entry.request ?? {};
  const response = entry.response ?? {};
  const mimeType = response.content?.mimeType ?? "";
  const url = request.url ?? "";

  return {
    id: `${Date.now()}-${sequence}`,
    startedDateTime: entry.startedDateTime,
    method: request.method ?? "GET",
    url,
    status: response.status ?? 0,
    statusText: response.statusText,
    mimeType,
    resourceType: inferResourceType(entry._resourceType, mimeType, url),
    requestHeaders: normalizePairs(request.headers),
    responseHeaders: normalizePairs(response.headers),
    queryParams: normalizePairs(request.queryString),
    requestBody: request.postData?.text,
    responseBodyLoaded: false,
    time: entry.time,
    timings: normalizeTimings(entry.timings),
    rawHarEntry: entry,
    sourceRequest,
  };
}

export function getHeader(
  headers: HeaderPair[],
  name: string,
): string | undefined {
  const lowerName = name.toLowerCase();
  return headers.find((header) => header.name.toLowerCase() === lowerName)
    ?.value;
}

export function formatDuration(time?: number): string {
  if (typeof time !== "number" || !Number.isFinite(time)) {
    return "-";
  }

  if (time < 1000) {
    return `${Math.round(time)} ms`;
  }

  return `${(time / 1000).toFixed(2)} s`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function truncateText(
  value: string | undefined,
  maxBytes: number,
  emptyText: string,
): string {
  if (!value) {
    return emptyText;
  }

  const bytes = byteLength(value);
  if (bytes <= maxBytes) {
    return value;
  }

  const maxChars = Math.max(0, Math.floor((maxBytes / bytes) * value.length));
  const truncated = value.slice(0, maxChars);
  return `${truncated}\n\n[TRUNCATED: original size ${formatBytes(bytes)}, copy limit ${formatBytes(maxBytes)}]`;
}

export function isProbablyBinary(mimeType = "", encoding?: string): boolean {
  const lowerMime = mimeType.toLowerCase();
  const lowerEncoding = encoding?.toLowerCase() ?? "";

  return (
    lowerEncoding === "base64" ||
    lowerMime.startsWith("image/") ||
    lowerMime.startsWith("audio/") ||
    lowerMime.startsWith("video/") ||
    lowerMime.includes("font") ||
    lowerMime.includes("octet-stream") ||
    lowerMime.includes("zip") ||
    lowerMime.includes("pdf")
  );
}

export function contentTypeLabel(request: CapturedRequest): string {
  return (
    getHeader(request.responseHeaders, "content-type") ??
    request.mimeType ??
    "-"
  );
}

export function statusBucket(status: number): string {
  if (status >= 200 && status < 300) return "2xx";
  if (status >= 300 && status < 400) return "3xx";
  if (status >= 400 && status < 500) return "4xx";
  if (status >= 500 && status < 600) return "5xx";
  return "other";
}

export function isFailedStatus(status: number): boolean {
  return status === 0 || status >= 400;
}

export function pathFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export function pairsToRecord(pairs: HeaderPair[]): Record<string, string> {
  return pairs.reduce<Record<string, string>>((record, pair) => {
    record[pair.name] = pair.value;
    return record;
  }, {});
}

function normalizePairs(pairs: HarHeader[] | undefined): HeaderPair[] {
  return (pairs ?? []).map((pair) => ({
    name: pair.name ?? "",
    value: pair.value ?? "",
  }));
}

function normalizeTimings(
  timings: Record<string, unknown> | undefined,
): Record<string, number> | undefined {
  if (!timings) {
    return undefined;
  }

  return Object.entries(timings).reduce<Record<string, number>>(
    (output, [key, value]) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        output[key] = value;
      }
      return output;
    },
    {},
  );
}

function inferResourceType(
  resourceType = "",
  mimeType = "",
  url = "",
): ResourceType {
  const normalized = resourceType.toLowerCase();
  const lowerMime = mimeType.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (normalized === "xhr" || normalized === "fetch") return "fetch-xhr";
  if (normalized === "document") return "document";
  if (normalized === "script") return "script";
  if (normalized === "stylesheet") return "stylesheet";
  if (normalized === "image") return "image";

  if (lowerMime.includes("json") || lowerUrl.includes("/api/"))
    return "fetch-xhr";
  if (lowerMime.includes("html")) return "document";
  if (lowerMime.includes("javascript")) return "script";
  if (lowerMime.includes("css")) return "stylesheet";
  if (lowerMime.startsWith("image/")) return "image";

  return "other";
}
