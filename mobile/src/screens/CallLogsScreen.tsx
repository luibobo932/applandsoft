import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, Text, TextInput, View } from "react-native";

import { fetchCallLogEmployees, fetchCallLogs, registerPushToken } from "../api";
import { registerForCallLogPushAsync } from "../notifications";
import { styles } from "../styles";
import { CallLogEmployee, CallLogItem } from "../types";
import { cleanDisplayText, formatArea, formatDateTime, normalizeApiError } from "../utils";

const WATCH_EMPLOYEES_KEY = "landsoft_call_logs_watch_employee_ids";
const POLL_INTERVAL_MS = 60000;

type DatePreset = "today" | "3days" | "7days" | "month" | "custom";

const datePresets: Array<{ key: Exclude<DatePreset, "custom">; label: string }> = [
  { key: "today", label: "Hôm nay" },
  { key: "3days", label: "3 ngày" },
  { key: "7days", label: "7 ngày" },
  { key: "month", label: "Tháng này" },
];

type DateRange = { fromDate: string; toDate: string };

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPresetRange(preset: Exclude<DatePreset, "custom">): DateRange {
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

function formatDmy(ymd: string, withYear = false): string {
  const [year, month, day] = ymd.split("-");
  return withYear ? `${day}/${month}/${year}` : `${day}/${month}`;
}

function dayHeaderLabel(ymd: string): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (ymd === toYmd(today)) {
    return `Hôm nay · ${formatDmy(ymd)}`;
  }
  if (ymd === toYmd(yesterday)) {
    return `Hôm qua · ${formatDmy(ymd)}`;
  }
  return formatDmy(ymd, true);
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

function employeeInitials(name: string): string {
  const clean = cleanDisplayText(name, "").trim();
  if (!clean) {
    return "?";
  }
  const parts = clean.split(/\s+/);
  const last = parts[parts.length - 1] ?? "";
  return (last[0] ?? "?").toLocaleUpperCase("vi");
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
}

// Lich chon khoang ngay (tu ngay -> den ngay), thuan JS khong can module native.
function CalendarRangeModal({
  visible,
  initialRange,
  onApply,
  onClose,
}: {
  visible: boolean;
  initialRange: DateRange | null;
  onApply: (range: DateRange) => void;
  onClose: () => void;
}) {
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [fromDay, setFromDay] = useState<string | null>(null);
  const [toDay, setToDay] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setFromDay(initialRange?.fromDate ?? null);
      setToDay(initialRange?.toDate ?? null);
      const anchor = initialRange?.toDate ? new Date(`${initialRange.toDate}T00:00:00`) : new Date();
      setMonthAnchor(anchor);
    }
  }, [visible, initialRange]);

  const monthTitle = `Tháng ${monthAnchor.getMonth() + 1}/${monthAnchor.getFullYear()}`;

  // Luoi ngay: tuan bat dau tu Thu 2, kem ngay thang truoc/sau lam mo.
  const weeks = useMemo(() => {
    const first = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1);
    const gridStart = new Date(first);
    const weekday = (first.getDay() + 6) % 7; // 0 = Thu 2
    gridStart.setDate(first.getDate() - weekday);
    const rows: Array<Array<{ ymd: string; day: number; inMonth: boolean }>> = [];
    const cursor = new Date(gridStart);
    for (let week = 0; week < 6; week += 1) {
      const row: Array<{ ymd: string; day: number; inMonth: boolean }> = [];
      for (let dow = 0; dow < 7; dow += 1) {
        row.push({
          ymd: toYmd(cursor),
          day: cursor.getDate(),
          inMonth: cursor.getMonth() === monthAnchor.getMonth(),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      rows.push(row);
    }
    return rows;
  }, [monthAnchor]);

  const shiftMonth = (delta: number) => {
    setMonthAnchor((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  const pickDay = (ymd: string) => {
    if (!fromDay || (fromDay && toDay)) {
      setFromDay(ymd);
      setToDay(null);
      return;
    }
    if (ymd < fromDay) {
      setToDay(fromDay);
      setFromDay(ymd);
    } else {
      setToDay(ymd);
    }
  };

  const rangeText = fromDay
    ? toDay
      ? `${formatDmy(fromDay, true)}  →  ${formatDmy(toDay, true)}`
      : `${formatDmy(fromDay, true)}  →  chọn ngày kết thúc`
    : "Chạm chọn ngày bắt đầu";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.calOverlay}>
        <View style={styles.calSheet}>
          <View style={styles.calHeaderRow}>
            <Pressable style={styles.calNavButton} onPress={() => shiftMonth(-1)}>
              <Feather name="chevron-left" size={20} color="#17305D" />
            </Pressable>
            <Text style={styles.calMonthTitle}>{monthTitle}</Text>
            <Pressable style={styles.calNavButton} onPress={() => shiftMonth(1)}>
              <Feather name="chevron-right" size={20} color="#17305D" />
            </Pressable>
          </View>
          <View style={styles.calWeekRow}>
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((label) => (
              <Text key={label} style={styles.calWeekDayText}>
                {label}
              </Text>
            ))}
          </View>
          {weeks.map((row, index) => (
            <View key={`week-${index}`} style={styles.calWeekRow}>
              {row.map((cell) => {
                const isEdge = cell.ymd === fromDay || cell.ymd === toDay;
                const inRange = fromDay != null && toDay != null && cell.ymd > fromDay && cell.ymd < toDay;
                return (
                  <Pressable
                    key={cell.ymd}
                    style={[styles.calDayCell, inRange && styles.calDayInRange, isEdge && styles.calDaySelected]}
                    onPress={() => pickDay(cell.ymd)}
                  >
                    <Text
                      style={[
                        styles.calDayText,
                        !cell.inMonth && styles.calDayTextMuted,
                        isEdge && styles.calDayTextSelected,
                      ]}
                    >
                      {cell.day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
          <Text style={styles.calRangeText}>{rangeText}</Text>
          <View style={styles.calFooterRow}>
            <Pressable style={styles.calCancelButton} onPress={onClose}>
              <Text style={styles.calCancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              style={[styles.calApplyButton, !fromDay && { opacity: 0.5 }]}
              disabled={!fromDay}
              onPress={() => {
                if (fromDay) {
                  onApply({ fromDate: fromDay, toDate: toDay ?? fromDay });
                }
              }}
            >
              <Text style={styles.calApplyText}>Xem lượt gọi</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type ListRow = { type: "header"; key: string; label: string; count: number } | { type: "log"; key: string; item: CallLogItem };

export function CallLogsScreen({ token }: { token: string }) {
  const [employees, setEmployees] = useState<CallLogEmployee[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [preset, setPreset] = useState<DatePreset>("3days");
  const [customRange, setCustomRange] = useState<DateRange | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [items, setItems] = useState<CallLogItem[]>([]);
  const [detailEmployee, setDetailEmployee] = useState<CallLogEmployee | null>(null);
  const [detailItems, setDetailItems] = useState<CallLogItem[]>([]);
  const [detailTotal, setDetailTotal] = useState(0);
  const [total, setTotal] = useState(0);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingDetailLogs, setLoadingDetailLogs] = useState(false);
  const [pollingEnabled, setPollingEnabled] = useState(true);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const latestSeenIdRef = useRef<number | null>(null);
  // Chan response cu de len response moi khi doi bo loc lien tuc.
  const loadSeqRef = useRef(0);

  const activeRange = useMemo<DateRange>(() => {
    if (preset === "custom" && customRange) {
      return customRange;
    }
    return getPresetRange(preset === "custom" ? "3days" : preset);
  }, [preset, customRange]);

  const rangeLabel = useMemo(() => {
    if (preset === "custom" && customRange) {
      return `${formatDmy(customRange.fromDate, true)} → ${formatDmy(customRange.toDate, true)}`;
    }
    return datePresets.find((item) => item.key === preset)?.label ?? "3 ngày";
  }, [preset, customRange]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const watchedSet = useMemo(() => new Set(watchedIds), [watchedIds]);
  const employeeById = useMemo(() => {
    const map = new Map<number, CallLogEmployee>();
    employees.forEach((employee) => map.set(employee.employee_id, employee));
    return map;
  }, [employees]);
  const visibleEmployees = useMemo(() => {
    const needle = employeeSearch.trim().toLocaleLowerCase("vi");
    if (!needle) {
      return employees;
    }
    return employees.filter((employee) => employeeLabel(employee).toLocaleLowerCase("vi").includes(needle));
  }, [employeeSearch, employees]);

  // Gop lich su goi theo tung ngay, moi nhat len dau, de doc luot nhanh.
  const listRows = useMemo<ListRow[]>(() => {
    const rows: ListRow[] = [];
    let currentDay = "";
    const countByDay = new Map<string, number>();
    items.forEach((item) => {
      const day = String(item.called_at).slice(0, 10);
      countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
    });
    items.forEach((item) => {
      const day = String(item.called_at).slice(0, 10);
      if (day !== currentDay) {
        currentDay = day;
        rows.push({ type: "header", key: `day-${day}`, label: dayHeaderLabel(day), count: countByDay.get(day) ?? 0 });
      }
      rows.push({ type: "log", key: `log-${item.log_id}`, item });
    });
    return rows;
  }, [items]);

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
    const seq = ++loadSeqRef.current;
    setLoadingLogs(true);
    try {
      const response = await fetchCallLogs(token, {
        employeeIds: selectedIds,
        fromDate: activeRange.fromDate,
        toDate: activeRange.toDate,
        limit: 300,
      });
      if (seq !== loadSeqRef.current) {
        return;
      }
      setItems(response.items);
      setTotal(response.total);
      if (response.latest_id) {
        latestSeenIdRef.current = Math.max(latestSeenIdRef.current ?? 0, response.latest_id);
      }
    } catch (error) {
      if (seq === loadSeqRef.current) {
        Alert.alert("Không tải được lượt gọi", normalizeApiError(error));
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setLoadingLogs(false);
      }
    }
  }, [activeRange, selectedIds, token]);

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
        return [...fresh, ...current].slice(0, 300);
      });
      setTotal((current) => current + response.items.length);
      // Thong bao that (he thong) da duoc backend day qua Expo Push, khong can Alert trong app nua.
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

  // Xin quyen thong bao he thong 1 lan khi vao man hinh nay.
  useEffect(() => {
    void registerForCallLogPushAsync().then(setPushToken);
  }, []);

  // Dong bo push token + danh sach NV dang bat bao len backend, de backend tu day
  // thong bao that (Expo Push) ke ca khi da tat app.
  useEffect(() => {
    if (!pushToken) return;
    void registerPushToken(token, pushToken, watchedIds).catch(() => undefined);
  }, [pushToken, token, watchedIds]);

  useEffect(() => {
    const timer = setInterval(() => {
      void pollWatchedLogs();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pollWatchedLogs]);

  useEffect(() => {
    AsyncStorage.getItem(WATCH_EMPLOYEES_KEY)
      .then((raw) => {
        if (raw) {
          setWatchedIds(JSON.parse(raw));
        }
      })
      .catch(() => undefined);
  }, []);

  // Bo loc "dang xem" chi song trong phien: vao man hinh luon thay tat ca lượt gọi.
  const persistSelectedIds = (next: number[]) => {
    setSelectedIds(next);
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

  const openEmployeeDetails = async (employee: CallLogEmployee) => {
    setDetailEmployee(employee);
    setDetailItems([]);
    setDetailTotal(0);
    setLoadingDetailLogs(true);
    try {
      const response = await fetchCallLogs(token, {
        employeeIds: [employee.employee_id],
        fromDate: activeRange.fromDate,
        toDate: activeRange.toDate,
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
        data={listRows}
        keyExtractor={(row) => row.key}
        refreshControl={<RefreshControl refreshing={loadingLogs} onRefresh={() => void loadLogs()} />}
        contentContainerStyle={styles.callLogListContent}
        ListHeaderComponent={
          <View>
            <View style={styles.callLogHeroCard}>
              <View style={styles.callLogHeroTop}>
                <View>
                  <Text style={styles.formHeroEyebrow}>LANDSOFT ONLINE</Text>
                  <Text style={styles.formHeroTitle}>Theo dõi gọi SĐT chủ nhà</Text>
                  <Text style={styles.formHeroDescription}>
                    Mọi lượt gọi hiện ngay bên dưới, mới nhất trên đầu. Lọc theo ngày hoặc nhân viên khi cần.
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
                  <Text style={styles.activityHeroStatLabel}>Lượt gọi</Text>
                </View>
                <View style={styles.activityHeroStat}>
                  <Text style={styles.activityHeroStatValue}>{selectedIds.length === 0 ? "Tất cả" : String(selectedIds.length)}</Text>
                  <Text style={styles.activityHeroStatLabel}>NV đang lọc</Text>
                </View>
                <View style={styles.activityHeroStat}>
                  <Text style={styles.activityHeroStatValue}>{String(watchedIds.length)}</Text>
                  <Text style={styles.activityHeroStatLabel}>NV bật báo</Text>
                </View>
              </View>
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
              <Pressable
                style={[styles.callLogCalendarButton, preset === "custom" && styles.callLogCalendarButtonOn]}
                onPress={() => setCalendarOpen(true)}
              >
                <Feather name="calendar" size={14} color={preset === "custom" ? "#ffffff" : "#F37021"} />
                <Text style={[styles.callLogPresetText, preset === "custom" ? styles.callLogPresetTextOn : { color: "#F37021" }]}>
                  {preset === "custom" && customRange ? rangeLabel : "Chọn ngày"}
                </Text>
              </Pressable>
            </View>

            <View style={styles.callLogPanel}>
              <Pressable style={styles.callLogCollapseHeader} onPress={() => setFilterPanelOpen((current) => !current)}>
                <View>
                  <Text style={styles.callLogCollapseTitle}>Lọc theo nhân viên</Text>
                  <Text style={styles.callLogCollapseSummary}>
                    {selectedIds.length === 0
                      ? "Đang xem tất cả nhân viên — chạm để chọn riêng"
                      : `Đang lọc ${selectedIds.length} nhân viên`}
                  </Text>
                </View>
                <Feather name={filterPanelOpen ? "chevron-up" : "chevron-down"} size={20} color="#17305D" />
              </Pressable>
              {selectedIds.length > 0 ? (
                <View style={styles.callLogChipRow}>
                  {selectedIds.map((employeeId) => {
                    const employee = employeeById.get(employeeId);
                    return (
                      <Pressable key={employeeId} style={styles.callLogChip} onPress={() => toggleSelected(employeeId)}>
                        <Text style={styles.callLogChipText}>
                          {employee ? cleanDisplayText(employee.employee_code) : `NV ${employeeId}`}
                        </Text>
                        <Feather name="x" size={12} color="#15428B" />
                      </Pressable>
                    );
                  })}
                  <Pressable style={styles.callLogChip} onPress={() => persistSelectedIds([])}>
                    <Text style={styles.callLogChipText}>Xem tất cả</Text>
                  </Pressable>
                </View>
              ) : null}
              {filterPanelOpen ? (
                <View>
                  <View style={[styles.searchInputWrap, { marginTop: 10 }]}>
                    <Feather name="search" size={17} color="#64748B" />
                    <TextInput
                      style={styles.searchInput}
                      value={employeeSearch}
                      onChangeText={setEmployeeSearch}
                      placeholder="Tìm nhân viên theo tên hoặc mã"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.callLogEmployeeList}>
                    {visibleEmployees.slice(0, 80).map((employee) => {
                      const selected = selectedSet.has(employee.employee_id);
                      const watched = watchedSet.has(employee.employee_id);
                      const hasCalls = employee.today_call_count > 0;
                      return (
                        <View key={employee.employee_id} style={[styles.callLogEmployeeRow, selected && styles.callLogEmployeeRowSelected]}>
                          <Pressable
                            style={styles.callLogEmployeeMain}
                            onPress={() => void openEmployeeDetails(employee)}
                            onLongPress={() => toggleSelected(employee.employee_id)}
                          >
                            <View style={[styles.callLogEmployeeAvatar, hasCalls && styles.callLogEmployeeAvatarActive]}>
                              <Text style={styles.callLogEmployeeAvatarText}>{employeeInitials(employee.employee_name)}</Text>
                            </View>
                            <View style={styles.callLogEmployeeTextWrap}>
                              <Text style={styles.callLogEmployeeName}>{employeeLabel(employee)}</Text>
                              <View style={styles.callLogEmployeeMetaRow}>
                                <View style={[styles.callLogEmployeeCountBadge, hasCalls && styles.callLogEmployeeCountBadgeActive]}>
                                  <Text style={[styles.callLogEmployeeCountBadgeText, hasCalls && styles.callLogEmployeeCountBadgeTextActive]}>
                                    {employee.today_call_count} lượt hôm nay
                                  </Text>
                                </View>
                                {employee.latest_call_at ? (
                                  <Text style={styles.callLogEmployeeMeta}>{formatDateTime(employee.latest_call_at)}</Text>
                                ) : null}
                              </View>
                            </View>
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
                  <Text style={styles.callLogHint}>Chạm để lọc theo nhân viên; giữ lâu để xem riêng danh sách căn đã gọi.</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Lượt gọi · {rangeLabel}</Text>
              <Text style={styles.listHeaderCount}>{loadingLogs ? "Đang tải..." : `${items.length}/${total}`}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyStateText}>
            {loadingLogs ? "Đang tải lượt gọi..." : "Chưa có lượt gọi trong khoảng ngày này."}
          </Text>
        }
        renderItem={({ item: row }) => {
          if (row.type === "header") {
            return (
              <View style={styles.callLogDayHeader}>
                <Text style={styles.callLogDayHeaderText}>{row.label}</Text>
                <Text style={styles.callLogDayHeaderCount}>{row.count} lượt</Text>
              </View>
            );
          }
          return <CallLogCard item={row.item} />;
        }}
      />
      <CalendarRangeModal
        visible={calendarOpen}
        initialRange={preset === "custom" ? customRange : activeRange}
        onApply={(range) => {
          setCustomRange(range);
          setPreset("custom");
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
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
                  {rangeLabel} - {detailItems.length}/{detailTotal} lượt
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
