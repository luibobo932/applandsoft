import { getApiBaseUrl } from "./config";
import {
  ActionResponse,
  ActivityItem,
  CurrentUser,
  LoginPayload,
  LoginResponse,
  LookupCollections,
  PagedPropertiesResponse,
  PropertyCreatePayload,
  PropertyDetail,
  PropertyFilters,
} from "./types";

export class ApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

// 45s de chiu duoc Render free tier khoi dong nguoi (~30-50s) khi app mo sau thoi gian khong dung
const REQUEST_TIMEOUT_MS = 45000;

let unauthorizedHandler: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): void {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, { ...options, headers, signal: controller.signal });
  } catch {
    throw new ApiError("Không kết nối được tới backend. Kiểm tra API backend hoặc mạng.");
  } finally {
    clearTimeout(timeoutId);
  }

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (response.status === 401 && unauthorizedHandler) {
      unauthorizedHandler();
    }
    const detail = payload?.detail;
    const message = typeof detail === "string" ? detail : `API lỗi ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

function buildQuery(filters: PropertyFilters): string {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    query.append(key, String(value));
  });

  // Tuong thich backend cu: neu chi co param 'nhieu' (districts/property_types) thi gui kem
  // ban don le (district/property_type) de backend cu van loc duoc truong hop 1 lua chon.
  // Backend moi uu tien ban 'nhieu' nen khong xung dot.
  const districtCodes = (filters.districts ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (districtCodes.length > 0 && !filters.district) {
    query.set("district", districtCodes[0]);
  }
  const typeCodes = (filters.property_types ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (typeCodes.length === 1 && !filters.property_type) {
    query.set("property_type", typeCodes[0]);
  }

  const queryText = query.toString();
  return queryText ? `?${queryText}` : "";
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMe(token: string): Promise<CurrentUser> {
  return request<CurrentUser>("/me", {}, token);
}

export async function fetchLookups(token: string): Promise<LookupCollections> {
  return request<LookupCollections>("/lookups", {}, token);
}

export async function fetchProperties(token: string, filters: PropertyFilters): Promise<PagedPropertiesResponse> {
  return request<PagedPropertiesResponse>(`/properties${buildQuery(filters)}`, {}, token);
}

export async function fetchPropertyDetail(token: string, landsoftId: number): Promise<PropertyDetail> {
  return request<PropertyDetail>(`/properties/${landsoftId}`, {}, token);
}

export async function updatePropertyStatus(
  token: string,
  landsoftId: number,
  statusCode: string
): Promise<ActionResponse> {
  return request<ActionResponse>(
    `/properties/${landsoftId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status_code: statusCode }),
    },
    token
  );
}

export async function addPropertyNote(
  token: string,
  landsoftId: number,
  content: string
): Promise<ActionResponse> {
  return request<ActionResponse>(
    `/properties/${landsoftId}/notes`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    },
    token
  );
}

export async function createProperty(
  token: string,
  payload: PropertyCreatePayload
): Promise<ActionResponse> {
  return request<ActionResponse>(
    "/properties",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token
  );
}

export async function fetchActivity(token: string): Promise<ActivityItem[]> {
  return request<ActivityItem[]>("/activity/recent", {}, token);
}
