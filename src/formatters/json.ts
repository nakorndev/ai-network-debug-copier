import type { CapturedRequest } from "../types";
import { pairsToRecord } from "../utils";

export function formatJson(
  request: CapturedRequest,
  redacted: boolean,
): string {
  return JSON.stringify(
    {
      summary: {
        method: request.method,
        url: request.url,
        status: request.status,
        statusText: request.statusText,
        mimeType: request.mimeType,
        resourceType: request.resourceType,
        durationMs: request.time,
        startedAt: request.startedDateTime,
        secretsRedacted: redacted,
      },
      request: {
        headers: pairsToRecord(request.requestHeaders),
        queryParams: pairsToRecord(request.queryParams),
        body: request.requestBody,
      },
      response: {
        headers: pairsToRecord(request.responseHeaders),
        body: request.responseBody,
        bodyEncoding: request.responseBodyEncoding,
      },
      timing: request.timings ?? {},
    },
    null,
    2,
  );
}
