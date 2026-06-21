import { Platform } from "react-native";
import { LookupItem } from "./types";

export function formatMoney(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  if (value < 1_000_000_000) {
    const amountInMillion = Math.round(value / 1_000_000);
    return `${amountInMillion.toLocaleString("vi-VN")} triệu`;
  }
  const amountInBillion = value / 1_000_000_000;
  const hasFraction = Math.abs(amountInBillion - Math.round(amountInBillion)) >= 0.01;
  return `${amountInBillion.toLocaleString("vi-VN", {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })} tỷ`;
}

export function formatArea(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toLocaleString("vi-VN")} m²`;
}

export function formatDateTime(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("vi-VN");
}

export function formatCount(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "0";
  }
  return value.toLocaleString("vi-VN");
}

export function formatFilterNumber(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "";
  }
  return value.toLocaleString("vi-VN");
}

export function decodeDisplayText(value?: string | null): string {
  if (!value) {
    return "";
  }

  let next = value;

  next = next
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");

  if (/Ã|Â|Ä|Å|Æ|Ç|È|É|Ê|Ë|Ì|Í|Î|Ï|Ð|Ñ|Ò|Ó|Ô|Õ|Ö|×|Ø|Ù|Ú|Û|Ü|Ý|Þ|ß|áº|á»|â€|â€™|â€œ|â€/.test(next)) {
    try {
      next = decodeURIComponent(escape(next));
    } catch {
      // keep original if not valid latin1→utf8
    }
  }

  return next.normalize("NFC");
}

export function cleanDisplayText(value?: string | null, fallback = "-"): string {
  if (!value) {
    return fallback;
  }
  const normalized = decodeDisplayText(value).replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

export function splitAddress(value?: string | null): { primary: string; secondary: string } {
  const cleaned = cleanDisplayText(value, "");
  if (!cleaned) {
    return { primary: "Chưa có địa chỉ", secondary: "" };
  }
  const [primary, ...rest] = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  return {
    primary: primary || cleaned,
    secondary: rest.join(", "),
  };
}

export function isAndroidEmulatorRuntime(): boolean {
  if (Platform.OS !== "android") {
    return false;
  }

  const constants = (Platform.constants ?? {}) as Record<string, unknown>;
  const brand = String(constants.Brand ?? "").toLowerCase();
  const manufacturer = String(constants.Manufacturer ?? "").toLowerCase();
  const model = String(constants.Model ?? "").toLowerCase();
  const fingerprint = String(constants.Fingerprint ?? "").toLowerCase();

  return (
    manufacturer.includes("genymotion") ||
    model.includes("android sdk built for") ||
    (brand === "generic" && fingerprint.includes("generic/sdk"))
  );
}

export function isConnectivityFailure(message?: string | null): boolean {
  return /network request failed|failed to fetch|không kết nối|could not connect|unable to connect/i.test(message ?? "");
}

export function normalizeApiError(error: unknown): string {
  if (error instanceof Error) {
    if (isConnectivityFailure(error.message)) {
      return "Không kết nối được tới backend. Nếu đang test trên emulator, bấm nút 'Máy này' dưới ô API backend rồi đăng nhập lại.";
    }
    return error.message;
  }
  return "Đã có lỗi xảy ra";
}

export function parseNumberInput(value: string): number {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function pickLabel(items: LookupItem[], code?: string | null): string {
  return cleanDisplayText(items.find((item) => item.code === code)?.label, "");
}

export function buildRangeLabel(
  label: string,
  minValue?: number,
  maxValue?: number,
  suffix = ""
): string {
  const hasMin = minValue != null && !Number.isNaN(minValue) && minValue > 0;
  const hasMax = maxValue != null && !Number.isNaN(maxValue) && maxValue > 0;

  if (!hasMin && !hasMax) {
    return "";
  }
  if (hasMin && hasMax) {
    return `${label}: ${formatFilterNumber(minValue)}-${formatFilterNumber(maxValue)}${suffix}`;
  }
  if (hasMin) {
    return `${label}: từ ${formatFilterNumber(minValue)}${suffix}`;
  }
  return `${label}: đến ${formatFilterNumber(maxValue)}${suffix}`;
}

export function getInitials(value?: string | null, fallback = "LS"): string {
  const normalized = cleanDisplayText(value, "").split(" ").filter(Boolean);
  if (normalized.length === 0) {
    return fallback;
  }
  return normalized
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getActivityTone(result?: string | null): { label: string; backgroundColor: string; color: string } {
  const normalized = result?.toLowerCase() ?? "";
  if (normalized.includes("thất bại") || normalized.includes("lỗi") || normalized.includes("error")) {
    return { label: "Có lỗi", backgroundColor: "#FEF2F2", color: "#B91C1C" };
  }
  return { label: "Hoàn tất", backgroundColor: "#ECFDF5", color: "#047857" };
}

export function formatActivityAction(action?: string | null): string {
  switch ((action ?? "").toLowerCase()) {
    case "create_property":
      return "Tạo nhà mới";
    case "add_property_note":
      return "Thêm ghi chú";
    case "update_property_status":
      return "Cập nhật trạng thái";
    default:
      return cleanDisplayText(action, "Thao tác khác");
  }
}

export function formatActivityEntity(entityType?: string | null): string {
  switch ((entityType ?? "").toLowerCase()) {
    case "property":
      return "Căn nhà";
    case "note":
      return "Ghi chú";
    default:
      return cleanDisplayText(entityType, "Bản ghi");
  }
}

export function getStatusTone(statusName?: string | null): { backgroundColor: string; borderColor: string; color: string } {
  const normalized = statusName?.toLowerCase() ?? "";
  if (normalized.includes("chờ")) {
    return { backgroundColor: "#fff7ed", borderColor: "#fdba74", color: "#c2410c" };
  }
  if (normalized.includes("hot") || normalized.includes("tốt")) {
    return { backgroundColor: "#ecfdf5", borderColor: "#86efac", color: "#166534" };
  }
  if (normalized.includes("đã") || normalized.includes("xong") || normalized.includes("chốt")) {
    return { backgroundColor: "#eff6ff", borderColor: "#93c5fd", color: "#1d4ed8" };
  }
  return { backgroundColor: "#f8fafc", borderColor: "#cbd5e1", color: "#475569" };
}
