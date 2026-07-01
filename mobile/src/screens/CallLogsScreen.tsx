import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, Text, TextInput, View } from "react-native";

import { fetchCallLogEmployees, fetchCallLogs } from "../api";
import { styles } from "../styles";
import { CallLogEmployee, CallLogItem } from "../types";
import { cleanDisplayText, formatArea, formatDateTime, normalizeApiError } from "../utils";

const VIEW_EMPLOYEES_KEY = "landsoft_call_logs_view_employee_ids";
const WATCH_EMPLOYEES_KEY = "landsoft_call_logs_watch_employee_ids";
const POLL_INTERVAL_MS = 60000;

type DatePreset = "today" | "3days" | "7days" | "month";

const datePresets: Array<{ key: DatePreset; label: string }> = [
  { key: "today", label: "Hôm nay" },
  { key: "3days", label: "3 ngày" },
  { key: "7days", label: "7 ngày" },
  { key: "month", label: "Tháng này" },
];

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getRange(preset: DatePreset): { fromDate: string; toDate: string } {
  const now = new Date();
  const start = new Date(now);
  if (preset === "3days") {
    start.setDate(now.getDate() - 2);
  } else if (preset === "7days") {
    start.setDate(now.getDate() - 6);
  } else if (preset === "month") {
    start.setDate(1);
  }
  return { fromDate: toYmd(start), toDate: toYmd(now) };
}

