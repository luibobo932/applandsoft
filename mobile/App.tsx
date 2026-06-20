import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

import {
  ApiError,
  addPropertyNote,
  createProperty,
  fetchActivity,
  fetchLookups,
  fetchMe,
  fetchProperties,
  fetchPropertyDetail,
  login,
  updatePropertyStatus,
} from "./src/api";
import { defaultApiBaseUrl, getApiBaseUrl, setApiBaseUrl } from "./src/config";
import {
  ActivityItem,
  CurrentUser,
  LoginPayload,
  LookupCollections,
  LookupItem,
  PropertyCreatePayload,
  PropertyDetail,
  PropertyFilters,
  PropertySummary,
} from "./src/types";

const SESSION_KEY = "landsoft_mobile_session";
const CREATE_DRAFT_KEY = "landsoft_mobile_create_draft";
const API_BASE_URL_KEY = "landsoft_mobile_api_base_url";
const DEBUG_AUTO_LOGIN_USER = process.env.EXPO_PUBLIC_DEBUG_AUTO_LOGIN_USER?.trim();
const DEBUG_AUTO_LOGIN_PASSWORD = process.env.EXPO_PUBLIC_DEBUG_AUTO_LOGIN_PASSWORD?.trim();
const EMULATOR_API_BASE_URL = "http://10.0.2.2:8000/api/v1";

type SessionState = {
  token: string;
  user: CurrentUser;
};

type TabKey = "properties" | "create" | "activity";

const emptyDraft: PropertyCreatePayload = {
  title: "",
  address: "",
  district_code: "",
  ward_code: "",
  property_type_code: "",
  status_code: "",
  source_code: "",
  street_name: "",
  owner_name: "",
  contact_phone: "",
  price: 0,
  area: 0,
  width: 0,
  length: 0,
  floors: 0,
  bedrooms: 0,
  bathrooms: 0,
  legal_status_code: "",
  direction_code: "",
  description: "",
  note: "",
  listing_type: "ban",
};

const emptyLookups: LookupCollections = {
  districts: [],
  wards: [],
  property_types: [],
  directions: [],
  legal_statuses: [],
  statuses: [],
  sources: [],
};

const emptyFilters: PropertyFilters = {
  keyword: "",
  district: "",
  ward: "",
  status: "",
  price_min: undefined,
  price_max: undefined,
  area_min: undefined,
  area_max: undefined,
  page: 1,
  page_size: 20,
};

function formatMoney(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  const amountInBillion = value / 1_000_000_000;
  const hasFraction = Math.abs(amountInBillion - Math.round(amountInBillion)) >= 0.01;
  return `${amountInBillion.toLocaleString("vi-VN", {
    minimumFractionDigits: hasFraction ? 1 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  })} tỷ`;
}

