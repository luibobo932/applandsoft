import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";

import { fetchProperties, fetchPropertyDetail } from "../api";
import { LandsoftView } from "../components/shared";
import { styles } from "../styles";
import { cleanDisplayText, formatDateTime, normalizeApiError } from "../utils";
import {
  LookupCollections,
  PropertyDetail,
  PropertyFilters,
  PropertySummary,
} from "../types";

// Man hinh mo phong bo cuc luoi "SAN PHAM (BAN, CHO THUE)" cua King Land desktop:
// thanh menu - tab - bo loc - toolbar - luoi cuon ngang - tab chi tiet duoi cung.
// Du lieu doc truc tiep tu SQL Landsoft qua backend (giong het ban desktop).

type ColumnDef = {
  key: string;
  label: string;
  width: number;
  align?: "left" | "right" | "center";
  value: (item: PropertySummary, index: number) => string;
};

function fmtNum(value?: number | null): string {
  if (!value) return "";
  return `${Math.round(value * 10) / 10} m`;
}

function fmtArea(value?: number | null): string {
  if (!value) return "0 m2";
  return `${Math.round(value * 10) / 10} m2`;
}

// 14500000000 -> "14 tỷ 500" (giong cach hien thi cot Gia ban tren desktop)
function fmtPriceTy(value?: number | null): string {
  if (!value || value <= 0) return "";
  const ty = value / 1_000_000_000;
  if (ty >= 1) {
    const whole = Math.floor(ty);
    const trieu = Math.round((ty - whole) * 1000);
    return trieu > 0 ? `${whole} tỷ ${trieu}` : `${whole} tỷ`;
  }
  return `${Math.round(value / 1_000_000)} triệu`;
}

function fmtMoney(value?: number | null): string {
  if (!value || value <= 0) return "";
  return Math.round(value).toLocaleString("vi-VN");
}

const COLUMNS: ColumnDef[] = [
  { key: "stt", label: "STT", width: 42, align: "center", value: (_i, index) => String(index + 1) },
  { key: "loai", label: "Loại đường", width: 108, value: (i) => cleanDisplayText(i.property_type_name, "") },
  { key: "sonha", label: "Số nhà", width: 92, value: (i) => cleanDisplayText(i.house_number, "") },
  { key: "duong", label: "Tên đường", width: 122, value: (i) => cleanDisplayText(i.street_name, "") },
  { key: "phuong", label: "Xã/Phường", width: 104, value: (i) => cleanDisplayText(i.ward_name, "") },
  { key: "quan", label: "Quận/huyện", width: 96, value: (i) => cleanDisplayText(i.district_name, "") },
  { key: "ngang", label: "Ngang KV", width: 68, align: "right", value: (i) => fmtNum(i.width) },
  { key: "dai", label: "Dài KV", width: 62, align: "right", value: (i) => fmtNum(i.length) },
  { key: "dt", label: "Diện tích", width: 70, align: "right", value: (i) => fmtArea(i.area) },
  { key: "gia", label: "Giá bán", width: 92, align: "right", value: (i) => fmtPriceTy(i.price) },
  { key: "tinhtrang", label: "Tình trạng", width: 84, value: (i) => cleanDisplayText(i.status_name, "") },
  { key: "ghichugia", label: "Ghi chú thay đổi giá", width: 140, value: (i) => cleanDisplayText(i.note_doi_gia, "") },
  { key: "khach", label: "Khách hàng", width: 106, value: (i) => cleanDisplayText(i.owner_name, "") },
  { key: "phone", label: "Điện thoại", width: 104, value: (i) => cleanDisplayText(i.contact_phone, "") },
  { key: "capdo", label: "Cấp độ", width: 82, value: (i) => cleanDisplayText(i.grade_name, "") },
  { key: "nguon", label: "Nguồn", width: 118, value: (i) => cleanDisplayText(i.source_name, "") },
  { key: "huong", label: "Hướng", width: 86, value: (i) => {
      const value = cleanDisplayText(i.direction_name, "");
      return value === "Không xác định" ? "" : value;
    } },
  { key: "cvmg", label: "CV môi giới", width: 122, value: (i) => cleanDisplayText(i.agent_name, "") },
  { key: "phimg", label: "Phí môi giới", width: 108, align: "right", value: (i) => fmtMoney(i.phi_mg) },
];

const GRID_WIDTH = COLUMNS.reduce((sum, col) => sum + col.width, 0);

const MENU_ITEMS = ["TÀI KHOẢN", "NHÂN VIÊN", "KHÁCH HÀNG", "GIAO DỊCH BĐS", "TÌM KIẾM", "LỊCH LÀM VIỆC", "KHÁC"];

