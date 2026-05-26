export type HeaderPair = {
  name: string;
  value: string;
};

export type ResourceType =
  | "fetch-xhr"
  | "document"
  | "script"
  | "stylesheet"
  | "image"
  | "other";

export type CapturedRequest = {
  id: string;
  startedDateTime?: string;
  method: string;
  url: string;
  status: number;
  statusText?: string;
  mimeType?: string;
  resourceType: ResourceType;
  requestHeaders: HeaderPair[];
  responseHeaders: HeaderPair[];
  queryParams: HeaderPair[];
  requestBody?: string;
  responseBody?: string;
  responseBodyEncoding?: string;
  responseBodyLoaded: boolean;
  responseBodyError?: string;
  time?: number;
  timings?: Record<string, number>;
  rawHarEntry?: unknown;
  sourceRequest?: chrome.devtools.network.Request;
};

export type CopyOptions = {
  includeSensitiveValues: boolean;
  maxBodyBytes: number;
};

export type RedactionResult<T> = {
  value: T;
  redacted: boolean;
};

export type DisplayBundle = {
  request: CapturedRequest;
  redacted: boolean;
};