function formatArea(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toLocaleString("vi-VN")} m²`;
}

function formatDateTime(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("vi-VN");
}

function formatCount(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "0";
  }
  return value.toLocaleString("vi-VN");
}

function formatFilterNumber(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "";
  }
  return value.toLocaleString("vi-VN");
}

function splitAddress(value?: string | null): { primary: string; secondary: string } {
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

function isAndroidEmulatorRuntime(): boolean {
  if (Platform.OS !== "android") {
    return false;
  }

  const constants = (Platform.constants ?? {}) as Record<string, unknown>;
  const brand = String(constants.Brand ?? "").toLowerCase();
  const manufacturer = String(constants.Manufacturer ?? "").toLowerCase();
  const model = String(constants.Model ?? "").toLowerCase();
  const fingerprint = String(constants.Fingerprint ?? "").toLowerCase();

  return (
    brand.includes("generic") ||
    manufacturer.includes("genymotion") ||
    model.includes("sdk") ||
    model.includes("emulator") ||
    model.includes("android sdk built for") ||
    fingerprint.includes("generic") ||
    fingerprint.includes("emulator")
  );
}

function getPreferredApiBaseUrl(storedApiBaseUrl?: string | null): string {
  if (storedApiBaseUrl?.trim()) {
    return setApiBaseUrl(storedApiBaseUrl);
  }
  if (isAndroidEmulatorRuntime()) {
    return setApiBaseUrl(EMULATOR_API_BASE_URL);
  }
  return setApiBaseUrl(defaultApiBaseUrl);
}

function isConnectivityFailure(message?: string | null): boolean {
  return /network request failed|failed to fetch|không kết nối|could not connect|unable to connect/i.test(message ?? "");
}

function normalizeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (isConnectivityFailure(error.message)) {
      return "Không kết nối được tới backend. Nếu đang test trên emulator, bấm nút 'Máy này' dưới ô API backend rồi đăng nhập lại.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    if (isConnectivityFailure(error.message)) {
      return "Không kết nối được tới backend. Nếu đang test trên emulator, bấm nút 'Máy này' dưới ô API backend rồi đăng nhập lại.";
    }
    return error.message;
  }
  return "Đã có lỗi xảy ra";
}

function parseNumberInput(value: string): number {
  const normalized = value.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickLabel(items: LookupItem[], code?: string | null): string {
  return cleanDisplayText(items.find((item) => item.code === code)?.label, "");
}

function decodeDisplayText(value?: string | null): string {
  if (!value) {
    return "";
  }

  let next = value;

  // Backend/log sources can occasionally send literal unicode escapes.
  next = next
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");

  // Some legacy responses arrive as UTF-8 bytes interpreted as latin1.
  if (/Ã|Â|Ä|Å|Æ|Ç|È|É|Ê|Ë|Ì|Í|Î|Ï|Ð|Ñ|Ò|Ó|Ô|Õ|Ö|×|Ø|Ù|Ú|Û|Ü|Ý|Þ|ß|áº|á»|â€|â€™|â€œ|â€/.test(next)) {
    try {
      next = decodeURIComponent(escape(next));
    } catch {
      // Giữ nguyên nếu chuỗi không đúng pattern latin1->utf8.
    }
  }

  return next.normalize("NFC");
}

function cleanDisplayText(value?: string | null, fallback = "-"): string {
  if (!value) {
    return fallback;
  }
  const normalized = decodeDisplayText(value).replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function buildRangeLabel(
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

function getInitials(value?: string | null, fallback = "LS"): string {
  const normalized = cleanDisplayText(value, "").split(" ").filter(Boolean);
  if (normalized.length === 0) {
    return fallback;
  }
  return normalized
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function getActivityTone(result?: string | null): { label: string; backgroundColor: string; color: string } {
  const normalized = result?.toLowerCase() ?? "";
  if (normalized.includes("thất bại") || normalized.includes("lỗi") || normalized.includes("error")) {
    return { label: "Có lỗi", backgroundColor: "#FEF2F2", color: "#B91C1C" };
  }
  return { label: "Hoàn tất", backgroundColor: "#ECFDF5", color: "#047857" };
}

function formatActivityAction(action?: string | null): string {
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

function formatActivityEntity(entityType?: string | null): string {
  switch ((entityType ?? "").toLowerCase()) {
    case "property":
      return "Căn nhà";
    case "note":
      return "Ghi chú";
    default:
      return cleanDisplayText(entityType, "Bản ghi");
  }
}

function getStatusTone(statusName?: string | null): { backgroundColor: string; borderColor: string; color: string } {
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

function AppHeader({
  user,
  title,
  onLogout,
}: {
  user: CurrentUser;
  title: string;
  onLogout: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTextGroup}>
        <Text style={styles.headerEyebrow}>{cleanDisplayText(user.role_name || "Landsoft Mobile")}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>
          {cleanDisplayText(user.display_name)} • {cleanDisplayText(user.landsoft_username ?? user.username)}
        </Text>
      </View>
      <View style={styles.headerActions}>
        <View style={styles.userPill}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{getInitials(user.display_name)}</Text>
          </View>
          <View style={styles.userPillTextGroup}>
            <Text style={styles.userPillName}>{cleanDisplayText(user.landsoft_username ?? user.username)}</Text>
            <Text style={styles.userPillRole}>{cleanDisplayText(user.role_name || "Môi giới")}</Text>
          </View>
        </View>
        <Pressable style={styles.logoutPill} onPress={onLogout}>
          <Feather name="log-out" size={14} color="#17305D" />
          <Text style={styles.logoutPillText}>Đăng xuất</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const tabs: Array<{ key: TabKey; label: string; icon: React.ComponentProps<typeof Feather>["name"] }> = [
    { key: "properties", label: "Kho hàng", icon: "home" },
    { key: "create", label: "Nhập nhà", icon: "plus-circle" },
    { key: "activity", label: "Gần đây", icon: "clock" },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
          onPress={() => onChange(tab.key)}
        >
          <Feather
            name={tab.icon}
            size={18}
            color={activeTab === tab.key ? "#ffffff" : "#64748B"}
            style={styles.tabButtonIcon}
          />
          <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function LoginScreen({
  apiBaseUrlValue,
  loading,
  onChangeApiBaseUrl,
  onUseEmulatorApiBaseUrl,
  onLogin,
}: {
  apiBaseUrlValue: string;
  loading: boolean;
  onChangeApiBaseUrl: (value: string) => void;
  onUseEmulatorApiBaseUrl: () => void;
  onLogin: (payload: LoginPayload) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={styles.loginScreen}>
      <StatusBar style="dark" />
      <View style={styles.loginPanel}>
        <Text style={styles.loginTitle}>Landsoft Mobile</Text>
        <Text style={styles.loginDescription}>
          App Android riêng để xem kho nhà và nhập nhà mới trực tiếp vào Landsoft qua backend cloud.
        </Text>
        <Field label="API backend">
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={apiBaseUrlValue}
            onChangeText={onChangeApiBaseUrl}
            placeholder="https://.../api/v1"
          />
          <View style={styles.apiPresetRow}>
            <Pressable style={styles.apiPresetButtonPrimary} onPress={onUseEmulatorApiBaseUrl}>
              <Feather name="monitor" size={15} color="#17305D" />
              <Text style={styles.apiPresetButtonPrimaryText}>Máy này</Text>
            </Pressable>
            <View style={styles.apiPresetHint}>
              <Feather name="info" size={14} color="#7C8BA1" />
              <Text style={styles.apiPresetHintText}>
                Nếu đang test trên emulator Android, bấm nút này để dùng backend đang chạy trên laptop.
              </Text>
            </View>
          </View>
        </Field>
        <Field label="Tên đăng nhập">
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            placeholder="Nhập username"
          />
        </Field>
        <Field label="Mật khẩu">
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Nhập mật khẩu"
          />
        </Field>
        <Pressable
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          disabled={loading}
          onPress={() => onLogin({ username: username.trim(), password })}
        >
          <Text style={styles.primaryButtonText}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailInfoRow}>
      <View style={styles.detailInfoLeft}>
        <View style={styles.detailInfoIconWrap}>
          <Feather name={icon} size={16} color="#F37021" />
        </View>
        <Text style={styles.detailInfoLabel}>{label}</Text>
      </View>
      <Text style={styles.detailInfoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SelectField({
  label,
  value,
  items,
  onChange,
  allowEmpty = true,
  emptyLabel = "Chọn",
}: {
  label: string;
  value?: string;
  items: LookupItem[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <Field label={label}>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={value ?? ""} onValueChange={(selected) => onChange(String(selected ?? ""))}>
          {allowEmpty ? <Picker.Item label={emptyLabel} value="" /> : null}
          {items.map((item) => (
            <Picker.Item key={item.code} label={cleanDisplayText(item.label, item.code)} value={item.code} />
          ))}
        </Picker>
      </View>
    </Field>
  );
}

function PropertyListScreen({
  filters,
  items,
  totalCount,
  lookups,
  loading,
  refreshing,
  onChangeFilter,
  onReload,
  onOpenProperty,
  onQuickViewPhone,
  onGoCreate,
}: {
  filters: PropertyFilters;
  items: PropertySummary[];
  totalCount: number;
  lookups: LookupCollections;
  loading: boolean;
  refreshing: boolean;
  onChangeFilter: (patch: Partial<PropertyFilters>) => void;
  onReload: () => Promise<void>;
  onOpenProperty: (landsoftId: number) => void;
  onQuickViewPhone: (landsoftId: number) => Promise<void>;
  onGoCreate: () => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const resetFilters = useCallback(() => {
    onChangeFilter({
      keyword: "",
      district: "",
      ward: "",
      status: "",
      price_min: undefined,
      price_max: undefined,
      area_min: undefined,
      area_max: undefined,
      page: 1,
    });
  }, [onChangeFilter]);
  const wardOptions = useMemo(
    () => lookups.wards.filter((item) => !filters.district || item.parent_code === filters.district),
    [filters.district, lookups.wards]
  );
  const activeFilterChips = [
    filters.keyword?.trim() ? "Từ khóa: " + filters.keyword.trim() : "",
    filters.district ? pickLabel(lookups.districts, filters.district) : "",
    filters.ward ? pickLabel(lookups.wards, filters.ward) : "",
    filters.status ? pickLabel(lookups.statuses, filters.status) : "",
    buildRangeLabel("Giá", filters.price_min, filters.price_max, " tỷ"),
    buildRangeLabel("DT", filters.area_min, filters.area_max, " m²"),
  ].filter(Boolean);
  const activeFilterCount = activeFilterChips.length;
  const summaryLabel =
    loading ? "Đang đồng bộ kho hàng..." : String(items.length) + " căn đang hiển thị";
  const overviewHint =
    activeFilterCount > 0
      ? activeFilterChips.join(" • ")
      : `Tổng kho ${formatCount(totalCount)} căn trong Landsoft. Tìm nhanh theo tên, mô tả, địa chỉ hoặc mở bộ lọc nâng cao.`;

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.landsoft_id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onReload()} />}
        contentContainerStyle={items.length === 0 ? styles.marketListContentEmpty : styles.marketListContent}
        ListHeaderComponent={
          <>
            <View style={styles.marketOverview}>
              <View style={styles.marketOverviewTopRow}>
                <View style={styles.marketOverviewBadge}>
                  <Feather name="home" size={18} color="#17305D" />
                </View>
                <View style={styles.marketOverviewTopActions}>
                  <Pressable
                    style={[styles.marketOverviewIconButton, showFilters && styles.marketOverviewIconButtonActive]}
                    onPress={() => setShowFilters((current) => !current)}
                  >
                    <Feather
                      name={showFilters ? "x" : "sliders"}
                      size={18}
                      color={showFilters ? "#ffffff" : "#17305D"}
                    />
                  </Pressable>
                  <Pressable style={styles.marketOverviewAddButton} onPress={onGoCreate}>
                    <Feather name="plus" size={16} color="#ffffff" />
                    <Text style={styles.marketOverviewAddButtonText}>Thêm nhà</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.marketOverviewTextGroup}>
                <Text style={styles.marketOverviewLabel}>Kho nhà SKL</Text>
                <Text style={styles.marketOverviewStat}>{summaryLabel}</Text>
                <Text style={styles.marketOverviewHint}>{overviewHint}</Text>
              </View>
            </View>

            <View style={styles.searchPanel}>
              <View style={styles.searchToolbar}>
                <View style={styles.searchInputWrap}>
                  <Feather name="search" size={18} color="#7C8BA1" />
                  <TextInput
                    style={styles.searchInput}
                    value={filters.keyword ?? ""}
                    onChangeText={(value) => onChangeFilter({ keyword: value })}
                    placeholder="Tìm theo tên, mô tả, địa chỉ, quận..."
                  />
                </View>
                <Pressable style={styles.searchToolbarIconButton} onPress={() => setShowFilters((current) => !current)}>
                  <Feather name={showFilters ? "chevron-up" : "sliders"} size={18} color="#17305D" />
                </Pressable>
              </View>
              <View style={styles.toolbarPillRow}>
                <Pressable style={styles.primaryButtonCompactWide} onPress={() => void onReload()}>
                  <Feather name="search" size={16} color="#ffffff" />
                  <Text style={styles.primaryButtonText}>Áp dụng</Text>
                </Pressable>
                <Pressable
                  style={styles.secondaryButtonCompactWide}
                  onPress={() => setShowFilters((current) => !current)}
                >
                  <Feather name="sliders" size={16} color="#17305D" />
                  <Text style={styles.secondaryButtonText}>
                    {showFilters ? "Thu gọn lọc" : "Bộ lọc nâng cao"}
                  </Text>
                </Pressable>
              </View>
              {activeFilterCount > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterChipRow}
                >
                  {activeFilterChips.map((chip) => (
                    <View key={chip} style={styles.filterChip}>
                      <Text style={styles.filterChipText}>{chip}</Text>
                    </View>
                  ))}
                </ScrollView>
              ) : null}
            </View>

            {showFilters ? (
              <View style={styles.filterPanel}>
                <View style={styles.filterPanelHeader}>
                  <Text style={styles.filterPanelTitle}>Bộ lọc chi tiết</Text>
                  {activeFilterCount > 0 ? (
                    <Pressable
                      onPress={resetFilters}
                    >
                      <Text style={styles.filterResetText}>Xóa nhanh</Text>
                    </Pressable>
                  ) : null}
                </View>
                <SelectField
                  label="Quận"
                  value={filters.district ?? ""}
                  items={lookups.districts}
                  onChange={(value) => onChangeFilter({ district: value, ward: "" })}
                  emptyLabel="Tất cả quận"
                />
                <SelectField
                  label="Phường"
                  value={filters.ward ?? ""}
                  items={wardOptions}
                  onChange={(value) => onChangeFilter({ ward: value })}
                  emptyLabel="Tất cả phường"
                />
                <SelectField
                  label="Trạng thái"
                  value={filters.status ?? ""}
                  items={lookups.statuses}
                  onChange={(value) => onChangeFilter({ status: value })}
                  emptyLabel="Tất cả trạng thái"
                />
                <Text style={styles.filterGroupLabel}>Khoảng giá (tỷ)</Text>
                <View style={styles.filterRangeRow}>
                  <View style={styles.filterRangeField}>
                    <Field label="Từ">
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={formatFilterNumber(filters.price_min)}
                        onChangeText={(value) =>
                          onChangeFilter({
                            price_min: value.trim() ? parseNumberInput(value) : undefined,
                          })
                        }
                        placeholder="0"
                      />
                    </Field>
                  </View>
                  <View style={styles.filterRangeField}>
                    <Field label="Đến">
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={formatFilterNumber(filters.price_max)}
                        onChangeText={(value) =>
                          onChangeFilter({
                            price_max: value.trim() ? parseNumberInput(value) : undefined,
                          })
                        }
                        placeholder="50"
                      />
                    </Field>
                  </View>
                </View>
                <Text style={styles.filterGroupLabel}>Diện tích (m²)</Text>
                <View style={styles.filterRangeRow}>
                  <View style={styles.filterRangeField}>
                    <Field label="Từ">
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={formatFilterNumber(filters.area_min)}
                        onChangeText={(value) =>
                          onChangeFilter({
                            area_min: value.trim() ? parseNumberInput(value) : undefined,
                          })
                        }
                        placeholder="30"
                      />
                    </Field>
                  </View>
                  <View style={styles.filterRangeField}>
                    <Field label="Đến">
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={formatFilterNumber(filters.area_max)}
                        onChangeText={(value) =>
                          onChangeFilter({
                            area_max: value.trim() ? parseNumberInput(value) : undefined,
                          })
                        }
                        placeholder="120"
                      />
                    </Field>
                  </View>
                </View>
                <View style={styles.filterButtonRow}>
                  <Pressable style={styles.primaryButtonInline} onPress={() => void onReload()}>
                    <Text style={styles.primaryButtonText}>Lọc kho hàng</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButtonInline} onPress={resetFilters}>
                    <Text style={styles.secondaryButtonText}>Xóa bộ lọc</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Danh sách căn</Text>
              <View style={styles.listHeaderRight}>
                <Text style={styles.listHeaderCount}>
                  {loading ? "Đang tải..." : `${formatCount(items.length)}/${formatCount(totalCount)} mục`}
                </Text>
                {loading ? <ActivityIndicator size="small" color="#F37021" /> : null}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.emptyStateText}>
            {loading
              ? "Đang tải kho hàng..."
              : "Chưa có dữ liệu hoặc chưa khớp bộ lọc."}
          </Text>
        }
        renderItem={({ item }) => {
          const statusTone = getStatusTone(item.status_name);
          const locationLine = [cleanDisplayText(item.district_name, ""), cleanDisplayText(item.ward_name, "")]
            .filter(Boolean)
            .join(" • ");
          const addressParts = splitAddress(item.address);
          return (
            <View style={styles.propertyRow}>
              <Pressable style={styles.propertyCardTapArea} onPress={() => onOpenProperty(item.landsoft_id)}>
                <View style={styles.propertyHero}>
                  <View style={styles.propertyHeroTop}>
                    <View
                      style={[
                        styles.statusBadge,
                        styles.propertyHeroStatus,
                        {
                          backgroundColor: statusTone.backgroundColor,
                          borderColor: statusTone.borderColor,
                        },
                      ]}
                    >
                      <Text style={[styles.statusBadgeText, { color: statusTone.color }]}>
                        {cleanDisplayText(item.status_name, "Chưa rõ")}
                      </Text>
                    </View>
                    <View style={styles.propertyHeroTopActions}>
                      <View style={styles.propertyCodePill}>
                        <Text style={styles.propertyCode}>{item.code}</Text>
                      </View>
                      <View style={styles.propertyFavoriteBubble}>
                        <Feather name="heart" size={18} color="#8B9AB0" />
                      </View>
                    </View>
                  </View>
                  <View style={styles.propertyHeroBody}>
                    <View style={styles.propertyHeroIconWrap}>
                      <Feather name="home" size={34} color="#96A6C0" />
                    </View>
                    <Text style={styles.propertyHeroLabel}>Chưa có ảnh</Text>
                  </View>
                </View>

                <View style={styles.propertyBody}>
                  <View style={styles.propertyPriceRow}>
                    <Text style={styles.propertyPrice}>{formatMoney(item.price)}</Text>
                    <View style={styles.propertyUpdatedChip}>
                      <Text style={styles.propertyUpdatedChipText}>Mới cập nhật</Text>
                    </View>
                  </View>
                  <Text style={styles.propertyTitle} numberOfLines={2}>
                    {cleanDisplayText(item.title, "Chưa có tiêu đề")}
                  </Text>
                  <Text style={styles.propertyLocation} numberOfLines={1}>
                    {locationLine || "Chưa rõ khu vực"}
                  </Text>
                  <Text style={styles.propertyAddressPrimary} numberOfLines={1}>
                    {addressParts.primary}
                  </Text>
                  {addressParts.secondary ? (
                    <Text style={styles.propertyAddressSecondary} numberOfLines={1}>
                      {addressParts.secondary}
                    </Text>
                  ) : null}
                  <View style={styles.propertyFactsRow}>
                    <View style={styles.propertyFact}>
                      <Feather name="maximize" size={14} color="#8B9AB0" />
                      <Text style={styles.propertyFactText}>{formatArea(item.area)}</Text>
                    </View>
                    {item.district_name ? (
                      <View style={styles.propertyFact}>
                        <Feather name="map-pin" size={14} color="#8B9AB0" />
                        <Text style={styles.propertyFactText}>{cleanDisplayText(item.district_name)}</Text>
                      </View>
                    ) : null}
                    {item.ward_name ? (
                      <View style={styles.propertyFact}>
                        <Feather name="layers" size={14} color="#8B9AB0" />
                        <Text style={styles.propertyFactText}>{cleanDisplayText(item.ward_name)}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.propertySnippet} numberOfLines={3}>
                    {cleanDisplayText(item.description, "Không có mô tả")}
                  </Text>
                </View>
              </Pressable>
              <View style={styles.propertyActionBar}>
                <View style={styles.propertyActionRow}>
                  <Pressable style={styles.propertyPrimaryAction} onPress={() => onOpenProperty(item.landsoft_id)}>
                    <Feather name="edit-3" size={16} color="#ffffff" />
                    <Text style={styles.propertyPrimaryActionText}>Mở hồ sơ</Text>
                  </Pressable>
                  <Pressable
                    style={styles.propertySecondaryAction}
                    onPress={() => void onQuickViewPhone(item.landsoft_id)}
                  >
                    <Feather name="phone" size={15} color="#17305D" />
                    <Text style={styles.propertySecondaryActionText}>Xem số</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }}
      />
      <Pressable style={styles.createFab} onPress={onGoCreate}>
        <Feather name="plus" size={20} color="#ffffff" />
        <Text style={styles.createFabText}>Nhập nhà</Text>
      </Pressable>
    </View>
  );
}
function PropertyDetailScreen({
  token,
  propertyId,
  lookups,
  onBack,
  onChanged,
}: {
  token: string;
  propertyId: number;
  lookups: LookupCollections;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusCode, setStatusCode] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await fetchPropertyDetail(token, propertyId);
      setProperty(detail);
      setStatusCode(detail.status_code ?? "");
    } catch (error) {
      Alert.alert("Không tải được chi tiết", normalizeApiError(error));
    } finally {
      setLoading(false);
    }
  }, [propertyId, token]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const copySummary = async () => {
    if (!property) {
      return;
    }
    const lines = [
      property.code,
      cleanDisplayText(property.title, ""),
      cleanDisplayText(property.address, ""),
      `${formatMoney(property.price)} • ${formatArea(property.area)}`,
      cleanDisplayText(property.description, ""),
      `Liên hệ: ${property.owner_name ?? "-"} - ${property.contact_phone ?? "-"}`,
    ];
    await Clipboard.setStringAsync(lines.filter(Boolean).join("\n"));
    Alert.alert("Đã copy", "Thông tin căn đã được copy.");
  };

  const makePhoneCall = async () => {
    if (!property?.contact_phone) {
      Alert.alert("Thiếu số điện thoại", "Căn này chưa có số liên hệ.");
      return;
    }
    const url = `tel:${property.contact_phone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Không gọi được", "Thiết bị này không mở được màn hình gọi.");
      return;
    }
    await Linking.openURL(url);
  };

  const submitStatus = async () => {
    if (!statusCode) {
      Alert.alert("Thiếu trạng thái", "Chọn trạng thái trước khi cập nhật.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await updatePropertyStatus(token, propertyId, statusCode);
      Alert.alert("Đã cập nhật", result.message);
      await loadDetail();
      await onChanged();
    } catch (error) {
      Alert.alert("Cập nhật thất bại", normalizeApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitNote = async () => {
    if (!note.trim()) {
      Alert.alert("Thiếu ghi chú", "Nhập nội dung ghi chú trước.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await addPropertyNote(token, propertyId, note.trim());
      setNote("");
      Alert.alert("Đã thêm ghi chú", result.message);
      await loadDetail();
      await onChanged();
    } catch (error) {
      Alert.alert("Thêm ghi chú thất bại", normalizeApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screenCenter}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.screenCenter}>
        <Text style={styles.emptyStateText}>Không tìm thấy căn.</Text>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const statusTone = getStatusTone(property.status_name);
  const locationLine = [cleanDisplayText(property.district_name, ""), cleanDisplayText(property.ward_name, "")]
    .filter(Boolean)
    .join(" • ");
  const detailAddressParts = splitAddress(property.address);
  const detailFacts = [
    { icon: "map-pin" as const, label: "Khu vực", value: cleanDisplayText(property.district_name, "Chưa rõ") },
    { icon: "layers" as const, label: "Phường", value: cleanDisplayText(property.ward_name, "Chưa rõ") },
    { icon: "home" as const, label: "Loại nhà", value: cleanDisplayText(property.property_type_name, "Chưa rõ") },
    { icon: "bookmark" as const, label: "Trạng thái", value: cleanDisplayText(property.status_name, "Chưa rõ") },
    { icon: "shield" as const, label: "Pháp lý", value: cleanDisplayText(property.legal_status_name, "Chưa rõ") },
    { icon: "compass" as const, label: "Hướng", value: cleanDisplayText(property.direction_name, "Chưa rõ") },
    { icon: "user" as const, label: "Chủ nhà", value: cleanDisplayText(property.owner_name, "Chưa rõ") },
    { icon: "phone" as const, label: "Điện thoại", value: cleanDisplayText(property.contact_phone, "Chưa rõ") },
    { icon: "radio" as const, label: "Nguồn tin", value: cleanDisplayText(property.source_name, "Chưa rõ") },
    { icon: "map" as const, label: "Địa chỉ", value: cleanDisplayText(property.address, "Chưa rõ") },
  ];

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.detailTopBar}>
        <Pressable style={styles.detailNavButton} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#17305D" />
          <Text style={styles.detailNavButtonText}>Kho hàng</Text>
        </Pressable>
        <View style={styles.detailTopBarActions}>
          <Pressable style={styles.detailTopIconButton} onPress={() => void copySummary()}>
            <Feather name="copy" size={18} color="#17305D" />
          </Pressable>
          <Pressable style={styles.detailTopIconButtonPrimary} onPress={() => void makePhoneCall()}>
            <Feather name="phone" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.detailHeroCard}>
        <View style={styles.detailHeroTop}>
          <View
            style={[
              styles.statusBadge,
              styles.propertyHeroStatus,
              {
                backgroundColor: statusTone.backgroundColor,
                borderColor: statusTone.borderColor,
              },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusTone.color }]}>
              {cleanDisplayText(property.status_name, "Chưa rõ")}
            </Text>
          </View>
          <View style={styles.propertyCodePill}>
            <Text style={styles.propertyCode}>{property.code}</Text>
          </View>
        </View>
        <View style={styles.detailHeroMedia}>
          <View style={styles.detailHeroMediaIconWrap}>
            <Feather name="home" size={40} color="#96A6C0" />
          </View>
          <Text style={styles.detailHeroMediaLabel}>Chưa có ảnh</Text>
        </View>
      </View>

      <View style={styles.detailSummaryCard}>
        <Text style={styles.detailTitle}>{cleanDisplayText(property.title, "Chưa có tiêu đề")}</Text>
        <Text style={styles.detailAddressPrimary}>{detailAddressParts.primary}</Text>
        {detailAddressParts.secondary ? (
          <Text style={styles.detailAddressSecondary}>{detailAddressParts.secondary}</Text>
        ) : null}
        <Text style={styles.detailLocation}>{locationLine || "Chưa rõ khu vực"}</Text>
        <View style={styles.detailHeroMetaRow}>
          <Text style={styles.detailPrice}>{formatMoney(property.price)}</Text>
          <Text style={styles.detailArea}>{formatArea(property.area)}</Text>
        </View>
        <View style={styles.detailChipRow}>
          <View style={styles.detailChip}>
            <Text style={styles.detailChipText}>{cleanDisplayText(property.property_type_name, "Chưa rõ loại nhà")}</Text>
          </View>
          <View style={styles.detailChip}>
            <Text style={styles.detailChipText}>{cleanDisplayText(property.legal_status_name, "Chưa rõ pháp lý")}</Text>
          </View>
          <View style={styles.detailChip}>
            <Text style={styles.detailChipText}>{cleanDisplayText(property.direction_name, "Chưa rõ hướng")}</Text>
          </View>
        </View>
        <View style={styles.detailActionRow}>
          <Pressable style={styles.detailActionPrimary} onPress={() => void makePhoneCall()}>
            <Feather name="phone-call" size={16} color="#ffffff" />
            <Text style={styles.detailActionPrimaryText}>Gọi ngay</Text>
          </Pressable>
          <Pressable style={styles.detailActionSecondary} onPress={() => void copySummary()}>
            <Feather name="copy" size={16} color="#17305D" />
            <Text style={styles.detailActionSecondaryText}>Copy thông tin</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.detailContactCard}>
        <View style={styles.detailContactHeader}>
          <View style={styles.detailContactBadge}>
            <Feather name="phone" size={16} color="#F37021" />
          </View>
          <View style={styles.detailContactHeaderText}>
            <Text style={styles.detailContactEyebrow}>Liên hệ chủ nhà</Text>
            <Text style={styles.detailContactOwner}>{cleanDisplayText(property.owner_name, "Chưa rõ chủ nhà")}</Text>
          </View>
        </View>
        <Pressable style={styles.detailContactNumberWrap} onPress={() => void copySummary()}>
          <Text style={styles.detailContactNumber}>{cleanDisplayText(property.contact_phone, "Chưa có số điện thoại")}</Text>
          <Text style={styles.detailContactHint}>Chạm để copy nhanh thông tin liên hệ</Text>
        </Pressable>
        <View style={styles.detailContactActions}>
          <Pressable style={styles.detailContactPrimaryButton} onPress={() => void makePhoneCall()}>
            <Feather name="phone-call" size={16} color="#ffffff" />
            <Text style={styles.detailContactPrimaryButtonText}>Gọi số này</Text>
          </Pressable>
          <Pressable
            style={styles.detailContactSecondaryButton}
            onPress={() => void Clipboard.setStringAsync(cleanDisplayText(property.contact_phone, ""))}
          >
            <Feather name="copy" size={16} color="#17305D" />
            <Text style={styles.detailContactSecondaryButtonText}>Copy số</Text>
          </Pressable>
        </View>
      </View>

      <Section title="Thông số">
        {detailFacts.map((item) => (
          <DetailInfoRow key={item.label} icon={item.icon} label={item.label} value={item.value} />
        ))}
      </Section>

      <Section title="Mô tả">
        <Text style={styles.detailDescription}>{cleanDisplayText(property.description, "Không có mô tả.")}</Text>
      </Section>

      <Section title="Cập nhật trạng thái">
        <SelectField
          label="Trạng thái mới"
          value={statusCode}
          items={lookups.statuses}
          onChange={setStatusCode}
          allowEmpty={false}
        />
        <Pressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          disabled={submitting}
          onPress={() => void submitStatus()}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? "Đang cập nhật..." : "Cập nhật trạng thái"}
          </Text>
        </Pressable>
      </Section>

      <Section title="Ghi chú">
        <Field label="Nội dung">
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={note}
            onChangeText={setNote}
            placeholder="Nhập ghi chú mới"
          />
        </Field>
        <Pressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          disabled={submitting}
          onPress={() => void submitNote()}
        >
          <Text style={styles.primaryButtonText}>{submitting ? "Đang lưu..." : "Thêm ghi chú"}</Text>
        </Pressable>
        <View style={styles.notesGroup}>
          {property.notes.length === 0 ? (
            <Text style={styles.emptyStateText}>Chưa có ghi chú.</Text>
          ) : (
            property.notes.map((item) => (
              <View key={item.note_id} style={styles.noteRow}>
                <Text style={styles.noteMeta}>
                  {cleanDisplayText(item.created_by)} • {formatDateTime(item.created_at)}
                </Text>
                <Text style={styles.noteContent}>{cleanDisplayText(item.content)}</Text>
              </View>
            ))
          )}
        </View>
      </Section>
    </ScrollView>
  );
}

