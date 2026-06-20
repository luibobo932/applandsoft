const fallbackApiBaseUrl = "https://simulations-computation-lung-real.trycloudflare.com/api/v1";
const rawBaseUrl = "";

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