export function KingLandScreen({
  token,
  lookups,
  onNavigate,
}: {
  token: string;
  lookups: LookupCollections;
  onNavigate: (view: LandsoftView) => void;
}) {
  const [rows, setRows] = useState<PropertySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [detailTab, setDetailTab] = useState<1 | 2>(1);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadedRef = useRef(0);
  useEffect(() => {
    loadedRef.current = rows.length;
  }, [rows.length]);

  const buildFilters = useCallback(
    (page: number): PropertyFilters => ({
      keyword,
      status: statusFilter,
      sort: "newest",
      page,
      page_size: 50,
    }),
    [keyword, statusFilter]
  );

  const load = useCallback(
    async (reset: boolean) => {
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const page = reset ? 1 : Math.floor(loadedRef.current / 50) + 1;
        const response = await fetchProperties(token, buildFilters(page));
        setTotal(response.total);
        setRows((prev) => {
          if (reset) return response.items;
          const seen = new Set(prev.map((r) => r.landsoft_id));
          return [...prev, ...response.items.filter((r) => !seen.has(r.landsoft_id))];
        });
      } catch (error) {
        Alert.alert("Không nạp được danh sách", normalizeApiError(error));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildFilters, token]
  );

  useEffect(() => {
    void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const selectRow = useCallback(
    async (item: PropertySummary) => {
      setSelectedId(item.landsoft_id);
      setDetailTab(1);
      setDetailLoading(true);
      try {
        const data = await fetchPropertyDetail(token, item.landsoft_id);
        setDetail(data);
      } catch {
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    },
    [token]
  );

  const stub = (label: string) =>
    Alert.alert(label, "Phân hệ này sẽ được nối tiếp theo — dữ liệu dùng chung SQL Landsoft.");

  const selectedIndex = useMemo(
    () => rows.findIndex((r) => r.landsoft_id === selectedId),
    [rows, selectedId]
  );

  const renderRow = useCallback(
    ({ item, index }: { item: PropertySummary; index: number }) => {
      const selected = item.landsoft_id === selectedId;
      return (
        <Pressable
          style={[styles.klRow, index % 2 === 1 && styles.klRowAlt, selected && styles.klRowSelected]}
          onPress={() => void selectRow(item)}
        >
          {COLUMNS.map((col) => (
            <Text
              key={col.key}
              numberOfLines={1}
              style={[
                styles.klCell,
                { width: col.width, textAlign: col.align ?? "left" },
                col.key === "gia" && styles.klCellPrice,
              ]}
            >
              {col.value(item, index)}
            </Text>
          ))}
        </Pressable>
      );
    },
    [selectRow, selectedId]
  );

  return (
    <View style={styles.klRoot}>
      {/* Thanh tieu de kieu desktop */}
      <View style={styles.klTitleBar}>
        <Feather name="home" size={13} color="#F37021" />
        <Text style={styles.klTitleText} numberOfLines={1}>
          King Land - Phần mềm quản lý sàn giao dịch bất động sản LandSoft
        </Text>
      </View>

      {/* Thanh menu */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.klMenuBar}>
        {MENU_ITEMS.map((label) => (
          <Pressable
            key={label}
            style={styles.klMenuItem}
            onPress={() => {
              if (label === "KHÁCH HÀNG") onNavigate("customers");
              else if (label === "GIAO DỊCH BĐS") void load(true);
              else stub(label);
            }}
          >
            <Text style={styles.klMenuText}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tab dang mo */}
      <View style={styles.klTabStrip}>
        <Pressable style={styles.klTabInactive} onPress={() => onNavigate("workspace")}>
          <Text style={styles.klTabTextInactive}>MAIN</Text>
        </Pressable>
        <View style={styles.klTabActive}>
          <Text style={styles.klTabText}>SẢN PHẨM (BÁN, CHO THUÊ)</Text>
        </View>
      </View>

      {/* Bo loc: trang thai + tim kiem + nap */}
      <View style={styles.klFilterBar}>
        <View style={styles.klStatusPickerWrap}>
          <Picker
            selectedValue={statusFilter}
            onValueChange={(value) => setStatusFilter(String(value ?? ""))}
            style={styles.klStatusPicker}
          >
            <Picker.Item label="Tất cả trạng thái" value="" />
            {lookups.statuses.map((s) => (
              <Picker.Item key={s.code} label={cleanDisplayText(s.label, s.code)} value={s.code} />
            ))}
          </Picker>
        </View>
        <TextInput
          style={styles.klSearchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Tìm..."
          onSubmitEditing={() => void load(true)}
          returnKeyType="search"
        />
        <Pressable style={styles.klFilterButton} onPress={() => void load(true)}>
          <Feather name="refresh-cw" size={12} color="#17305D" />
          <Text style={styles.klFilterButtonText}>Nạp</Text>
        </Pressable>
      </View>

      {/* Toolbar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.klToolbar}>
        {[
          { icon: "plus" as const, label: "Thêm", onPress: () => onNavigate("create") },
          { icon: "edit-2" as const, label: "Sửa", onPress: () => stub("Sửa") },
          { icon: "x" as const, label: "Xóa", onPress: () => stub("Xóa") },
          { icon: "download" as const, label: "Import", onPress: () => stub("Import") },
          { icon: "upload" as const, label: "Export", onPress: () => stub("Export") },
          { icon: "star" as const, label: "Hàng hot", onPress: () => stub("Hàng hot") },
          { icon: "book" as const, label: "Sổ hồng", onPress: () => stub("Sổ hồng") },
          { icon: "message-square" as const, label: "Ghi chú", onPress: () => setDetailTab(2) },
        ].map((tool) => (
          <Pressable key={tool.label} style={styles.klToolButton} onPress={tool.onPress}>
            <Feather name={tool.icon} size={12} color="#17305D" />
            <Text style={styles.klToolButtonText}>{tool.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Luoi du lieu cuon ngang */}
      <View style={styles.klGridArea}>
        <ScrollView horizontal bounces={false}>
          <View style={{ width: GRID_WIDTH }}>
            <View style={styles.klHeaderRow}>
              {COLUMNS.map((col) => (
                <Text
                  key={col.key}
                  numberOfLines={1}
                  style={[styles.klHeaderCell, { width: col.width, textAlign: col.align ?? "left" }]}
                >
                  {col.label}
                </Text>
              ))}
            </View>
            {loading ? (
              <View style={styles.klLoadingWrap}>
                <ActivityIndicator size="small" color="#F37021" />
                <Text style={styles.klLoadingText}>Đang nạp dữ liệu từ Landsoft...</Text>
              </View>
            ) : (
              <FlatList
                data={rows}
                keyExtractor={(item) => String(item.landsoft_id)}
                renderItem={renderRow}
                onEndReachedThreshold={0.4}
                onEndReached={() => {
                  if (!loadingMore && rows.length < total) void load(false);
                }}
                ListFooterComponent={
                  loadingMore ? <ActivityIndicator size="small" color="#F37021" /> : null
                }
              />
            )}
          </View>
        </ScrollView>
      </View>

      {/* Dem tong so dong nhu desktop */}
      <View style={styles.klFooterBar}>
        <View style={styles.klCountBox}>
          <Text style={styles.klCountText}>{total.toLocaleString("vi-VN")}</Text>
        </View>
        <Text style={styles.klFooterHint}>
          {selectedIndex >= 0 ? `Đang chọn dòng ${selectedIndex + 1}` : "Chạm dòng để xem chi tiết"}
        </Text>
      </View>

      {/* Tab chi tiet duoi cung nhu desktop */}
      {selectedId ? (
        <View style={styles.klDetailPanel}>
          <View style={styles.klDetailTabs}>
            <Pressable
              style={[styles.klDetailTab, detailTab === 1 && styles.klDetailTabActive]}
              onPress={() => setDetailTab(1)}
            >
              <Text style={[styles.klDetailTabText, detailTab === 1 && styles.klDetailTabTextActive]}>
                1. Thông tin chi tiết
              </Text>
            </Pressable>
            <Pressable
              style={[styles.klDetailTab, detailTab === 2 && styles.klDetailTabActive]}
              onPress={() => setDetailTab(2)}
            >
              <Text style={[styles.klDetailTabText, detailTab === 2 && styles.klDetailTabTextActive]}>
                2. Lịch sử thực hiện
              </Text>
            </Pressable>
            <Pressable style={styles.klDetailClose} onPress={() => setSelectedId(null)}>
              <Feather name="x" size={14} color="#64748B" />
            </Pressable>
          </View>
          {detailLoading ? (
            <ActivityIndicator size="small" color="#F37021" style={{ marginVertical: 12 }} />
          ) : detailTab === 1 ? (
            <ScrollView style={styles.klDetailBody}>
              <Text style={styles.klDetailTitle}>{cleanDisplayText(detail?.title, "")}</Text>
              <Text style={styles.klDetailLine}>
                Địa chỉ: {cleanDisplayText(detail?.address, "")} · {cleanDisplayText(detail?.ward_name, "")} ·{" "}
                {cleanDisplayText(detail?.district_name, "")}
              </Text>
              <Text style={styles.klDetailLine}>
                Giá: {fmtPriceTy(detail?.price)} · DT: {fmtArea(detail?.area)} · {fmtNum(detail?.width)} ×{" "}
                {fmtNum(detail?.length)}
              </Text>
              <Text style={styles.klDetailLine}>
                Chủ nhà: {cleanDisplayText(detail?.owner_name, "—")} · {cleanDisplayText(detail?.contact_phone, "")}
              </Text>
              <Text style={styles.klDetailLine}>
                Pháp lý: {cleanDisplayText(detail?.legal_status_name, "—")} · Hướng:{" "}
                {cleanDisplayText(detail?.direction_name, "—")} · Nguồn: {cleanDisplayText(detail?.source_name, "—")}
              </Text>
              {detail?.description ? (
                <Text style={styles.klDetailDescription}>{cleanDisplayText(detail.description, "")}</Text>
              ) : null}
            </ScrollView>
          ) : (
            <ScrollView style={styles.klDetailBody}>
              {(detail?.notes ?? []).length === 0 ? (
                <Text style={styles.klDetailLine}>Chưa có lịch sử thực hiện.</Text>
              ) : (
                (detail?.notes ?? []).map((note) => (
                  <View key={note.note_id ?? note.content} style={styles.klNoteRow}>
                    <Text style={styles.klNoteMeta}>
                      {formatDateTime(note.created_at)} · {cleanDisplayText(note.created_by, "Landsoft")}
                    </Text>
                    <Text style={styles.klNoteContent}>{note.content}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
  );
}
