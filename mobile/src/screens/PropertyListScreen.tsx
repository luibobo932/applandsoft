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
import { styles } from "../styles";
import {
  buildRangeLabel,
  cleanDisplayText,
  formatArea,
  formatCount,
  formatFilterNumber,
  formatMoney,
  parseNumberInput,
  pickLabel,
  splitAddress,
  getStatusTone,
  getInitials,
} from "../utils";
import { LookupCollections, PropertyFilters, PropertySummary } from "../types";

export function PropertyListScreen({
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
                    <Pressable onPress={resetFilters}>
                      <Text style={styles.filterResetText}>Xóa nhanh</Text>
                    </Pressable>
                  ) : null}
                </View>
                <SelectField
                  label="Quận"
                  value={filters.district ?? ""}
                  items={lookups.districts}
                  onChange={(value) => {
                    onChangeFilter({ district: value, ward: "" });
                    void onReload();
                  }}
                  emptyLabel="Tất cả quận"
                />
                <SelectField
                  label="Phường"
                  value={filters.ward ?? ""}
                  items={wardOptions}
                  onChange={(value) => {
                    onChangeFilter({ ward: value });
                    void onReload();
                  }}
                  emptyLabel="Tất cả phường"
                />
                <SelectField
                  label="Trạng thái"
                  value={filters.status ?? ""}
                  items={lookups.statuses}
                  onChange={(value) => {
                    onChangeFilter({ status: value });
                    void onReload();
                  }}
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
          const ownerName = cleanDisplayText(item.owner_name, "");
          const phone = cleanDisplayText(item.contact_phone, "");
          const dims = [
            item.width && item.width > 0 ? `${item.width}m` : null,
            item.length && item.length > 0 ? `${item.length}m` : null,
          ].filter(Boolean).join(" × ");
          return (
            <View style={styles.propertyRow}>
              <Pressable style={styles.propertyCardTapArea} onPress={() => onOpenProperty(item.landsoft_id)}>
                {/* Hero strip */}
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
                    </View>
                  </View>
                  {/* Owner + phone row in hero */}
                  <View style={styles.propertyHeroContact}>
                    <View style={styles.propertyHeroContactBadge}>
                      <Text style={styles.propertyHeroContactInitials}>{getInitials(ownerName || "?", "?")}</Text>
                    </View>
                    <View style={styles.propertyHeroContactInfo}>
                      <Text style={styles.propertyHeroContactName} numberOfLines={1}>
                        {ownerName || "Chưa có chủ nhà"}
                      </Text>
                      {phone ? (
                        <Text style={styles.propertyHeroContactPhone}>{phone}</Text>
                      ) : (
                        <Text style={styles.propertyHeroContactPhoneMissing}>Chưa có SĐT</Text>
                      )}
                    </View>
                    {phone ? (
                      <Pressable
                        style={styles.propertyHeroPhoneButton}
                        onPress={() => void onQuickViewPhone(item.landsoft_id)}
                      >
                        <Feather name="phone" size={16} color="#F37021" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                {/* Body */}
                <View style={styles.propertyBody}>
                  <View style={styles.propertyPriceRow}>
                    <Text style={styles.propertyPrice}>{formatMoney(item.price)}</Text>
                    {dims ? (
                      <View style={styles.propertyUpdatedChip}>
                        <Text style={styles.propertyUpdatedChipText}>{dims}</Text>
                      </View>
                    ) : null}
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
                    {dims ? (
                      <View style={styles.propertyFact}>
                        <Feather name="move" size={14} color="#8B9AB0" />
                        <Text style={styles.propertyFactText}>{dims}</Text>
                      </View>
                    ) : null}
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
                  <Text style={styles.propertySnippet} numberOfLines={2}>
                    {cleanDisplayText(item.description, "Không có mô tả")}
                  </Text>
                </View>
              </Pressable>

              {/* Action bar */}
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