function CreatePropertyScreen({
  token,
  lookups,
  draft,
  savingDraft,
  onChangeDraft,
  onSubmitSuccess,
}: {
  token: string;
  lookups: LookupCollections;
  draft: PropertyCreatePayload;
  savingDraft: boolean;
  onChangeDraft: (patch: Partial<PropertyCreatePayload>) => void;
  onSubmitSuccess: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const wardOptions = useMemo(
    () => lookups.wards.filter((item) => !draft.district_code || item.parent_code === draft.district_code),
    [draft.district_code, lookups.wards]
  );
  const quickChecks = [
    { label: "Khu vực", done: Boolean(draft.district_code && draft.ward_code) },
    { label: "Giá", done: Boolean(draft.price && draft.price > 0) },
    { label: "Liên hệ", done: Boolean(draft.owner_name.trim() && draft.contact_phone.trim()) },
  ];

  const validate = (): string | null => {
    if (!draft.title.trim()) return "Thiếu tiêu đề căn";
    if (!draft.address.trim()) return "Thiếu địa chỉ";
    if (!draft.district_code) return "Thiếu quận";
    if (!draft.ward_code) return "Thiếu phường";
    if (!draft.property_type_code) return "Thiếu loại nhà";
    if (!draft.status_code) return "Thiếu trạng thái";
    if (!draft.source_code) return "Thiếu nguồn tin";
    if (!draft.owner_name.trim()) return "Thiếu tên chủ nhà";
    if (!draft.contact_phone.trim()) return "Thiếu số điện thoại";
    if (!draft.price || draft.price <= 0) return "Giá phải lớn hơn 0";
    if (!draft.area || draft.area <= 0) return "Diện tích phải lớn hơn 0";
    return null;
  };

  const submit = async () => {
    const error = validate();
    if (error) {
      Alert.alert("Chưa đủ dữ liệu", error);
      return;
    }
    setSubmitting(true);
    try {
      const result = await createProperty(token, draft);
      Alert.alert("Đã tạo nhà mới", result.message);
      onChangeDraft(emptyDraft);
      await AsyncStorage.removeItem(CREATE_DRAFT_KEY);
      await onSubmitSuccess();
    } catch (submitError) {
      Alert.alert("Tạo nhà thất bại", normalizeApiError(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.formHeroCard}>
        <Text style={styles.formHeroEyebrow}>NHẬP NHÀ MỚI</Text>
        <Text style={styles.formHeroTitle}>Điền nhanh các thông tin cốt lõi trước khi đẩy vào Landsoft</Text>
        <Text style={styles.formHeroDescription}>
          Form được lưu tạm trên máy. Khi mất mạng, nội dung anh đang nhập vẫn được giữ lại.
        </Text>
        <View style={styles.formHeroChipRow}>
          {quickChecks.map((item) => (
            <View
              key={item.label}
              style={[styles.formHeroChip, item.done ? styles.formHeroChipDone : styles.formHeroChipPending]}
            >
              <Text style={[styles.formHeroChipText, item.done ? styles.formHeroChipTextDone : styles.formHeroChipTextPending]}>
                {item.done ? "Đã có " : "Thiếu "}
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Section title="Thông tin chính">
        <Field label="Tiêu đề">
          <TextInput
            style={styles.input}
            value={draft.title}
            onChangeText={(value) => onChangeDraft({ title: value })}
            placeholder="Ví dụ: Nhà phố Phan Xích Long"
          />
        </Field>
        <Field label="Địa chỉ">
          <TextInput
            style={styles.input}
            value={draft.address}
            onChangeText={(value) => onChangeDraft({ address: value })}
            placeholder="Số nhà, đường, phường..."
          />
        </Field>
        <Field label="Tên đường">
          <TextInput
            style={styles.input}
            value={draft.street_name ?? ""}
            onChangeText={(value) => onChangeDraft({ street_name: value })}
            placeholder="Ví dụ: Nguyễn Đình Chiểu"
          />
        </Field>
        <SelectField
          label="Quận"
          value={draft.district_code}
          items={lookups.districts}
          onChange={(value) => onChangeDraft({ district_code: value, ward_code: "" })}
          allowEmpty={false}
        />
        <SelectField
          label="Phường"
          value={draft.ward_code}
          items={wardOptions}
          onChange={(value) => onChangeDraft({ ward_code: value })}
          allowEmpty={false}
        />
        <SelectField
          label="Loại nhà"
          value={draft.property_type_code}
          items={lookups.property_types}
          onChange={(value) => onChangeDraft({ property_type_code: value })}
          allowEmpty={false}
        />
        <SelectField
          label="Trạng thái"
          value={draft.status_code}
          items={lookups.statuses}
          onChange={(value) => onChangeDraft({ status_code: value })}
          allowEmpty={false}
        />
      </Section>

      <Section title="Giá và diện tích">
        <Field label="Giá (tỷ)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.price ? String(draft.price) : ""}
            onChangeText={(value) => onChangeDraft({ price: parseNumberInput(value) })}
            placeholder="Ví dụ: 18.5"
          />
        </Field>
        <Field label="Diện tích (m²)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.area ? String(draft.area) : ""}
            onChangeText={(value) => onChangeDraft({ area: parseNumberInput(value) })}
            placeholder="Ví dụ: 72"
          />
        </Field>
        <Field label="Ngang (m)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.width ? String(draft.width) : ""}
            onChangeText={(value) => onChangeDraft({ width: parseNumberInput(value) })}
            placeholder="Ví dụ: 4.2"
          />
        </Field>
        <Field label="Dài (m)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.length ? String(draft.length) : ""}
            onChangeText={(value) => onChangeDraft({ length: parseNumberInput(value) })}
            placeholder="Ví dụ: 13.1"
          />
        </Field>
      </Section>

      <Section title="Liên hệ">
        <Field label="Tên chủ nhà">
          <TextInput
            style={styles.input}
            value={draft.owner_name}
            onChangeText={(value) => onChangeDraft({ owner_name: value })}
            placeholder="Nhập tên chủ nhà"
          />
        </Field>
        <Field label="Số điện thoại">
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            value={draft.contact_phone}
            onChangeText={(value) => onChangeDraft({ contact_phone: value })}
            placeholder="0909..."
          />
        </Field>
        <SelectField
          label="Nguồn tin"
          value={draft.source_code}
          items={lookups.sources}
          onChange={(value) => onChangeDraft({ source_code: value })}
          allowEmpty={false}
        />
      </Section>

      <Section title="Bổ sung">
        <Field label="Số tầng">
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={draft.floors ? String(draft.floors) : ""}
            onChangeText={(value) => onChangeDraft({ floors: Math.round(parseNumberInput(value)) })}
            placeholder="Ví dụ: 4"
          />
        </Field>
        <Field label="Phòng ngủ">
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={draft.bedrooms ? String(draft.bedrooms) : ""}
            onChangeText={(value) => onChangeDraft({ bedrooms: Math.round(parseNumberInput(value)) })}
            placeholder="Ví dụ: 3"
          />
        </Field>
        <Field label="Phòng tắm">
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={draft.bathrooms ? String(draft.bathrooms) : ""}
            onChangeText={(value) => onChangeDraft({ bathrooms: Math.round(parseNumberInput(value)) })}
            placeholder="Ví dụ: 4"
          />
        </Field>
        <SelectField
          label="Pháp lý"
          value={draft.legal_status_code ?? ""}
          items={lookups.legal_statuses}
          onChange={(value) => onChangeDraft({ legal_status_code: value })}
          emptyLabel="Chưa chọn"
        />
        <SelectField
          label="Hướng"
          value={draft.direction_code ?? ""}
          items={lookups.directions}
          onChange={(value) => onChangeDraft({ direction_code: value })}
          emptyLabel="Chưa chọn"
        />
        <Field label="Mô tả">
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft.description ?? ""}
            onChangeText={(value) => onChangeDraft({ description: value })}
            placeholder="Mô tả nhanh về căn"
          />
        </Field>
        <Field label="Ghi chú ban đầu">
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft.note ?? ""}
            onChangeText={(value) => onChangeDraft({ note: value })}
            placeholder="Ghi chú cho căn mới"
          />
        </Field>
      </Section>

      <View style={styles.draftHint}>
        <Text style={styles.draftHintText}>
          {savingDraft ? "Đang lưu draft..." : "Draft form được giữ lại trên máy khi mạng chập chờn."}
        </Text>
      </View>

      <View style={styles.submitPanel}>
        <Text style={styles.submitPanelTitle}>Sẵn sàng đẩy sang Landsoft</Text>
        <Text style={styles.submitPanelDescription}>
          Chỉ gửi khi các thông tin bắt buộc đã đủ. Phần còn lại có thể bổ sung sau trong Landsoft.
        </Text>
        <Pressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          disabled={submitting}
          onPress={() => void submit()}
        >
          <Text style={styles.primaryButtonText}>{submitting ? "Đang gửi..." : "Tạo nhà mới"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ActivityScreen({
  items,
  loading,
  onReload,
}: {
  items: ActivityItem[];
  loading: boolean;
  onReload: () => Promise<void>;
}) {
  const latestTime = items[0]?.created_at || items[0]?.server_time
    ? formatDateTime(items[0]?.created_at ?? items[0]?.server_time ?? "")
    : "Chưa có dữ liệu";

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => item.id ?? `${item.action}-${item.created_at ?? item.server_time ?? index}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void onReload()} />}
        contentContainerStyle={items.length === 0 ? styles.activityListEmpty : styles.activityListContent}
        ListHeaderComponent={
          <>
            <View style={styles.activityHeroCard}>
              <Text style={styles.formHeroEyebrow}>NHẬT KÝ APP</Text>
              <Text style={styles.formHeroTitle}>Theo dõi các thao tác vừa thực hiện từ điện thoại</Text>
              <Text style={styles.formHeroDescription}>Lần đồng bộ gần nhất: {latestTime}</Text>
              <View style={styles.activityHeroStatsRow}>
                <View style={styles.activityHeroStat}>
                  <Text style={styles.activityHeroStatValue}>{String(items.length)}</Text>
                  <Text style={styles.activityHeroStatLabel}>Bản ghi gần đây</Text>
                </View>
                <Pressable style={styles.secondaryButtonCompact} onPress={() => void onReload()}>
                  <Text style={styles.secondaryButtonText}>{loading ? "Đang tải..." : "Tải lại"}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Lịch sử thao tác gần đây</Text>
              <Text style={styles.listHeaderCount}>{loading ? "Đang tải..." : String(items.length) + " mục"}</Text>
            </View>
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyStateText}>Chưa có thao tác nào từ app.</Text>}
        renderItem={({ item }) => {
          const resultMessage = cleanDisplayText(item.result_message ?? item.message, "Không có mô tả kết quả");
          const createdAt = item.created_at ?? item.server_time;
          const entityType = item.entity_type ?? item.target_type;
          const activityTone = getActivityTone(resultMessage);

          return (
          <View style={styles.activityRow}>
            <View style={styles.activityRowTop}>
              <Text style={styles.activityAction}>{formatActivityAction(item.action)}</Text>
              <View
                style={[
                  styles.activityBadge,
                  { backgroundColor: activityTone.backgroundColor },
                ]}
              >
                <Text
                  style={[
                    styles.activityBadgeText,
                    { color: activityTone.color },
                  ]}
                >
                  {activityTone.label}
                </Text>
              </View>
            </View>
            <Text style={styles.activityMeta}>
              {formatActivityEntity(entityType)} • {formatDateTime(createdAt) || "Chưa có thời gian"}
            </Text>
            <Text style={styles.activityResult}>{resultMessage}</Text>
          </View>
        )}}
      />
    </View>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [lookups, setLookups] = useState<LookupCollections>(emptyLookups);
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [propertyTotal, setPropertyTotal] = useState(0);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [filters, setFilters] = useState<PropertyFilters>(emptyFilters);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("properties");
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [draft, setDraft] = useState<PropertyCreatePayload>(emptyDraft);
  const [savingDraft, setSavingDraft] = useState(false);
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState(() => getPreferredApiBaseUrl());

  const title = useMemo(() => {
    if (selectedPropertyId && activeTab === "properties") {
      return "Chi tiết căn";
    }
    if (activeTab === "create") {
      return "Nhập nhà mới";
    }
    if (activeTab === "activity") {
      return "Lịch sử";
    }
    return "Kho hàng";
  }, [activeTab, selectedPropertyId]);

  const saveDraft = useCallback(async (nextDraft: PropertyCreatePayload) => {
    setSavingDraft(true);
    try {
      await AsyncStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(nextDraft));
    } finally {
      setSavingDraft(false);
    }
  }, []);

  const updateDraft = useCallback(
    (patch: Partial<PropertyCreatePayload>) => {
      setDraft((current) => {
        const next = { ...current, ...patch };
        void saveDraft(next);
        return next;
      });
    },
    [saveDraft]
  );

  const hydrateSession = useCallback(async () => {
    try {
      const [storedSession, storedDraft, storedApiBaseUrl] = await Promise.all([
        AsyncStorage.getItem(SESSION_KEY),
        AsyncStorage.getItem(CREATE_DRAFT_KEY),
        AsyncStorage.getItem(API_BASE_URL_KEY),
      ]);
      setApiBaseUrlInput(getPreferredApiBaseUrl(storedApiBaseUrl));
      if (storedSession) {
        const parsed: SessionState = JSON.parse(storedSession);
        const currentUser = await fetchMe(parsed.token);
        setSession({ token: parsed.token, user: currentUser });
      } else if (DEBUG_AUTO_LOGIN_USER && DEBUG_AUTO_LOGIN_PASSWORD) {
        const response = await login({
          username: DEBUG_AUTO_LOGIN_USER,
          password: DEBUG_AUTO_LOGIN_PASSWORD,
        });
        const nextSession = { token: response.access_token, user: response.user };
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
      }
      if (storedDraft) {
        setDraft({ ...emptyDraft, ...JSON.parse(storedDraft) });
      }
    } catch {
      await AsyncStorage.removeItem(SESSION_KEY);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const persistApiBaseUrl = useCallback(async (nextValue: string) => {
    const normalized = setApiBaseUrl(nextValue);
    setApiBaseUrlInput(normalized);
    if (normalized === defaultApiBaseUrl) {
      await AsyncStorage.removeItem(API_BASE_URL_KEY);
      return normalized;
    }
    await AsyncStorage.setItem(API_BASE_URL_KEY, normalized);
    return normalized;
  }, []);

  const loadLookups = useCallback(
    async (token: string) => {
      const data = await fetchLookups(token);
      setLookups(data);
      setDraft((current) => ({
        ...current,
        district_code: current.district_code || data.districts[0]?.code || "",
        ward_code:
          current.ward_code ||
          data.wards.find((item) => item.parent_code === (current.district_code || data.districts[0]?.code))?.code ||
          "",
        property_type_code: current.property_type_code || data.property_types[0]?.code || "",
        status_code: current.status_code || data.statuses[0]?.code || "",
        source_code: current.source_code || data.sources[0]?.code || "",
      }));
    },
    []
  );

  const loadProperties = useCallback(
    async (token: string, nextFilters: PropertyFilters) => {
      setPropertyLoading(true);
      try {
        const response = await fetchProperties(token, nextFilters);
        setProperties(response.items);
        setPropertyTotal(response.total);
      } catch (error) {
        Alert.alert("Không tải được kho hàng", normalizeApiError(error));
      } finally {
        setPropertyLoading(false);
      }
    },
    []
  );

  const loadActivity = useCallback(async (token: string) => {
    setActivityLoading(true);
    try {
      const response = await fetchActivity(token);
      setActivityItems(response);
    } catch (error) {
      Alert.alert("Không tải được lịch sử", normalizeApiError(error));
    } finally {
      setActivityLoading(false);
    }
  }, []);

  const refreshAuthenticatedData = useCallback(
    async (token: string, nextFilters: PropertyFilters) => {
      await Promise.all([loadLookups(token), loadProperties(token, nextFilters), loadActivity(token)]);
    },
    [loadActivity, loadLookups, loadProperties]
  );

  const handleLogin = async (payload: LoginPayload) => {
    setLoginLoading(true);
    try {
      const requestedApiBaseUrl = await persistApiBaseUrl(apiBaseUrlInput);
      let response;
      try {
        response = await login(payload);
      } catch (error) {
        const shouldRetryOnMachine =
          isConnectivityFailure(normalizeApiError(error)) &&
          requestedApiBaseUrl !== EMULATOR_API_BASE_URL;

        if (!shouldRetryOnMachine) {
          throw error;
        }

        await persistApiBaseUrl(EMULATOR_API_BASE_URL);
        response = await login(payload);
      }

      const nextSession = { token: response.access_token, user: response.user };
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (error) {
      Alert.alert("Đăng nhập thất bại", normalizeApiError(error));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setSession(null);
    setProperties([]);
    setActivityItems([]);
    setSelectedPropertyId(null);
  };

  const handleReloadProperties = useCallback(async () => {
    if (!session) {
      return;
    }
    await loadProperties(session.token, filters);
  }, [filters, loadProperties, session]);

  const handleFiltersChange = useCallback((patch: Partial<PropertyFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  useEffect(() => {
    if (!session) {
      return;
    }
    void refreshAuthenticatedData(session.token, filters);
  }, [refreshAuthenticatedData, session]);

  const handleQuickViewPhone = useCallback(
    async (landsoftId: number) => {
      if (!session) {
        return;
      }
      try {
        const detail = await fetchPropertyDetail(session.token, landsoftId);
        const ownerName = cleanDisplayText(detail.owner_name, "Chưa rõ chủ nhà");
        const phoneNumber = cleanDisplayText(detail.contact_phone, "");
        if (!phoneNumber) {
          Alert.alert("Chưa có số điện thoại", `${ownerName}\nCăn này chưa có số liên hệ.`, [
            { text: "Đóng", style: "cancel" },
            { text: "Mở hồ sơ", onPress: () => setSelectedPropertyId(landsoftId) },
          ]);
          return;
        }

        Alert.alert("Số điện thoại chủ nhà", `${ownerName}\n${phoneNumber}`, [
          { text: "Copy số", onPress: () => void Clipboard.setStringAsync(phoneNumber) },
          { text: "Mở hồ sơ", onPress: () => setSelectedPropertyId(landsoftId) },
          { text: "Đóng", style: "cancel" },
        ]);
      } catch (error) {
        Alert.alert("Không lấy được số điện thoại", normalizeApiError(error));
      }
    },
    [session]
  );

  if (booting) {
    return (
      <SafeAreaView style={styles.screenCenter}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#F37021" />
        <Text style={styles.bootText}>Đang khởi tạo app...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        apiBaseUrlValue={apiBaseUrlInput}
        loading={loginLoading}
        onChangeApiBaseUrl={setApiBaseUrlInput}
        onUseEmulatorApiBaseUrl={() => setApiBaseUrlInput(EMULATOR_API_BASE_URL)}
        onLogin={handleLogin}
      />
    );
  }

  const isPropertyDetailView = Boolean(selectedPropertyId && activeTab === "properties");

  return (
    <SafeAreaView style={styles.appShell}>
      <StatusBar style="dark" />
      {!isPropertyDetailView ? (
        <AppHeader user={session.user} title={title} onLogout={() => void handleLogout()} />
      ) : null}
      {selectedPropertyId && activeTab === "properties" ? (
        <PropertyDetailScreen
          token={session.token}
          propertyId={selectedPropertyId}
          lookups={lookups}
          onBack={() => setSelectedPropertyId(null)}
          onChanged={async () => {
            await loadProperties(session.token, filters);
            await loadActivity(session.token);
          }}
        />
      ) : null}

      {!selectedPropertyId && activeTab === "properties" ? (
        <PropertyListScreen
          filters={filters}
          items={properties}
          totalCount={propertyTotal}
          lookups={lookups}
          loading={propertyLoading}
          refreshing={propertyLoading}
          onChangeFilter={handleFiltersChange}
          onReload={handleReloadProperties}
          onOpenProperty={(landsoftId) => setSelectedPropertyId(landsoftId)}
          onQuickViewPhone={handleQuickViewPhone}
          onGoCreate={() => setActiveTab("create")}
        />
      ) : null}

      {activeTab === "create" ? (
        <CreatePropertyScreen
          token={session.token}
          lookups={lookups}
          draft={draft}
          savingDraft={savingDraft}
          onChangeDraft={updateDraft}
          onSubmitSuccess={async () => {
            setActiveTab("properties");
            await Promise.all([loadProperties(session.token, filters), loadActivity(session.token)]);
          }}
        />
      ) : null}

      {activeTab === "activity" ? (
        <ActivityScreen items={activityItems} loading={activityLoading} onReload={() => loadActivity(session.token)} />
      ) : null}

      <TabBar
        activeTab={activeTab}
        onChange={(tab) => {
          setSelectedPropertyId(null);
          setActiveTab(tab);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: "#F3F6FB",
  },
  loginScreen: {
    flex: 1,
    backgroundColor: "#F3F6FB",
    justifyContent: "center",
    padding: 18,
  },
  loginPanel: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 22,
    gap: 14,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    shadowColor: "#17305D",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  loginTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#17305D",
  },
  loginDescription: {
    fontSize: 15,
    lineHeight: 22,
    color: "#64748B",
  },
  configBanner: {
    borderRadius: 8,
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#99f6e4",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  configBannerText: {
    fontSize: 12,
    color: "#115e59",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#ffffff",
    gap: 12,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerActions: {
    alignItems: "flex-end",
    gap: 8,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: "#17305D",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#17305D",
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#7C8BA1",
  },
  userPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E3EAF3",
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#17305D",
  },
  userAvatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  userPillTextGroup: {
    alignItems: "flex-start",
  },
  userPillName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#17305D",
  },
  userPillRole: {
    fontSize: 12,
    color: "#7C8BA1",
    fontWeight: "600",
  },
  logoutPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
  },
  logoutPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#17305D",
  },
  screen: {
    flex: 1,
    backgroundColor: "#F3F6FB",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
  },
  section: {
    marginBottom: 14,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#DCE3EE",
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#17305D",
  },
  fieldBlock: {
    marginBottom: 12,
  },
  fieldLabel: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#425466",
  },
  input: {
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: "#17305D",
  },
  apiPresetRow: {
    marginTop: 10,
    gap: 10,
  },
  apiPresetButtonPrimary: {
    minHeight: 40,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#F7F9FC",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  apiPresetButtonPrimaryText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#17305D",
  },
  apiPresetHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  apiPresetHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#7C8BA1",
  },
  searchInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 0,
    paddingVertical: 10,
    fontSize: 15,
    color: "#17305D",
  },
  searchInputWrap: {
    flex: 1,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    paddingLeft: 16,
    paddingRight: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInputIcon: {
    fontSize: 18,
    color: "#7C8BA1",
    marginTop: -1,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#DCE3EE",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F37021",
    paddingHorizontal: 16,
  },
  primaryButtonCompact: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F37021",
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonCompactWide: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F37021",
    paddingHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },
  primaryButtonInline: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#F37021",
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryButton: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
  },
  secondaryButtonCompact: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
  },
  secondaryButtonCompactWide: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 8,
  },
  secondaryButtonInline: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: "#17305D",
    fontWeight: "700",
    fontSize: 14,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  tabBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#ffffff",
  },
  tabButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E5ECF4",
  },
  tabButtonIcon: {
    marginBottom: 4,
  },
  tabButtonActive: {
    backgroundColor: "#17305D",
    borderColor: "#17305D",
  },
  tabButtonText: {
    color: "#53657D",
    fontWeight: "700",
    fontSize: 12,
  },
  tabButtonTextActive: {
    color: "#ffffff",
  },
  marketListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  marketListContentEmpty: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  marketOverview: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#DCE3EE",
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    gap: 12,
  },
  marketOverviewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  marketOverviewBadge: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF3FB",
  },
  marketOverviewTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  marketOverviewIconButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
  },
  marketOverviewIconButtonActive: {
    backgroundColor: "#17305D",
    borderColor: "#17305D",
  },
  marketOverviewAddButton: {
    minHeight: 42,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: "#F37021",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  marketOverviewAddButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  marketOverviewTextGroup: {
    gap: 2,
    flex: 1,
  },
  marketOverviewLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    color: "#7C8BA1",
  },
  marketOverviewStat: {
    fontSize: 28,
    fontWeight: "800",
    color: "#17305D",
  },
  marketOverviewHint: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: "#7C8BA1",
  },
  searchPanel: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#DCE3EE",
    borderRadius: 28,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  searchToolbar: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  searchToolbarIconButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarPillRow: {
    flexDirection: "row",
    gap: 10,
  },
  filterChipRow: {
    gap: 8,
    paddingTop: 2,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E8EEF5",
    backgroundColor: "#F7F9FC",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#425466",
  },
  filterPanel: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#DCE3EE",
    borderRadius: 24,
    padding: 14,
    marginBottom: 12,
  },
  filterPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  filterPanelTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17305D",
  },
  filterGroupLabel: {
    marginTop: 4,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "800",
    color: "#17305D",
  },
  filterResetText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#F37021",
  },
  filterRangeRow: {
    flexDirection: "row",
    gap: 10,
  },
  filterRangeField: {
    flex: 1,
  },
  filterButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  listHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#17305D",
  },
  listHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  listHeaderCount: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7C8BA1",
    backgroundColor: "#EEF3FB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyStateText: {
    color: "#64748B",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  propertyRow: {
    marginBottom: 14,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    shadowColor: "#17305D",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  createFab: {
    position: "absolute",
    right: 16,
    bottom: 18,
    minHeight: 54,
    borderRadius: 20,
    paddingHorizontal: 18,
    backgroundColor: "#F37021",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#F37021",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 5,
  },
  createFabText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  propertyCardTapArea: {
    overflow: "hidden",
  },
  propertyHero: {
    minHeight: 168,
    backgroundColor: "#E7EEF8",
    padding: 16,
    justifyContent: "space-between",
  },
  propertyHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  propertyHeroStatus: {
    backgroundColor: "#ffffff",
  },
  propertyHeroTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  propertyCodePill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  propertyCode: {
    fontSize: 13,
    fontWeight: "800",
    color: "#17305D",
  },
  propertyHeroBody: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 8,
  },
  propertyHeroIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 26,
    backgroundColor: "#F9FBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  propertyFavoriteBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4ECF6",
  },
  propertyHeroLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#8B9AB0",
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  propertyBody: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  propertyPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  propertyUpdatedChip: {
    borderRadius: 999,
    backgroundColor: "#FFF1E7",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  propertyUpdatedChipText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#F37021",
  },
  propertyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#17305D",
    lineHeight: 25,
    marginBottom: 6,
  },
  propertyLocation: {
    fontSize: 14,
    color: "#53657D",
    marginBottom: 8,
  },
  propertyPrice: {
    flex: 1,
    fontSize: 30,
    fontWeight: "800",
    color: "#17305D",
  },
  propertyFactsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  propertyFact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E5ECF4",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  propertyFactText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#5A6A82",
  },
  propertyAddressPrimary: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: "#17305D",
    marginBottom: 2,
  },
  propertyAddressSecondary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#7C8BA1",
    marginBottom: 8,
  },
  propertySnippet: {
    fontSize: 13,
    lineHeight: 20,
    color: "#53657D",
    marginBottom: 12,
  },
  propertyActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  propertyActionBar: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    marginTop: -2,
  },
  propertyPrimaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: "#F37021",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  propertyPrimaryActionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  propertySecondaryAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#F8FBFF",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  propertySecondaryActionText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#17305D",
  },
  listRow: {
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#ffffff",
    padding: 14,
  },
  listRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  listRowCode: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0f766e",
  },
  listRowStatus: {
    fontSize: 12,
    color: "#475569",
  },
  listRowTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  listRowMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#475569",
  },
  listRowDescription: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
  },
  screenCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F6FB",
    padding: 20,
    gap: 12,
  },
  bootText: {
    color: "#53657D",
  },
  detailTopBar: {
    marginTop: 4,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  detailNavButton: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#DCE3EE",
  },
  detailNavButtonText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#17305D",
  },
  detailTopBarActions: {
    flexDirection: "row",
    gap: 8,
  },
  detailTopIconButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTopIconButtonPrimary: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: "#F37021",
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeroCard: {
    marginBottom: 0,
    borderRadius: 28,
    padding: 16,
    backgroundColor: "#E7EEF8",
    borderWidth: 1,
    borderColor: "#D8E3F3",
  },
  detailHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 22,
  },
  detailHeroMedia: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 170,
    gap: 12,
  },
  detailHeroMediaIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 30,
    backgroundColor: "#F9FBFE",
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeroMediaLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#8B9AB0",
  },
  detailSummaryCard: {
    marginTop: -28,
    marginBottom: 14,
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#DCE3EE",
    shadowColor: "#17305D",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 3,
  },
  formHeroCard: {
    marginBottom: 14,
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#EAF1FB",
    borderWidth: 1,
    borderColor: "#D8E3F3",
  },
  formHeroEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0,
    color: "#7C8BA1",
    marginBottom: 8,
  },
  formHeroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#17305D",
    lineHeight: 28,
  },
  formHeroDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#53657D",
  },
  formHeroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  formHeroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  formHeroChipDone: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  formHeroChipPending: {
    backgroundColor: "#FFF7ED",
    borderColor: "#FED7AA",
  },
  formHeroChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  formHeroChipTextDone: {
    color: "#047857",
  },
  formHeroChipTextPending: {
    color: "#C2410C",
  },
  backButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#DCE3EE",
  },
  detailHeroMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 12,
  },
  detailPrice: {
    flex: 1,
    fontSize: 28,
    fontWeight: "800",
    color: "#17305D",
  },
  detailArea: {
    fontSize: 16,
    fontWeight: "700",
    color: "#53657D",
  },
  detailChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  detailChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5ECF4",
    backgroundColor: "#F8FAFD",
  },
  detailChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#425466",
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#17305D",
    lineHeight: 32,
    marginBottom: 6,
  },
  detailLocation: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 12,
  },
  detailAddressPrimary: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "800",
    color: "#17305D",
    marginTop: 4,
    marginBottom: 2,
  },
  detailAddressSecondary: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#6B7D96",
    marginBottom: 6,
  },
  detailActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  detailActionPrimary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: "#F37021",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detailActionPrimaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#ffffff",
  },
  detailActionSecondary: {
    flex: 1,
    minHeight: 46,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detailActionSecondaryText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#17305D",
  },
  detailContactCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#D9E4F2",
    padding: 20,
    gap: 16,
    shadowColor: "#17305D",
    shadowOpacity: 0.05,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  detailContactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  detailContactBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#FFF3EB",
    alignItems: "center",
    justifyContent: "center",
  },
  detailContactHeaderText: {
    flex: 1,
    gap: 2,
  },
  detailContactEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F37021",
    textTransform: "uppercase",
  },
  detailContactOwner: {
    fontSize: 17,
    fontWeight: "700",
    color: "#17305D",
  },
  detailContactNumberWrap: {
    borderRadius: 22,
    backgroundColor: "#F8FBFF",
    borderWidth: 1,
    borderColor: "#D7E3F3",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 6,
  },
  detailContactNumber: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    color: "#0F172A",
  },
  detailContactHint: {
    fontSize: 13,
    lineHeight: 18,
    color: "#6B7D96",
  },
  detailContactActions: {
    flexDirection: "row",
    gap: 12,
  },
  detailContactPrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: "#F37021",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detailContactPrimaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  detailContactSecondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D7E3F3",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  detailContactSecondaryButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#17305D",
  },
  detailInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EDF2F7",
  },
  detailInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  detailInfoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#FFF4EC",
    alignItems: "center",
    justifyContent: "center",
  },
  detailInfoLabel: {
    flex: 1,
    fontSize: 14,
    color: "#64748B",
  },
  detailInfoValue: {
    maxWidth: "48%",
    fontSize: 14,
    fontWeight: "700",
    color: "#17305D",
    textAlign: "right",
  },
  detailDescription: {
    fontSize: 14,
    lineHeight: 22,
    color: "#53657D",
  },
  notesGroup: {
    marginTop: 12,
    gap: 10,
  },
  noteRow: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
  },
  noteMeta: {
    fontSize: 12,
    color: "#7C8BA1",
    marginBottom: 4,
  },
  noteContent: {
    fontSize: 14,
    color: "#17305D",
    lineHeight: 20,
  },
  draftHint: {
    marginBottom: 12,
  },
  draftHintText: {
    fontSize: 12,
    color: "#7C8BA1",
  },
  submitPanel: {
    marginBottom: 18,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    gap: 8,
  },
  submitPanelTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#17305D",
  },
  submitPanelDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: "#64748B",
    marginBottom: 4,
  },
  activityListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  activityListEmpty: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  activityHeroCard: {
    marginBottom: 14,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
  },
  activityHeroStatsRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  activityHeroStat: {
    flex: 1,
    minHeight: 82,
    borderRadius: 20,
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E6EDF5",
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  activityHeroStatValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#17305D",
  },
  activityHeroStatLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#7C8BA1",
  },
  activityRow: {
    marginBottom: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#DCE3EE",
    backgroundColor: "#ffffff",
    padding: 16,
  },
  activityRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
  },
  activityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  activityBadgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  activityAction: {
    fontSize: 14,
    fontWeight: "800",
    color: "#17305D",
    flex: 1,
  },
  activityMeta: {
    fontSize: 13,
    color: "#7C8BA1",
    lineHeight: 20,
  },
  activityResult: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#425466",
  },
});

