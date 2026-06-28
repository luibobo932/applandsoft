import { Feather } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Field, SelectField } from "../components/shared";
import { RangeSlider } from "../components/RangeSlider";
import { styles } from "../styles";
import {
  buildRangeLabel,
  cleanDisplayText,
  formatCount,
  formatDateTime,
  formatFilterNumber,
  formatMoney,
  parseNumberInput,
  pickLabel,
  getStatusTone,
} from "../utils";
import { LookupCollections, PropertyFilters, PropertySummary } from "../types";

const PRICE_MAX = 500; // ty
const AREA_MAX = 200; // m2

type QuickRange = { label: string; min?: number; max?: number };

const PRICE_CHIPS: QuickRange[] = [
  { label: "0 - 3 tỷ", max: 3 },
  { label: "3 - 5 tỷ", min: 3, max: 5 },
  { label: "5 - 10 tỷ", min: 5, max: 10 },
  { label: "10 - 20 tỷ", min: 10, max: 20 },
  { label: "20+ tỷ", min: 20 },
];

const AREA_CHIPS: QuickRange[] = [
  { label: "< 50 m²", max: 50 },
  { label: "50 - 80 m²", min: 50, max: 80 },
  { label: "80 - 120 m²", min: 80, max: 120 },
  { label: "120 - 200 m²", min: 120, max: 200 },
  { label: "200+ m²", min: 200 },
];

// Loai nha 2 cap nhu app SKL: Mat tien / Hem (hem -> xe hoi, 3 gac, xe may)
const MAT_TIEN_TYPE = "1";
const HEM_ALL_TYPES = "2,12,13,14"; // Nha hem + Hem xe tai + xe hoi + ba gac
const HEM_SUBS: { value: string; label: string }[] = [
  { value: "13", label: "Hẻm xe hơi" },
  { value: "14", label: "Hẻm 3 gác" },
  { value: "2", label: "Hẻm xe máy" },
];
const isHemTypes = (value?: string) =>
  value === HEM_ALL_TYPES || HEM_SUBS.some((sub) => sub.value === value);

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "newest", label: "Mới nhất" },
  { value: "price_desc", label: "Giá cao → thấp" },
  { value: "price_asc", label: "Giá thấp → cao" },
  { value: "area_desc", label: "Diện tích lớn → nhỏ" },
  { value: "area_asc", label: "Diện tích nhỏ → lớn" },
];

// Tach danh sach quan da chon tu chuoi CSV
function parseDistrictCsv(value?: string): string[] {
  return (value ?? "").split(",").map((item) => item.trim()).filter(Boolean);
}

