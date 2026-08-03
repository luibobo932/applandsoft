// Bo nho dem cho lan mo app ke tiep.
//
// Backend chay tren Render goi re: khi khong ai dung mot luc, may chu "ngu" va lan
// goi dau tien mat 30-50s moi tra ve. Cache lai danh sach kho hang + lookups cua lan
// mo truoc de nguoi dung thay du lieu NGAY, mang ve toi dau thi ghi de toi do.
//
// Chi cache khi dang xem danh sach mac dinh (khong loc gi) — de khong bao gio hien
// nham ket qua cua mot bo loc cu.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { LookupCollections, PropertyFilters, PropertySummary } from "./types";

const CACHE_KEY = "landsoft_mobile_offline_cache";
/** Giu vua du mot man hinh dau — tranh phinh AsyncStorage. */
const MAX_CACHED_ITEMS = 50;

export type OfflineCache = {
  properties: PropertySummary[];
  total: number;
  lookups: LookupCollections | null;
  savedAt: string;
};

/** Bo loc "mac dinh": chi khi do ket qua moi dai dien cho toan bo kho hang. */
export function isDefaultFilters(filters: PropertyFilters): boolean {
  const hasText = Boolean(
    filters.keyword?.trim() ||
      filters.phone?.trim() ||
      filters.street?.trim() ||
      filters.district ||
      filters.districts ||
      filters.ward ||
      filters.status ||
      filters.property_type ||
      filters.property_types
  );
  const hasRange =
    filters.price_min != null ||
    filters.price_max != null ||
    filters.area_min != null ||
    filters.area_max != null ||
    filters.width_min != null;
  const firstPage = (filters.page ?? 1) === 1;
  return !hasText && !hasRange && firstPage;
}

export async function loadOfflineCache(): Promise<OfflineCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OfflineCache>;
    if (!Array.isArray(parsed.properties)) return null;
    return {
      properties: parsed.properties,
      total: typeof parsed.total === "number" ? parsed.total : parsed.properties.length,
      lookups: parsed.lookups ?? null,
      savedAt: parsed.savedAt ?? "",
    };
  } catch {
    return null;
  }
}

/** Ghi de phan danh sach, giu nguyen lookups da cache. */
export async function cacheProperties(properties: PropertySummary[], total: number): Promise<void> {
  try {
    const current = await loadOfflineCache();
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        properties: properties.slice(0, MAX_CACHED_ITEMS),
        total,
        lookups: current?.lookups ?? null,
        savedAt: new Date().toISOString(),
      } satisfies OfflineCache)
    );
  } catch {
    // Cache hong khong duoc lam gay app
  }
}

/** Ghi de phan lookups, giu nguyen danh sach da cache. */
export async function cacheLookups(lookups: LookupCollections): Promise<void> {
  try {
    const current = await loadOfflineCache();
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        properties: current?.properties ?? [],
        total: current?.total ?? 0,
        lookups,
        savedAt: new Date().toISOString(),
      } satisfies OfflineCache)
    );
  } catch {
    // Cache hong khong duoc lam gay app
  }
}

/** Dang xuat -> xoa sach du lieu kho hang con dinh tren may. */
export async function clearOfflineCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // bo qua
  }
}