function formatBillion(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "-";
  }
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ`;
}

function formatSize(width?: number | null, length?: number | null): string {
  const w = width == null ? "-" : width.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  const l = length == null ? "-" : length.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
  return `${w} x ${l}`;
}

function employeeLabel(employee: CallLogEmployee): string {
  return `${cleanDisplayText(employee.employee_code)} - ${cleanDisplayText(employee.employee_name)}`;
}

function summarizeEvent(item: CallLogItem): string {
  const address = cleanDisplayText(item.address, `${cleanDisplayText(item.house_number, "")} ${cleanDisplayText(item.street_name, "")}`.trim());
  return `${cleanDisplayText(item.employee_name)} gọi ${address}, ${cleanDisplayText(item.district_name, "")}`;
}

function CallLogCard({ item }: { item: CallLogItem }) {
  const address = cleanDisplayText(item.address, `${cleanDisplayText(item.house_number, "")} ${cleanDisplayText(item.street_name, "")}`.trim());
  return (
    <View style={styles.callLogRow}>
      <View style={styles.callLogRowTop}>
        <View style={styles.callLogStaffBadge}>
          <Text style={styles.callLogStaffBadgeText}>{cleanDisplayText(item.employee_code)}</Text>
        </View>
        <Text style={styles.callLogTime}>{formatDateTime(item.called_at)}</Text>
      </View>
      <Text style={styles.callLogStaffName}>{cleanDisplayText(item.employee_name)}</Text>
      <Text style={styles.callLogAddress}>{address}</Text>
      <Text style={styles.callLogMeta}>
        {cleanDisplayText(item.district_name, "Chưa rõ quận")} - {formatSize(item.width, item.length)} - {formatArea(item.area)} - {formatBillion(item.price)}
      </Text>
      <View style={styles.callLogPhoneRow}>
        <Text style={styles.callLogPhone}>{cleanDisplayText(item.owner_phone, "Chưa có SĐT")}</Text>
        {item.owner_phone ? (
          <Pressable style={styles.propertySecondaryAction} onPress={() => void Clipboard.setStringAsync(item.owner_phone ?? "")}>
            <Feather name="copy" size={14} color="#F37021" />
            <Text style={styles.propertySecondaryActionText}>Copy</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function CallLogsScreen({ token }: { token: string }) {
  const [employees, setEmployees] = useState<CallLogEmployee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [preset, setPreset] = useState<DatePreset>("today");
  const [items, setItems] = useState<CallLogItem[]>([]);
  const [detailEmployee, setDetailEmployee] = useState<CallLogEmployee | null>(null);
  const [detailItems, setDetailItems] = useState<CallLogItem[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingDetailLogs, setLoadingDetailLogs] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const latestSeenIdRef = useRef<number | null>(null);

  const presetLabel = useMemo(() => datePresets.find((item) => item.key === preset)?.label ?? "Hôm nay", [preset]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const watchedSet = useMemo(() => new Set(watchedIds), [watchedIds]);
  const visibleEmployees = useMemo(() => {
    const needle = employeeSearch.trim().toLocaleLowerCase("vi");
    if (!needle) {
      return employees;
    }
    return employees.filter((employee) => employeeLabel(employee).toLocaleLowerCase("vi").includes(needle));
  }, [employeeSearch, employees]);

  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const response = await fetchCallLogEmployees(token, employeeSearch);
      setEmployees(response);
    } catch (error) {
      Alert.alert("Không tải được nhân viên", normalizeApiError(error));
    } finally {
      setLoadingEmployees(false);
    }
  }, [employeeSearch, token]);

  const loadLogs = useCallback(async () => {
    if (selectedIds.length === 0) {
      setItems([]);
      setTotal(0);
      return;
    }
    setLoadingLogs(true);
    try {
      const range = getRange(preset);
      const response = await fetchCallLogs(token, {
        employeeIds: selectedIds,
        fromDate: range.fromDate,
        toDate: range.toDate,
        limit: 200,
      });
      setItems(response.items);
      setTotal(response.total);
      if (response.latest_id) {
        latestSeenIdRef.current = Math.max(latestSeenIdRef.current ?? 0, response.latest_id);
      }
    } catch (error) {
      Alert.alert("Không tải được lượt gọi", normalizeApiError(error));
    } finally {
      setLoadingLogs(false);
    }
  }, [preset, selectedIds, token]);

  const initializeWatchBaseline = useCallback(async () => {
    if (watchedIds.length === 0) {
      latestSeenIdRef.current = null;
      return;
    }
    try {
      const today = toYmd(new Date());
      const response = await fetchCallLogs(token, {
        employeeIds: watchedIds,
        fromDate: today,
        toDate: today,
        limit: 1,
      });
      latestSeenIdRef.current = response.latest_id ?? null;
    } catch {
      // Lan quet sau se thu lai, khong can lam phien nguoi dung.
    }
  }, [token, watchedIds]);

  const pollWatchedLogs = useCallback(async () => {
    if (!pollingEnabled || watchedIds.length === 0) {
      return;
    }
    const today = toYmd(new Date());
    try {
      const response = await fetchCallLogs(token, {
        employeeIds: watchedIds,
        fromDate: today,
        toDate: today,
        afterId: latestSeenIdRef.current,
        limit: 50,
      });
      if (response.items.length === 0) {
        return;
      }
      const newestId = response.latest_id ?? Math.max(...response.items.map((item) => item.log_id));
      latestSeenIdRef.current = Math.max(latestSeenIdRef.current ?? 0, newestId);
      setItems((current) => {
        const seen = new Set(current.map((item) => item.log_id));
        const fresh = response.items.filter((item) => !seen.has(item.log_id));
        return [...fresh, ...current].slice(0, 200);
      });
      setTotal((current) => current + response.items.length);
      const first = response.items[0];
      Alert.alert(
        "Có nhân viên vừa gọi SĐT",
        response.items.length === 1
          ? summarizeEvent(first)
          : `${response.items.length} lượt mới. Mới nhất: ${summarizeEvent(first)}`
      );
    } catch {
      // Polling im lang khi mang/DB loi tam thoi de khong spam alert.
    }
  }, [pollingEnabled, token, watchedIds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadEmployees();
    }, 350);
    return () => clearTimeout(timer);
  }, [employeeSearch, loadEmployees]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    void initializeWatchBaseline();
  }, [initializeWatchBaseline]);

  useEffect(() => {
    const timer = setInterval(() => {
      void pollWatchedLogs();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pollWatchedLogs]);

  useEffect(() => {
    AsyncStorage.getItem(VIEW_EMPLOYEES_KEY)
      .then((raw) => {
        if (raw) {
          setSelectedIds(JSON.parse(raw));
        }
      })
      .catch(() => undefined);
    AsyncStorage.getItem(WATCH_EMPLOYEES_KEY)
      .then((raw) => {
        if (raw) {
          setWatchedIds(JSON.parse(raw));
        }
      })
      .catch(() => undefined);
  }, []);

  const persistSelectedIds = (next: number[]) => {
    setSelectedIds(next);
    void AsyncStorage.setItem(VIEW_EMPLOYEES_KEY, JSON.stringify(next));
  };

  const persistWatchedIds = (next: number[]) => {
    setWatchedIds(next);
    void AsyncStorage.setItem(WATCH_EMPLOYEES_KEY, JSON.stringify(next));
  };

  const toggleSelected = (employeeId: number) => {
    const next = selectedSet.has(employeeId)
      ? selectedIds.filter((id) => id !== employeeId)
      : [...selectedIds, employeeId];
    persistSelectedIds(next);
  };

  const toggleWatched = (employeeId: number) => {
    const next = watchedSet.has(employeeId)
      ? watchedIds.filter((id) => id !== employeeId)
      : [...watchedIds, employeeId];
    persistWatchedIds(next);
  };

  const selectVisibleEmployees = () => {
    const next = Array.from(new Set([...selectedIds, ...visibleEmployees.map((employee) => employee.employee_id)]));
    persistSelectedIds(next);
  };

  const openEmployeeDetails = async (employee: CallLogEmployee) => {
    setDetailEmployee(employee);
    setDetailItems([]);
    setDetailTotal(0);
    persistSelectedIds([employee.employee_id]);
    setLoadingDetailLogs(true);
    try {
      const range = getRange(preset);
      const response = await fetchCallLogs(token, {
        employeeIds: [employee.employee_id],
        fromDate: range.fromDate,
        toDate: range.toDate,
        limit: 500,
      });
      setDetailItems(response.items);
      setDetailTotal(response.total);
    } catch (error) {
      Alert.alert("Không tải được căn đã gọi", normalizeApiError(error));
      setDetailEmployee(null);
    } finally {
      setLoadingDetailLogs(false);
    }
  };

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.log_id)}
        refreshControl={<RefreshControl refreshing={loadingLogs} onRefresh={() => void loadLogs()} />}
        contentContainerStyle={styles.callLogListContent}
        ListHeaderComponent={
          <View>
            <View style={styles.callLogHeroCard}>
              <View style={styles.callLogHeroTop}>
                <View>
                  <Text style={styles.formHeroEyebrow}>LANDSOFT ONLINE</Text>
                  <Text style={styles.formHeroTitle}>Theo dõi nhân viên gọi SĐT chủ nhà</Text>
                  <Text style={styles.formHeroDescription}>
                    Chọn một hoặc nhiều nhân viên để xem căn đã gọi; bật chuông để app báo khi có lượt mới.
                  </Text>
                </View>
                <Pressable
                  style={[styles.callLogBellButton, pollingEnabled && styles.callLogBellButtonOn]}
                  onPress={() => setPollingEnabled((current) => !current)}
                >
                  <Feather name={pollingEnabled ? "bell" : "bell-off"} size={18} color={pollingEnabled ? "#ffffff" : "#64748B"} />
                </Pressable>
              </View>
              <View style={styles.callLogStatsRow}>
                <View style={styles.activityHeroStat}>
                  <Text style={styles.activityHeroStatValue}>{String(total)}</Text>
                  <Text style={styles.activityHeroStatLabel}>Lượt phù hợp</Text>
                </View>
                <View style={styles.activityHeroStat}>
                  <Text style={styles.activityHeroStatValue}>{String(selectedIds.length)}</Text>
                  <Text style={styles.activityHeroStatLabel}>NV đang xem</Text>
                </View>
                <View style={styles.activityHeroStat}>
                  <Text style={styles.activityHeroStatValue}>{String(watchedIds.length)}</Text>
                  <Text style={styles.activityHeroStatLabel}>NV bật báo</Text>
                </View>
              </View>
            </View>

            <View style={styles.callLogPanel}>
              <View style={styles.searchInputWrap}>
                <Feather name="search" size={17} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  value={employeeSearch}
                  onChangeText={setEmployeeSearch}
                  placeholder="Tìm nhân viên theo tên hoặc mã"
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.callLogToolbar}>
                <Pressable style={styles.secondaryButtonCompact} onPress={selectVisibleEmployees}>
                  <Text style={styles.secondaryButtonText}>Chọn danh sách này</Text>
                </Pressable>
                <Pressable style={styles.secondaryButtonCompact} onPress={() => persistSelectedIds([])}>
                  <Text style={styles.secondaryButtonText}>Bỏ chọn</Text>
                </Pressable>
              </View>
              <View style={styles.callLogEmployeeList}>
                {visibleEmployees.slice(0, 80).map((employee) => {
                  const selected = selectedSet.has(employee.employee_id);
                  const watched = watchedSet.has(employee.employee_id);
                  return (
                    <View key={employee.employee_id} style={[styles.callLogEmployeeRow, selected && styles.callLogEmployeeRowSelected]}>
                      <Pressable
                        style={styles.callLogEmployeeMain}
                        onPress={() => void openEmployeeDetails(employee)}
                        onLongPress={() => toggleSelected(employee.employee_id)}
                      >
                        <Text style={styles.callLogEmployeeName}>{employeeLabel(employee)}</Text>
                        <Text style={styles.callLogEmployeeMeta}>
                          Hôm nay: {employee.today_call_count} lượt
                          {employee.latest_call_at ? ` · ${formatDateTime(employee.latest_call_at)}` : ""}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={[styles.callLogWatchButton, watched && styles.callLogWatchButtonOn]}
                        onPress={() => toggleWatched(employee.employee_id)}
                      >
                        <Feather name={watched ? "bell" : "bell-off"} size={15} color={watched ? "#ffffff" : "#64748B"} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
              {loadingEmployees ? <Text style={styles.callLogHint}>Đang tải nhân viên...</Text> : null}
            </View>

            <View style={styles.callLogPresetRow}>
              {datePresets.map((item) => (
                <Pressable
                  key={item.key}
                  style={[styles.callLogPresetButton, preset === item.key && styles.callLogPresetButtonOn]}
                  onPress={() => setPreset(item.key)}
                >
                  <Text style={[styles.callLogPresetText, preset === item.key && styles.callLogPresetTextOn]}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Danh sách căn đã gọi</Text>
              <Text style={styles.listHeaderCount}>{loadingLogs ? "Đang tải..." : `${items.length}/${total}`}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyStateText}>
            {selectedIds.length === 0 ? "Chọn nhân viên để xem lượt gọi SĐT." : "Chưa có lượt gọi trong khoảng ngày này."}
          </Text>
        }
        renderItem={({ item }) => {
          const address = cleanDisplayText(item.address, `${cleanDisplayText(item.house_number, "")} ${cleanDisplayText(item.street_name, "")}`.trim());
          return (
            <View style={styles.callLogRow}>
              <View style={styles.callLogRowTop}>
                <View style={styles.callLogStaffBadge}>
                  <Text style={styles.callLogStaffBadgeText}>{cleanDisplayText(item.employee_code)}</Text>
                </View>
                <Text style={styles.callLogTime}>{formatDateTime(item.called_at)}</Text>
              </View>
              <Text style={styles.callLogStaffName}>{cleanDisplayText(item.employee_name)}</Text>
              <Text style={styles.callLogAddress}>{address}</Text>
              <Text style={styles.callLogMeta}>
                {cleanDisplayText(item.district_name, "Chưa rõ quận")} · {formatSize(item.width, item.length)} · {formatArea(item.area)} · {formatBillion(item.price)}
              </Text>
              <View style={styles.callLogPhoneRow}>
                <Text style={styles.callLogPhone}>{cleanDisplayText(item.owner_phone, "Chưa có SĐT")}</Text>
                {item.owner_phone ? (
                  <Pressable style={styles.propertySecondaryAction} onPress={() => void Clipboard.setStringAsync(item.owner_phone ?? "")}>
                    <Feather name="copy" size={14} color="#F37021" />
                    <Text style={styles.propertySecondaryActionText}>Copy</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        }}
      />
      <Modal
        visible={detailEmployee !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailEmployee(null)}
      >
        <View style={styles.callLogDetailOverlay}>
          <View style={styles.callLogDetailSheet}>
            <View style={styles.callLogDetailHeader}>
              <View style={styles.callLogDetailTitleWrap}>
                <Text style={styles.formHeroEyebrow}>CĂN ĐÃ GỌI</Text>
                <Text style={styles.callLogDetailTitle}>{detailEmployee ? employeeLabel(detailEmployee) : ""}</Text>
                <Text style={styles.callLogDetailSubtitle}>
                  {presetLabel} - {detailItems.length}/{detailTotal} lượt
                </Text>
              </View>
              <Pressable style={styles.callLogDetailCloseButton} onPress={() => setDetailEmployee(null)}>
                <Feather name="x" size={20} color="#17305D" />
              </Pressable>
            </View>
            {loadingDetailLogs ? (
              <View style={styles.callLogDetailLoading}>
                <ActivityIndicator color="#F37021" />
                <Text style={styles.callLogHint}>Đang tải danh sách căn...</Text>
              </View>
            ) : (
              <FlatList
                data={detailItems}
                keyExtractor={(item) => `detail-${item.log_id}`}
                contentContainerStyle={styles.callLogDetailListContent}
                ListEmptyComponent={
                  <Text style={styles.emptyStateText}>Nhân viên này chưa có lượt gọi trong khoảng ngày đang chọn.</Text>
                }
                renderItem={({ item }) => <CallLogCard item={item} />}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
