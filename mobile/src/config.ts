const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? "";
const fallbackApiBaseUrl = "http://100.93.221.38:8000/api/v1";
const rawBaseUrl = envApiBaseUrl;

export function normalizeApiBaseUrl(value?: string | null): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return fallbackApiBaseUrl;
  }
  return trimmed.replace(/\/$/, "");
}

export const defaultApiBaseUrl = normalizeApiBaseUrl(rawBaseUrl);

let runtimeApiBaseUrl = defaultApiBaseUrl;

export function getApiBaseUrl(): string {
  return runtimeApiBaseUrl;
}

export function setApiBaseUrl(value?: string | null): string {
  runtimeApiBaseUrl = normalizeApiBaseUrl(value);
  return runtimeApiBaseUrl;
}
