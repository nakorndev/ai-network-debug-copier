import type { CapturedRequest, HeaderPair, RedactionResult } from "./types";
import { NO_REQUEST_BODY, NO_RESPONSE_BODY, truncateText } from "./utils";

const SENSITIVE_HEADER_NAMES = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "api-key",
  "x-auth-token",
  "x-access-token",
  "x-refresh-token",
  "csrf-token",
  "x-csrf-token",
  "x-xsrf-token",
  "proxy-authorization",
];

const SENSITIVE_BODY_KEYS = [
  "password",
  "pass",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "secret",
  "client_secret",
  "api_key",
  "apikey",
  "authorization",
  "cookie",
  "session",
  "csrf",
  "xsrf",
  "jwt",
  "private_key",
];

const TOKEN_PATTERNS = [
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,
  /\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g,
  /\b(?:token|secret|api[_-]?key|password)=([^&\s]+)/gi,
];

export function prepareRequestForCopy(
  request: CapturedRequest,
  includeSensitiveValues: boolean,
  maxBodyBytes: number,
): RedactionResult<CapturedRequest> {
  let redacted = false;

  const requestHeaders = redactHeaders(
    request.requestHeaders,
    includeSensitiveValues,
  );
  const responseHeaders = redactHeaders(
    request.responseHeaders,
    includeSensitiveValues,
  );
  const queryParams = redactHeaders(
    request.queryParams,
    includeSensitiveValues,
  );
  const requestBody = prepareBody(
    request.requestBody,
    includeSensitiveValues,
    maxBodyBytes,
    NO_REQUEST_BODY,
  );
  const responseBody = prepareBody(
    request.responseBody,
    includeSensitiveValues,
    maxBodyBytes,
    NO_RESPONSE_BODY,
  );

  redacted =
    requestHeaders.redacted ||
    responseHeaders.redacted ||
    queryParams.redacted ||
    requestBody.redacted ||
    responseBody.redacted;

  return {
    value: {
      ...request,
      requestHeaders: requestHeaders.value,
      responseHeaders: responseHeaders.value,
      queryParams: queryParams.value,
      requestBody: requestBody.value,
      responseBody: responseBody.value,
      sourceRequest: undefined,
      rawHarEntry: undefined,
    },
    redacted,
  };
}

export function redactHeaders(
  headers: HeaderPair[],
  includeSensitiveValues: boolean,
): RedactionResult<HeaderPair[]> {
  if (includeSensitiveValues) {
    return { value: headers, redacted: false };
  }

  let redacted = false;
  const value = headers.map((header) => {
    if (!isSensitiveHeaderName(header.name)) {
      return header;
    }

    redacted = true;
    return { ...header, value: "[REDACTED]" };
  });

  return { value, redacted };
}

export function prepareBody(
  body: string | undefined,
  includeSensitiveValues: boolean,
  maxBodyBytes: number,
  emptyText: string,
): RedactionResult<string> {
  const truncated = truncateText(body, maxBodyBytes, emptyText);
  if (
    includeSensitiveValues ||
    truncated === emptyText ||
    truncated.includes("[TRUNCATED:")
  ) {
    return { value: truncated, redacted: false };
  }

  const jsonResult = tryRedactJson(truncated);
  if (jsonResult) {
    return jsonResult;
  }

  return redactTextPatterns(truncated);
}

function tryRedactJson(body: string): RedactionResult<string> | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    const result = redactJsonValue(parsed);
    return {
      value: JSON.stringify(result.value, null, 2),
      redacted: result.redacted,
    };
  } catch {
    return null;
  }
}

function redactJsonValue(
  value: unknown,
  keyName = "",
): RedactionResult<unknown> {
  if (isSensitiveBodyKey(keyName)) {
    return { value: "[REDACTED]", redacted: true };
  }

  if (Array.isArray(value)) {
    let redacted = false;
    const arrayValue = value.map((item) => {
      const result = redactJsonValue(item);
      redacted ||= result.redacted;
      return result.value;
    });
    return { value: arrayValue, redacted };
  }

  if (value && typeof value === "object") {
    let redacted = false;
    const objectValue = Object.entries(value as Record<string, unknown>).reduce<
      Record<string, unknown>
    >((output, [key, item]) => {
      const result = redactJsonValue(item, key);
      redacted ||= result.redacted;
      output[key] = result.value;
      return output;
    }, {});
    return { value: objectValue, redacted };
  }

  return { value, redacted: false };
}

function redactTextPatterns(value: string): RedactionResult<string> {
  let redacted = false;
  let output = value;

  for (const pattern of TOKEN_PATTERNS) {
    output = output.replace(
      pattern,
      (match: string, prefixOrValue?: string) => {
        redacted = true;
        if (match.includes("=") && prefixOrValue) {
          return match.replace(prefixOrValue, "[REDACTED]");
        }
        return "[REDACTED]";
      },
    );
  }

  return { value: output, redacted };
}

function isSensitiveHeaderName(name: string): boolean {
  const lowerName = name.toLowerCase();
  return SENSITIVE_HEADER_NAMES.some(
    (sensitiveName) =>
      lowerName === sensitiveName || lowerName.includes(sensitiveName),
  );
}

function isSensitiveBodyKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_BODY_KEYS.some(
    (sensitiveKey) =>
      lowerKey === sensitiveKey || lowerKey.includes(sensitiveKey),
  );
}
