import type { CapturedRequest, HeaderPair } from "../types";
import { contentTypeLabel, formatDuration } from "../utils";

export function formatMarkdown(
  request: CapturedRequest,
  redacted: boolean,
): string {
  return `# HTTP Debug Bundle

## Summary
Method: ${request.method}
URL: ${request.url}
Status: ${request.status}
Status Text: ${request.statusText ?? ""}
MIME Type: ${request.mimeType ?? ""}
Content Type: ${contentTypeLabel(request)}
Resource Type: ${request.resourceType}
Duration: ${formatDuration(request.time)}
Started At: ${request.startedDateTime ?? ""}
Secrets Redacted: ${redacted ? "Yes" : "No"}

## Request Headers
${formatPairs(request.requestHeaders)}

## Query Parameters
${formatPairs(request.queryParams)}

## Request Body
\`\`\`
${request.requestBody ?? "[No request body]"}
\`\`\`

## Response Headers
${formatPairs(request.responseHeaders)}

## Response Body
\`\`\`
${request.responseBody ?? "[No response body available]"}
\`\`\`

## Timing
${formatTiming(request.timings)}

## Notes for AI
Please inspect this request and identify likely causes. Focus on request body, response body, headers, auth/session/cookie/CORS behavior, status code, and payload shape.
`;
}

function formatPairs(pairs: HeaderPair[]): string {
  if (pairs.length === 0) {
    return "[None]";
  }

  return pairs.map((pair) => `- ${pair.name}: ${pair.value}`).join("\n");
}

function formatTiming(timings?: Record<string, number>): string {
  if (!timings || Object.keys(timings).length === 0) {
    return "[No timing data]";
  }

  return Object.entries(timings)
    .map(([key, value]) => `- ${key}: ${value} ms`)
    .join("\n");
}