export function PropertyListScreen({
  filters,
  items,
  totalCount,
  lookups,
  loading,
  refreshing,
  loadingMore,
  onChangeFilter,
  onReload,
  onLoadMore,
  onOpenProperty,
  onQuickViewPhone,
}: {
  filters: PropertyFilters;
  items: PropertySummary[];
  totalCount: number;
  lookups: LookupCollections;
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  onChangeFilter: (patch: Partial<PropertyFilters>) => void;
  onReload: () => Promise<void>;
  onLoadMore: () => void;
  onOpenProperty: (landsoftId: number) => void;
  onQuickViewPhone: (landsoftId: number) => Promise<void>;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const resetFilters = useCallback(() => {
    onChangeFilter({
      keyword: "",
      phone: "",
      district: "",
      districts: "",
      ward: "",
      street: "",
      status: "",
      property_type: "",
      property_types: "",
      price_min: undefined,
      price_max: undefined,
      area_min: undefined,
      area_max: undefined,
      width_min: undefined,
      sort: "newest",
      page: 1,
    });
  }, [onChangeFilter]);
  const selectedDistricts = parseDistrictCsv(filters.districts);
  const toggleDistrict = useCallback(
    (code: string) => {
      const current = parseDistrictCsv(filters.districts);
      const next = current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code];
      onChangeFilter({ districts: next.join(","), district: "", ward: "" });
    },
    [filters.districts, onChangeFilter]
  );
  const wardOptions = useMemo(
    () =>
      lookups.wards.filter(
        (item) =>
          selectedDistricts.length === 0 ||
          (item.parent_code != null && selectedDistricts.includes(item.parent_code))
      ),
    [selectedDistricts, lookups.wards]
  );
  const districtChipLabel =
    selectedDistricts.length > 0
      ? selectedDistricts.map((code) => pickLabel(lookups.districts, code)).join(", ")
      : "";
  const propertyTypeChipLabel = !filters.property_types
    ? ""
    : filters.property_types === MAT_TIEN_TYPE
    ? "Nhà mặt tiền"
    : HEM_SUBS.find((sub) => sub.value === filters.property_types)?.label ??
      (filters.property_types === HEM_ALL_TYPES ? "Nhà hẻm" : "Loại nhà");
  const activeFilterChips = [
    filters.keyword?.trim() ? "Từ khóa: " + filters.keyword.trim() : "",
    propertyTypeChipLabel,
    districtChipLabel,
    filters.ward ? pickLabel(lookups.wards, filters.ward) : "",
    filters.street?.trim() ? "Đường: " + filters.street.trim() : "",
    filters.status ? pickLabel(lookups.statuses, filters.status) : "",
    buildRangeLabel("Giá", filters.price_min, filters.price_max, " tỷ"),
    buildRangeLabel("DT", filters.area_min, filters.area_max, " m²"),
    filters.width_min != null ? `Ngang ≥ ${filters.width_min}m` : "",
  ].filter(Boolean);
  const activeFilterCount = activeFilterChips.length;
  const summaryLabel =
    loading ? "Đang đồng bộ kho hàng..." : String(items.length) + " căn đang hiển thị";
  const overviewHint =
    activeFilterCount > 0
      ? activeFilterChips.join(" • ")
      : `Tổng kho ${formatCount(totalCount)} căn trong HomeApp. Tìm nhanh theo tên, mô tả, địa chỉ hoặc mở bộ lọc nâng cao.`;

  // "Đang bán" = Mở bán, "Đã bán" = Đã giao dịch — tìm theo nhãn trạng thái của Landsoft
  const findStatusCode = (...keywords: string[]) =>
    lookups.statuses.find((item) =>
      keywords.every((kw) => (item.label ?? "").toLowerCase().includes(kw))
    )?.code ?? "";
  const sellingStatusCode = findStatusCode("mở", "bán");
  const soldStatusCode = findStatusCode("đã", "giao") || findStatusCode("đã", "bán");
  const currentSort = filters.sort ?? "newest";

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.landsoft_id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onReload()} />}
        contentContainerStyle={items.length === 0 ? styles.marketListContentEmpty : styles.marketListContent}
        onEndReached={() => onLoadMore()}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          items.length > 0 ? (
            <View style={styles.listFooter}>
              {loadingMore ? (
                <>
                  <ActivityIndicator size="small" color="#F37021" />
                  <Text style={styles.listFooterText}>Đang tải thêm...</Text>
                </>
              ) : items.length >= totalCount ? (
                <Text style={styles.listFooterText}>Đã hiện hết {formatCount(totalCount)} căn</Text>
              ) : (
                <Pressable style={styles.loadMoreButton} onPress={() => onLoadMore()}>
                  <Feather name="chevron-down" size={16} color="#F37021" />
                  <Text style={styles.loadMoreButtonText}>
                    Tải thêm ({formatCount(items.length)}/{formatCount(totalCount)})
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null
        }
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
                    placeholder="Nhập số nhà + tên đường, VD: 5A/1 Mai Hắc Đế"
                    returnKeyType="search"
                    onSubmitEditing={() => void onReload()}
                  />
                </View>
                <Pressable style={styles.searchToolbarIconButton} onPress={() => setShowFilters((current) => !current)}>
                  <Feather name={showFilters ? "chevron-up" : "sliders"} size={18} color="#17305D" />
                </Pressable>
              </View>
              {/* Tim theo SDT chu nha — LIVE: go du so la tu hien ket qua o duoi */}
              <View style={styles.phoneSearchWrap}>
                <Feather name="phone" size={17} color="#15428B" />
                <TextInput
                  style={styles.searchInput}
                  value={filters.phone ?? ""}
                  onChangeText={(value) => onChangeFilter({ phone: value })}
                  placeholder="Tìm theo SĐT chủ nhà — tự hiện khi gõ đủ số"
                  keyboardType="phone-pad"
                />
                {filters.phone?.trim() ? (
                  <Pressable onPress={() => onChangeFilter({ phone: "" })} hitSlop={8}>
                    <Feather name="x-circle" size={17} color="#94A3B8" />
                  </Pressable>
                ) : null}
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
                    <Pressable onPress={() => { resetFilters(); void onReload(); }}>
                      <Text style={styles.filterResetText}>Xóa nhanh</Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.filterGroupLabel}>Khu vực — Quận/Huyện ưu tiên</Text>
                {selectedDistricts.length > 0 ? (
                  <View style={styles.quickChipRow}>
                    {selectedDistricts.map((code) => (
                      <Pressable
                        key={code}
                        style={[styles.quickChip, styles.quickChipActive]}
                        onPress={() => toggleDistrict(code)}
                      >
                        <Text style={styles.quickChipTextActive}>{pickLabel(lookups.districts, code)}  ✕</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <SelectField
                  label="Thêm quận/huyện"
                  value=""
                  items={lookups.districts.filter((d) => !selectedDistricts.includes(d.code))}
                  onChange={(value) => {
                    if (value) toggleDistrict(value);
                  }}
                  emptyLabel="Chọn để thêm (có thể chọn nhiều)"
                />
                {wardOptions.length > 0 ? (
                  <SelectField
                    label="Phường / Xã"
                    value={filters.ward ?? ""}
                    items={wardOptions}
                    onChange={(value) => onChangeFilter({ ward: value })}
                    emptyLabel="Tất cả phường"
                  />
                ) : null}
                <Field label="Đường (tên đường)">
                  <TextInput
                    style={styles.input}
                    value={filters.street ?? ""}
                    onChangeText={(value) => onChangeFilter({ street: value })}
                    placeholder="VD: Nguyễn Trãi"
                    returnKeyType="search"
                  />
                </Field>

                <Text style={styles.filterGroupLabel}>Loại nhà</Text>
                <View style={styles.typeToggleRow}>
                  <Pressable
                    style={[styles.typeToggleButton, !filters.property_types && styles.typeToggleButtonActive]}
                    onPress={() => onChangeFilter({ property_types: "", property_type: "" })}
                  >
                    <Text style={[styles.typeToggleText, !filters.property_types && styles.typeToggleTextActive]}>
                      Tất cả
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.typeToggleButton, filters.property_types === MAT_TIEN_TYPE && styles.typeToggleButtonActive]}
                    onPress={() => onChangeFilter({ property_types: MAT_TIEN_TYPE, property_type: "" })}
                  >
                    <Text style={[styles.typeToggleText, filters.property_types === MAT_TIEN_TYPE && styles.typeToggleTextActive]}>
                      Nhà mặt tiền
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.typeToggleButton, isHemTypes(filters.property_types) && styles.typeToggleButtonActive]}
                    onPress={() => onChangeFilter({ property_types: HEM_ALL_TYPES, property_type: "" })}
                  >
                    <Text style={[styles.typeToggleText, isHemTypes(filters.property_types) && styles.typeToggleTextActive]}>
                      Nhà hẻm
                    </Text>
                  </Pressable>
                </View>
                {isHemTypes(filters.property_types) ? (
                  <View style={styles.quickChipRow}>
                    {HEM_SUBS.map((sub) => {
                      const active = filters.property_types === sub.value;
                      return (
                        <Pressable
                          key={sub.value}
                          style={[styles.quickChip, active && styles.quickChipActive]}
                          onPress={() =>
                            onChangeFilter({ property_types: active ? HEM_ALL_TYPES : sub.value, property_type: "" })
                          }
                        >
                          <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{sub.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                <Text style={styles.filterGroupLabel}>Trạng thái</Text>
                <SelectField
                  label="Trạng thái"
                  value={filters.status ?? ""}
                  items={lookups.statuses}
                  onChange={(value) => onChangeFilter({ status: value })}
                  emptyLabel="Tất cả trạng thái"
                />

                <Text style={styles.filterGroupLabel}>Giá (tỷ đồng)</Text>
                <RangeSlider
                  min={0}
                  max={PRICE_MAX}
                  step={1}
                  low={filters.price_min ?? 0}
                  high={filters.price_max ?? PRICE_MAX}
                  onChange={(low, high) =>
                    onChangeFilter({
                      price_min: low > 0 ? low : undefined,
                      price_max: high < PRICE_MAX ? high : undefined,
                    })
                  }
                />
                <Text style={styles.rangeValueLabel}>
                  Khoảng giá: {filters.price_min ?? 0} – {filters.price_max != null ? filters.price_max : `${PRICE_MAX}+`} tỷ
                </Text>
                <View style={styles.quickChipRow}>
                  {PRICE_CHIPS.map((chip) => {
                    const active =
                      (filters.price_min ?? undefined) === chip.min &&
                      (filters.price_max ?? undefined) === chip.max;
                    return (
                      <Pressable
                        key={chip.label}
                        style={[styles.quickChip, active && styles.quickChipActive]}
                        onPress={() =>
                          onChangeFilter(
                            active
                              ? { price_min: undefined, price_max: undefined }
                              : { price_min: chip.min, price_max: chip.max }
                          )
                        }
                      >
                        <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{chip.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.filterGroupLabel}>Diện tích (m²)</Text>
                <RangeSlider
                  min={0}
                  max={AREA_MAX}
                  step={5}
                  low={filters.area_min ?? 0}
                  high={filters.area_max ?? AREA_MAX}
                  onChange={(low, high) =>
                    onChangeFilter({
                      area_min: low > 0 ? low : undefined,
                      area_max: high < AREA_MAX ? high : undefined,
                    })
                  }
                />
                <View style={styles.filterRangeRow}>
                  <View style={styles.filterRangeField}>
                    <Field label="Từ (m²)">
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={formatFilterNumber(filters.area_min)}
                        onChangeText={(value) =>
                          onChangeFilter({ area_min: value.trim() ? parseNumberInput(value) : undefined })
                        }
                        placeholder="0"
                      />
                    </Field>
                  </View>
                  <View style={styles.filterRangeField}>
                    <Field label="Đến (m²)">
                      <TextInput
                        style={styles.input}
                        keyboardType="decimal-pad"
                        value={formatFilterNumber(filters.area_max)}
                        onChangeText={(value) =>
                          onChangeFilter({ area_max: value.trim() ? parseNumberInput(value) : undefined })
                        }
                        placeholder="200"
                      />
                    </Field>
                  </View>
                </View>
                <View style={styles.quickChipRow}>
                  {AREA_CHIPS.map((chip) => {
                    const active =
                      (filters.area_min ?? undefined) === chip.min &&
                      (filters.area_max ?? undefined) === chip.max;
                    return (
                      <Pressable
                        key={chip.label}
                        style={[styles.quickChip, active && styles.quickChipActive]}
                        onPress={() =>
                          onChangeFilter(
                            active
                              ? { area_min: undefined, area_max: undefined }
                              : { area_min: chip.min, area_max: chip.max }
                          )
                        }
                      >
                        <Text style={[styles.quickChipText, active && styles.quickChipTextActive]}>{chip.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.filterGroupLabel}>Khác</Text>
                <Field label="Chiều ngang tối thiểu (m)">
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={formatFilterNumber(filters.width_min)}
                    onChangeText={(value) =>
                      onChangeFilter({ width_min: value.trim() ? parseNumberInput(value) : undefined })
                    }
                    placeholder="VD: 4.5"
                  />
                </Field>
                <View style={styles.typeToggleRow}>
                  {sellingStatusCode ? (
                    <Pressable
                      style={[styles.typeToggleButton, filters.status === sellingStatusCode && styles.typeToggleButtonActive]}
                      onPress={() =>
                        onChangeFilter({ status: filters.status === sellingStatusCode ? "" : sellingStatusCode })
                      }
                    >
                      <Text style={[styles.typeToggleText, filters.status === sellingStatusCode && styles.typeToggleTextActive]}>
                        Đang bán
                      </Text>
                    </Pressable>
                  ) : null}
                  {soldStatusCode ? (
                    <Pressable
                      style={[styles.typeToggleButton, filters.status === soldStatusCode && styles.typeToggleButtonActive]}
                      onPress={() =>
                        onChangeFilter({ status: filters.status === soldStatusCode ? "" : soldStatusCode })
                      }
                    >
                      <Text style={[styles.typeToggleText, filters.status === soldStatusCode && styles.typeToggleTextActive]}>
                        Đã bán
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                <Text style={styles.filterGroupLabel}>Sắp xếp</Text>
                <View style={styles.typeToggleRow}>
                  {SORT_OPTIONS.map((option) => {
                    const active = currentSort === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        style={[styles.typeToggleButton, active && styles.typeToggleButtonActive]}
                        onPress={() => onChangeFilter({ sort: option.value })}
                      >
                        <Text style={[styles.typeToggleText, active && styles.typeToggleTextActive]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.filterButtonRow}>
                  <Pressable style={styles.primaryButtonInline} onPress={() => void onReload()}>
                    <Text style={styles.primaryButtonText}>Áp dụng bộ lọc</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryButtonInline} onPress={() => { resetFilters(); void onReload(); }}>
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
                {loading || loadingMore ? <ActivityIndicator size="small" color="#F37021" /> : null}
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
          const ownerName = cleanDisplayText(item.owner_name, "");
          const phone = cleanDisplayText(item.contact_phone, "");
          const dims =
            item.width && item.width > 0 && item.length && item.length > 0
              ? `${item.width}×${item.length}m`
              : item.area && item.area > 0
              ? `${item.area}m²`
              : null;
          const address = cleanDisplayText(item.address, "");
          const district = cleanDisplayText(item.district_name, "");
          const ward = cleanDisplayText(item.ward_name, "");
          const location = [ward, district].filter(Boolean).join(" · ");
          const locationLine = [address, location].filter(Boolean).join(", ")
            || cleanDisplayText(item.title, item.code);
          const createdAt = formatDateTime(item.created_at);
          return (
            <Pressable style={styles.propCard} onPress={() => onOpenProperty(item.landsoft_id)}>
              {/* Row 1: giá + dims + status */}
              <View style={styles.propCardRow1}>
                <Text style={styles.propCardPrice}>{formatMoney(item.price)}</Text>
                {dims ? <Text style={styles.propCardDims}>{dims}</Text> : null}
                <View style={[styles.propCardBadge, { backgroundColor: statusTone.backgroundColor, borderColor: statusTone.borderColor }]}>
                  <Text style={[styles.propCardBadgeText, { color: statusTone.color }]}>
                    {cleanDisplayText(item.status_name, "?")}
                  </Text>
                </View>
              </View>
              {/* Row 2: địa chỉ */}
              <Text style={styles.propCardAddress} numberOfLines={2}>{locationLine}</Text>
              {/* Row 3: chủ nhà + SĐT */}
              <View style={styles.propCardContactRow}>
                <Feather name="user" size={12} color="#8B9AB0" />
                <Text style={styles.propCardContact} numberOfLines={1}>
                  {ownerName || "Chưa có chủ nhà"}
                  {phone ? `  ·  ${phone}` : ""}
                </Text>
                {phone ? (
                  <Pressable
                    style={styles.propCardPhoneBtn}
                    onPress={() => void onQuickViewPhone(item.landsoft_id)}
                    hitSlop={10}
                  >
                    <Feather name="phone-call" size={13} color="#F37021" />
                  </Pressable>
                ) : null}
              </View>
              {/* Row 4: ngày giờ nhập */}
              {createdAt ? (
                <View style={styles.propCardDateRow}>
                  <Feather name="clock" size={11} color="#94A3B8" />
                  <Text style={styles.propCardDate}>Nhập: {createdAt}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}
