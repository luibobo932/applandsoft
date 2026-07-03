import { getApiBaseUrl } from "./config";
import {
  ActionResponse,
  ActivityItem,
  CallLogEmployee,
  CurrentUser,
  CustomerDetail,
  PagedCustomersResponse,
  PagedEmployeesResponse,
  PropertyHistoryItem,
  LoginPayload,
  LoginResponse,
  LookupCollections,
  PagedCallLogsResponse,
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

function parseExactAddressKeyword(keyword?: string): { houseNumber: string; fullAddress: string } | null {
  const cleaned = (keyword ?? "").trim();
  const match = cleaned.match(/^(\d[\w./-]*)[\s,]+(.+?)$/u);
  if (!match) {
    return null;
  }
  const streetName = match[2].trim();
  const hasLetter = Array.from(streetName).some(
    (character) => character.toLocaleLowerCase("vi") !== character.toLocaleUpperCase("vi")
  );
  if (!hasLetter) {
    return null;
  }
  return { houseNumber: match[1], fullAddress: cleaned };
}

function normalizeAddress(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi")
    .replace(/đ/g, "d")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  const exactAddress = parseExactAddressKeyword(filters.keyword);
  if (!exactAddress) {
    return request<PagedPropertiesResponse>(`/properties${buildQuery(filters)}`, {}, token);
  }

  // Tuong thich backend Render cu: lay ung vien theo so nha, roi loc dung dia chi day du tren app.
  const candidateFilters: PropertyFilters = {
    ...filters,
    keyword: exactAddress.houseNumber,
    page: 1,
    page_size: 5000,
  };
  const response = await request<PagedPropertiesResponse>(
    `/properties${buildQuery(candidateFilters)}`,
    {},
    token
  );
  const expectedAddress = normalizeAddress(exactAddress.fullAddress);
  const exactItems = response.items.filter(
    (item) => normalizeAddress(item.address) === expectedAddress
  );
  return {
    items: exactItems,
    page: 1,
    page_size: exactItems.length || 1,
    total: exactItems.length,
  };
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

// Chi giu CHU SO (de search backend va dem do dai SDT)
function normalizePhoneDigits(raw?: string | null): string {
  let s = (raw ?? "").replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length >= 11) s = "0" + s.slice(2);
  return s.replace(/[^\d]/g, "");
}

// So sanh trung: GIU ky tu dac biet (chi bo khoang trang + quy +84 -> 0).
// Nho vay nguoi dung co the them ky tu (vi du "0938. ") de co y bo qua canh bao trung.
export function cleanPhoneCompare(raw?: string | null): string {
  let s = (raw ?? "").trim().replace(/\s+/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && /^\d+$/.test(s) && s.length >= 11) s = "0" + s.slice(2);
  return s;
}

// Kiem tra SDT chu nha da ton tai trong he thong — khop CHINH XAC cot KhachHang.DiDong
// (giong Landsoft "Số di động đã có trong hệ thống"). Tra ve so KH trung + ten chu nha.
export async function checkPhone(
  token: string,
  phone: string
): Promise<{ count: number; ownerName: string | null }> {
  const digits = normalizePhoneDigits(phone);
  if (digits.length < 9) return { count: 0, ownerName: null };
  const res = await request<{ exists: boolean; count: number; owner_name: string | null }>(
    `/properties/check-phone?phone=${encodeURIComponent(digits)}`,
    {},
    token
  );
  return { count: res.count ?? 0, ownerName: res.owner_name ?? null };
}

// Danh sach ten duong theo quan (cho dropdown 'Tên đường' giong Landsoft lookUpDuong)
export async function fetchStreets(token: string, districtCode: string): Promise<string[]> {
  if (!districtCode) return [];
  const res = await request<{ id: string; name: string }[]>(
    `/streets?district=${encodeURIComponent(districtCode)}`,
    {},
    token
  );
  return res.map((s) => s.name).filter(Boolean);
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

export async function fetchCallLogEmployees(token: string, keyword = ""): Promise<CallLogEmployee[]> {
  const query = keyword.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : "";
  return request<CallLogEmployee[]>(`/call-logs/employees${query}`, {}, token);
}

export async function fetchCallLogs(
  token: string,
  params: {
    employeeIds?: number[];
    fromDate?: string;
    toDate?: string;
    afterId?: number | null;
    limit?: number;
  }
): Promise<PagedCallLogsResponse> {
  const query = new URLSearchParams();
  if (params.employeeIds?.length) {
    query.set("employee_ids", params.employeeIds.join(","));
  }
  if (params.fromDate) {
    query.set("from_date", params.fromDate);
  }
  if (params.toDate) {
    query.set("to_date", params.toDate);
  }
  if (params.afterId) {
    query.set("after_id", String(params.afterId));
  }
  query.set("limit", String(params.limit ?? 100));
  return request<PagedCallLogsResponse>(`/call-logs?${query.toString()}`, {}, token);
}

export async function registerPushToken(
  token: string,
  expoPushToken: string,
  employeeIds: number[]
): Promise<void> {
  await request(
    "/push/register",
    {
      method: "POST",
      body: JSON.stringify({ expo_push_token: expoPushToken, employee_ids: employeeIds }),
    },
    token
  );
}

export async function fetchCustomers(
  token: string,
  keyword = "",
  page = 1,
  pageSize = 30
): Promise<PagedCustomersResponse> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (keyword.trim()) query.append("keyword", keyword.trim());
  return request<PagedCustomersResponse>(`/customers?${query.toString()}`, {}, token);
}

export async function fetchCustomerDetail(token: string, makh: number): Promise<CustomerDetail> {
  return request<CustomerDetail>(`/customers/${makh}`, {}, token);
}

export async function fetchEmployees(
  token: string,
  keyword = "",
  page = 1,
  pageSize = 50
): Promise<PagedEmployeesResponse> {
  const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  if (keyword.trim()) query.append("keyword", keyword.trim());
  return request<PagedEmployeesResponse>(`/employees?${query.toString()}`, {}, token);
}

export async function fetchPropertyHistory(token: string, landsoftId: number): Promise<PropertyHistoryItem[]> {
  return request<PropertyHistoryItem[]>(`/properties/${landsoftId}/history`, {}, token);
}

export async function fetchNextPropertyCode(token: string): Promise<number> {
  const res = await request<{ next_code: number }>("/next-property-code", {}, token);
  return res.next_code;
}

export async function checkHouseNumber(
  token: string,
  houseNumber: string,
  district?: string,
  street?: string
): Promise<{ count: number; sample?: string | null }> {
  const query = new URLSearchParams({ house_number: houseNumber });
  if (district) query.append("district", district);
  if (street) query.append("street", street);
  return request<{ count: number; sample?: string | null }>(`/check-house?${query.toString()}`, {}, token);
}
