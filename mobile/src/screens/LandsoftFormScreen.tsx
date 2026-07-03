import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Field, Section, SelectField } from "../components/shared";
import { styles } from "../styles";
import { normalizeApiError, parseNumberInput } from "../utils";
import { checkPhone, cleanPhoneCompare, createProperty, fetchNextPropertyCode, fetchStreets } from "../api";
import {
  ChototListingOption,
  chototFieldDefaults,
  parseChototMulti,
} from "../chototPaste";
import { LookupCollections, LookupItem, PropertyCreatePayload } from "../types";

// Bo dau tieng Viet de loc khong phan biet dau
function stripAccents(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

const CREATE_DRAFT_KEY = "landsoft_mobile_create_draft";

// O nhap so co nhan, dung chung trong cac luoi
function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value?: number;
  onChange: (value: number) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.lsGridCell}>
      <Text style={styles.lsCellLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={value ? String(value) : ""}
        onChangeText={(text) => onChange(parseNumberInput(text))}
        placeholder={placeholder}
      />
    </View>
  );
}

// O tick (Chinh chu / Thuong luong)
function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.lsCheckRow} onPress={onToggle}>
      <View style={[styles.lsCheckBox, checked && styles.lsCheckBoxOn]}>
        {checked ? <Feather name="check" size={14} color="#ffffff" /> : null}
      </View>
      <Text style={styles.lsCheckLabel}>{label}</Text>
    </Pressable>
  );
}

// Quy doi gia (ty) -> "X tỷ Y triệu" giong Landsoft "{0:0.#}"
function formatGiaQuyDoi(priceTy?: number): string {
  if (!priceTy || priceTy <= 0) return "";
  const ty = Math.floor(priceTy);
  const trieu = Math.round((priceTy - ty) * 1000);
  const fmt = (n: number) => String(Number(n.toFixed(1)));
  if (ty && trieu) return `= ${fmt(ty)} tỷ ${trieu} triệu`;
  if (ty) return `= ${fmt(ty)} tỷ`;
  return `= ${Math.round(priceTy * 1000)} triệu`;
}


// ==== UI kieu WinForms giong Landsoft desktop ====
function WfRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.wfRow}>
      <Text style={styles.wfLabel}>{label}</Text>
      <View style={styles.wfControl}>{children}</View>
    </View>
  );
}

function WfCheck({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable style={styles.wfCheckItem} onPress={onToggle}>
      <View style={[styles.wfCheckBox, checked && styles.wfCheckBoxChecked]}>
        {checked ? <Feather name="check" size={11} color="#fff" /> : null}
      </View>
      <Text style={styles.wfCheckText}>{label}</Text>
    </Pressable>
  );
}

function WfSelect({
  value,
  items,
  onChange,
  emptyLabel = "",
}: {
  value?: string;
  items: LookupItem[];
  onChange: (v: string) => void;
  emptyLabel?: string;
}) {
  return (
    <View style={styles.wfPickerWrap}>
      <Picker mode="dropdown" selectedValue={value ?? ""} onValueChange={(v) => onChange(String(v ?? ""))} dropdownIconColor="#44536E" style={{ color: "#111827" }}>
        <Picker.Item label={emptyLabel} value="" />
        {items.map((item) => (
          <Picker.Item key={item.code} label={item.label} value={item.code} />
        ))}
      </Picker>
    </View>
  );
}

export function LandsoftFormScreen({
  token,
  lookups,
  draft,
  savingDraft,
  staffName,
  onChangeDraft,
  onSubmitSuccess,
}: {
  token: string;
  lookups: LookupCollections;
  draft: PropertyCreatePayload;
  savingDraft: boolean;
  staffName?: string;
  onChangeDraft: (patch: Partial<PropertyCreatePayload>) => void;
  onSubmitSuccess: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  // So DK tu hien khi mo form — giong Landsoft (MaBC ke tiep trong SQL)
  const [nextCode, setNextCode] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchNextPropertyCode(token)
      .then((code) => {
        if (!cancelled) setNextCode(code);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);

  const wardOptions = lookups.wards.filter(
    (item) => !draft.district_code || item.parent_code === draft.district_code
  );

  // SDT trung -> o do + hien ten chu nha (giong Landsoft "Tìm" + "Số di động đã có trong hệ thống").
  // Chi check khi SDT TRON (chua them ky tu la). Them "." hoac ky tu dac biet
  // -> coi nhu so khac -> het do, de co y bo qua canh bao.
  const phoneClean = cleanPhoneCompare(draft.contact_phone); // bo khoang trang + +84->0
  const isPlainPhone = /^0\d{8,10}$/.test(phoneClean);
  const [phoneCheck, setPhoneCheck] = useState<{
    checking: boolean;
    count: number;
    ownerName: string | null;
    checkedPhone: string;
  }>({ checking: false, count: 0, ownerName: null, checkedPhone: "" });
  useEffect(() => {
    if (!isPlainPhone) {
      setPhoneCheck({ checking: false, count: 0, ownerName: null, checkedPhone: "" });
      return;
    }
    let cancelled = false;
    setPhoneCheck((prev) => ({ ...prev, checking: true }));
    const timer = setTimeout(() => {
      checkPhone(token, phoneClean)
        .then((res) => {
          if (!cancelled)
            setPhoneCheck({ checking: false, count: res.count, ownerName: res.ownerName, checkedPhone: phoneClean });
        })
        .catch(() => {
          if (!cancelled)
            setPhoneCheck({ checking: false, count: 0, ownerName: null, checkedPhone: phoneClean });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phoneClean, isPlainPhone, token]);

  const phoneDup = isPlainPhone && phoneCheck.count > 0 && phoneCheck.checkedPhone === phoneClean;
  const phoneChecked =
    isPlainPhone && !phoneCheck.checking && phoneCheck.count === 0 && phoneCheck.checkedPhone === phoneClean;
  const giaQuyDoi = formatGiaQuyDoi(draft.price);

  // Danh sach ten duong theo quan (dropdown 'Tên đường'), tai khi doi quan
  const [streets, setStreets] = useState<string[]>([]);
  const [streetFocused, setStreetFocused] = useState(false);
  useEffect(() => {
    if (!draft.district_code) {
      setStreets([]);
      return;
    }
    let cancelled = false;
    fetchStreets(token, draft.district_code)
      .then((list) => {
        if (!cancelled) setStreets(list);
      })
      .catch(() => {
        if (!cancelled) setStreets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [draft.district_code, token]);

  const streetSuggestions = useMemo(() => {
    const q = stripAccents(draft.street_name ?? "");
    const pool = streets;
    if (!q) return pool.slice(0, 8);
    return pool.filter((name) => stripAccents(name).includes(q)).slice(0, 8);
  }, [streets, draft.street_name]);

  // Dan tin Cho Tot tu clipboard (copy tu Telegram) -> tu tach va dien san form.
  // Copy NHIEU tin cung luc -> hien danh sach de chon tin muon dien.
  const [listingOptions, setListingOptions] = useState<ChototListingOption[] | null>(null);

  const applyListing = (option: ChototListingOption) => {
    // Reset cac truong thuoc ve tin cu roi moi ap tin moi — tranh tron 2 tin
    onChangeDraft({ ...chototFieldDefaults, ...option.patch });
    setListingOptions(null);
    const missing: string[] = [];
    if (!option.patch.address) missing.push("số nhà");
    if (!option.patch.owner_name) missing.push("tên chủ nhà");
    if (!option.patch.contact_phone) missing.push("SĐT");
    Alert.alert(
      "Đã điền từ tin Chợ Tốt",
      `Đã điền: ${option.filled.join(", ")}.\n\nKiểm tra lại thông tin${missing.length ? `, bổ sung ${missing.join(" + ")}` : ""} rồi bấm Lưu.`
    );
  };

  const pasteFromChotot = async () => {
    let pasted = "";
    try {
      pasted = await Clipboard.getStringAsync();
    } catch {
      pasted = "";
    }
    if (!pasted.trim()) {
      Alert.alert(
        "Clipboard trống",
        "Hãy mở Telegram, giữ tin nhà từ bot Chợ Tốt → Copy (chọn nhiều tin cũng được), rồi quay lại bấm nút này."
      );
      return;
    }
    const options = parseChototMulti(pasted, lookups);
    if (options.length === 0) {
      Alert.alert(
        "Không nhận ra tin Chợ Tốt",
        "Nội dung copy không có địa chỉ / giá / diện tích. Hãy copy nguyên tin nhắn từ bot Telegram."
      );
      return;
    }
    if (options.length === 1) {
      applyListing(options[0]);
      return;
    }
    setListingOptions(options);
  };

  const validate = (): string | null => {
    if (!draft.address?.trim()) return "Thiếu số nhà / địa chỉ";
    if (!draft.district_code) return "Thiếu quận";
    if (!draft.ward_code) return "Thiếu phường";
    if (!draft.property_type_code) return "Thiếu loại BĐS";
    if (!draft.source_code) return "Thiếu nguồn tin";
    if (!draft.owner_name?.trim()) return "Thiếu tên chủ nhà";
    if (!draft.contact_phone?.trim()) return "Thiếu số điện thoại";
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
    const finalDraft = { ...draft };
    // Trang thai mac dinh: Cho duyet (tim theo nhan, fallback ma 2)
    const choDuyet = lookups.statuses.find((s) =>
      (s.label ?? "").toLowerCase().includes("duy")
    );
    finalDraft.status_code = choDuyet?.code ?? lookups.statuses[0]?.code ?? "2";
    if (!finalDraft.title?.trim()) {
      const district = lookups.districts.find((d) => d.code === finalDraft.district_code)?.label;
      finalDraft.title = [finalDraft.address, district].filter(Boolean).join(", ");
    }
    setSubmitting(true);
    try {
      const result = await createProperty(token, finalDraft);
      Alert.alert("Đã tạo nhà mới", result.message);
      await AsyncStorage.removeItem(CREATE_DRAFT_KEY);
      await onSubmitSuccess();
    } catch (submitError) {
      Alert.alert("Tạo nhà thất bại", normalizeApiError(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.wfScreen} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.detailTopBar}>
        <Text style={styles.lsFormTitle}>Đăng ký bán, cho thuê</Text>
        {savingDraft ? <Text style={styles.createSavingText}>Đang lưu...</Text> : null}
      </View>
      <Text style={styles.lsFormSubtitle}>Nhập nhà mới — lưu thẳng vào hệ thống HomeApp</Text>

      <Pressable style={styles.chototPasteButton} onPress={() => void pasteFromChotot()}>
        <Feather name="clipboard" size={16} color="#ffffff" />
        <Text style={styles.chototPasteButtonText}>Dán tin Chợ Tốt</Text>
      </Pressable>
      <Text style={styles.chototPasteHint}>
        Copy tin nhà từ bot Telegram rồi bấm nút — app tự điền địa chỉ, quận/phường, giá, diện tích.
        Copy nhiều tin cùng lúc sẽ hiện danh sách để chọn.
      </Text>

      {/* ===== KHACH HANG (tab dau cua Landsoft) ===== */}
      <View style={styles.wfGroup}>
        <Text style={styles.wfGroupTitle}>Khách hàng</Text>
        <WfRow label="Họ tên (*)">
          <TextInput
            style={styles.wfInput}
            value={draft.owner_name}
            onChangeText={(v) => onChangeDraft({ owner_name: v })}
          />
        </WfRow>
        <WfRow label="Di động (*)">
          <TextInput
            style={[
              styles.wfInput,
              // Giong Landsoft: to hong khi con trong (bat buoc) hoac khi SDT trung;
              // so moi hop le -> nen trang
              (!draft.contact_phone?.trim() || phoneDup) && styles.wfInputRequiredPhone,
            ]}
            keyboardType="phone-pad"
            value={draft.contact_phone}
            onChangeText={(v) => onChangeDraft({ contact_phone: v })}
          />
        </WfRow>
        {phoneCheck.checking ? (
          <Text style={styles.wfHint}>Đang kiểm tra số...</Text>
        ) : phoneDup ? (
          <Pressable onPress={() => onChangeDraft({ owner_name: phoneCheck.ownerName ?? "" })}>
            <Text style={styles.lsPhoneDupWarn}>
              ⚠ Số di động đã có trong hệ thống{phoneCheck.ownerName ? ` — ${phoneCheck.ownerName} (chạm để điền tên)` : ""}
            </Text>
          </Pressable>
        ) : phoneChecked ? (
          <Text style={styles.lsPhoneOk}>✓ Số mới — chưa có trong hệ thống</Text>
        ) : null}
        <WfRow label="Email">
          <TextInput
            style={styles.wfInput}
            keyboardType="email-address"
            autoCapitalize="none"
            value={draft.owner_email ?? ""}
            onChangeText={(v) => onChangeDraft({ owner_email: v })}
          />
        </WfRow>
        <WfRow label="Điện thoại">
          <TextInput
            style={styles.wfInput}
            keyboardType="phone-pad"
            value={draft.owner_phone2 ?? ""}
            onChangeText={(v) => onChangeDraft({ owner_phone2: v })}
          />
        </WfRow>
        <WfRow label="Địa chỉ">
          <TextInput
            style={styles.wfInput}
            value={draft.owner_address ?? ""}
            onChangeText={(v) => onChangeDraft({ owner_address: v })}
          />
        </WfRow>
        <WfRow label="Khu vực">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value="Theo quận đã chọn" editable={false} />
        </WfRow>
      </View>

      {/* ===== THONG TIN CO BAN (thu tu doc tung hang cua Landsoft) ===== */}
      <View style={styles.wfGroup}>
        <Text style={styles.wfGroupTitle}>Thông tin cơ bản</Text>
        <WfRow label="Số ĐK (*)">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value={nextCode ? String(nextCode) : "Tự sinh"} editable={false} />
        </WfRow>
        <WfRow label="Tỉnh (TP)">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value="Hồ Chí Minh" editable={false} />
        </WfRow>
        <WfRow label="Diện tích">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.area ? String(draft.area) : ""}
            onChangeText={(v) => onChangeDraft({ area: parseNumberInput(v) })}
            placeholder="m²"
          />
        </WfRow>
        <WfRow label="Phí môi giới">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TextInput
              style={[styles.wfInput, { flex: 1 }]}
              keyboardType="decimal-pad"
              value={String(draft.brokerage_percent ?? 1)}
              onChangeText={(v) => onChangeDraft({ brokerage_percent: parseNumberInput(v) })}
            />
            <Text style={styles.wfRadioText}>%</Text>
          </View>
        </WfRow>
        <WfRow label="Nhu cầu">
          <View style={styles.wfRadioRow}>
            <Pressable style={styles.wfRadioItem} onPress={() => onChangeDraft({ listing_type: "ban" })}>
              <View style={styles.wfRadioOuter}>
                {draft.listing_type === "ban" ? <View style={styles.wfRadioInner} /> : null}
              </View>
              <Text style={styles.wfRadioText}>Cần bán</Text>
            </Pressable>
            <Pressable style={styles.wfRadioItem} onPress={() => onChangeDraft({ listing_type: "thue" })}>
              <View style={styles.wfRadioOuter}>
                {draft.listing_type === "thue" ? <View style={styles.wfRadioInner} /> : null}
              </View>
              <Text style={styles.wfRadioText}>Cho thuê</Text>
            </Pressable>
          </View>
        </WfRow>
        <WfRow label="Quận (H)">
          <WfSelect
            value={draft.district_code}
            items={lookups.districts}
            onChange={(v) => onChangeDraft({ district_code: v, ward_code: "" })}
          />
        </WfRow>
        <WfRow label="Đơn giá">
          <TextInput
            style={[styles.wfInput, styles.wfInputDisabled]}
            value={draft.price > 0 && draft.area > 0 ? `${Math.round((draft.price * 1000) / draft.area)} triệu/m²` : "0"}
            editable={false}
          />
        </WfRow>
        <WfRow label="Giá gốc">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.original_price ? String(draft.original_price) : ""}
            onChangeText={(v) => onChangeDraft({ original_price: parseNumberInput(v) })}
            placeholder="tỷ"
          />
        </WfRow>
        <WfRow label="Loại BĐS (*)">
          <WfSelect
            value={draft.property_type_code}
            items={lookups.property_types}
            onChange={(v) => onChangeDraft({ property_type_code: v })}
          />
        </WfRow>
        <WfRow label="Phường (Xã)">
          <WfSelect
            value={draft.ward_code}
            items={wardOptions}
            onChange={(v) => onChangeDraft({ ward_code: v })}
          />
        </WfRow>
        <WfRow label="Giá bán">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.price ? String(draft.price) : ""}
            onChangeText={(v) => onChangeDraft({ price: parseNumberInput(v) })}
            placeholder="tỷ"
          />
        </WfRow>
        {giaQuyDoi ? <Text style={styles.wfHint}>{giaQuyDoi}</Text> : null}
        <WfRow label="Chia sẻ">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value="Nội bộ" editable={false} />
        </WfRow>
        {lookups.grades.length > 0 ? (
          <WfRow label="Cấp độ (*)">
            <WfSelect
              value={draft.grade_code ?? ""}
              items={lookups.grades}
              onChange={(v) => onChangeDraft({ grade_code: v })}
            />
          </WfRow>
        ) : null}
        <WfRow label="Tên đường">
          <TextInput
            style={styles.wfInput}
            value={draft.street_name ?? ""}
            onChangeText={(v) => onChangeDraft({ street_name: v })}
            onFocus={() => setStreetFocused(true)}
            onBlur={() => setTimeout(() => setStreetFocused(false), 200)}
            placeholder={draft.district_code ? "" : "Chọn quận trước"}
            editable={!!draft.district_code}
          />
        </WfRow>
        {streetFocused && streetSuggestions.length > 0 ? (
          <View style={styles.lsStreetDropdown}>
            {streetSuggestions.map((name) => (
              <Pressable
                key={name}
                style={styles.lsStreetItem}
                onPress={() => {
                  onChangeDraft({ street_name: name });
                  setStreetFocused(false);
                }}
              >
                <Feather name="map-pin" size={13} color="#6B7FA3" />
                <Text style={styles.lsStreetItemText}>{name}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <WfRow label="Loại tiền/ĐVT">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value="VNĐ" editable={false} />
        </WfRow>
        <WfRow label="Nhân viên">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value={staffName || "Theo tài khoản đăng nhập"} editable={false} />
        </WfRow>
        <WfRow label="Nguồn">
          <WfSelect
            value={draft.source_code}
            items={lookups.sources}
            onChange={(v) => onChangeDraft({ source_code: v })}
          />
        </WfRow>
        <WfRow label="Số nhà">
          <TextInput
            style={styles.wfInput}
            value={draft.address}
            onChangeText={(v) => onChangeDraft({ address: v })}
          />
        </WfRow>
        {draft.negotiable ? <Text style={styles.wfThuongLuong}>Thương lượng</Text> : null}
      </View>

      {/* ===== DAC DIEM VA TIEN ICH (thu tu doc tung hang cua Landsoft) ===== */}
      <View style={styles.wfGroup}>
        <Text style={styles.wfGroupTitle}>Đặc điểm và tiện ích</Text>
        <WfRow label="Hướng">
          <WfSelect
            value={draft.direction_code ?? ""}
            items={lookups.directions}
            onChange={(v) => onChangeDraft({ direction_code: v })}
          />
        </WfRow>
        <WfRow label="Pháp lý">
          <WfSelect
            value={draft.legal_status_code ?? ""}
            items={lookups.legal_statuses}
            onChange={(v) => onChangeDraft({ legal_status_code: v })}
          />
        </WfRow>
        <WfRow label="Tiện tích">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value="" editable={false} />
        </WfRow>
        {lookups.road_types.length > 0 ? (
          <WfRow label="Loại đường">
            <WfSelect
              value={draft.road_type_code ?? ""}
              items={lookups.road_types}
              onChange={(v) => onChangeDraft({ road_type_code: v })}
            />
          </WfRow>
        ) : null}
        <WfRow label="P.Khách">
          <TextInput
            style={styles.wfInput}
            keyboardType="number-pad"
            value={draft.living_rooms ? String(draft.living_rooms) : ""}
            onChangeText={(v) => onChangeDraft({ living_rooms: parseNumberInput(v) })}
            placeholder="0"
          />
        </WfRow>
        <WfRow label="P.Tắm">
          <TextInput
            style={styles.wfInput}
            keyboardType="number-pad"
            value={draft.bathrooms ? String(draft.bathrooms) : ""}
            onChangeText={(v) => onChangeDraft({ bathrooms: parseNumberInput(v) })}
            placeholder="0"
          />
        </WfRow>
        <WfRow label="P.Ngủ">
          <TextInput
            style={styles.wfInput}
            keyboardType="number-pad"
            value={draft.bedrooms ? String(draft.bedrooms) : ""}
            onChangeText={(v) => onChangeDraft({ bedrooms: parseNumberInput(v) })}
            placeholder="0"
          />
        </WfRow>
        <WfRow label="Số tầng">
          <TextInput
            style={styles.wfInput}
            keyboardType="number-pad"
            value={draft.floors ? String(draft.floors) : ""}
            onChangeText={(v) => onChangeDraft({ floors: parseNumberInput(v) })}
            placeholder="0"
          />
        </WfRow>
        <WfRow label="Diện tích KV">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.area ? String(draft.area) : ""}
            onChangeText={(v) => onChangeDraft({ area: parseNumberInput(v) })}
            placeholder="m²"
          />
        </WfRow>
        <WfRow label="Ngang KV">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.width ? String(draft.width) : ""}
            onChangeText={(v) => onChangeDraft({ width: parseNumberInput(v) })}
            placeholder="0 m"
          />
        </WfRow>
        <WfRow label="Dài KV">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.length ? String(draft.length) : ""}
            onChangeText={(v) => onChangeDraft({ length: parseNumberInput(v) })}
            placeholder="0 m"
          />
        </WfRow>
        <WfRow label="Nở hậu KV">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.back_width ? String(draft.back_width) : ""}
            onChangeText={(v) => onChangeDraft({ back_width: parseNumberInput(v) })}
            placeholder="0"
          />
        </WfRow>
        <WfRow label="Đường rộng">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.road_width ? String(draft.road_width) : ""}
            onChangeText={(v) => onChangeDraft({ road_width: parseNumberInput(v) })}
            placeholder="m"
          />
        </WfRow>
        <WfRow label=" ">
          <View style={styles.wfCheckRow}>
            <WfCheck label="Hầm" checked={!!draft.has_basement} onToggle={() => onChangeDraft({ has_basement: !draft.has_basement })} />
            <WfCheck label="Lửng" checked={!!draft.has_mezzanine} onToggle={() => onChangeDraft({ has_mezzanine: !draft.has_mezzanine })} />
            <WfCheck label="Sân thượng" checked={!!draft.has_terrace} onToggle={() => onChangeDraft({ has_terrace: !draft.has_terrace })} />
          </View>
        </WfRow>
        <WfRow label=" ">
          <View style={styles.wfCheckRow}>
            <WfCheck label="Chính chủ" checked={!!draft.direct_owner} onToggle={() => onChangeDraft({ direct_owner: !draft.direct_owner })} />
            <WfCheck label="Thương lượng" checked={!!draft.negotiable} onToggle={() => onChangeDraft({ negotiable: !draft.negotiable })} />
          </View>
        </WfRow>
      </View>

      {/* ===== TIEU DE & DIEN GIAI ===== */}
      <View style={styles.wfGroup}>
        <WfRow label="Tiêu đề">
          <TextInput
            style={styles.wfInput}
            value={draft.title}
            onChangeText={(v) => onChangeDraft({ title: v })}
            placeholder="Tự tạo nếu bỏ trống"
          />
        </WfRow>
        <WfRow label="Diễn giải">
          <TextInput
            style={[styles.wfInput, styles.textArea]}
            multiline
            value={draft.description ?? ""}
            onChangeText={(v) => onChangeDraft({ description: v })}
          />
        </WfRow>
      </View>

      <View style={styles.wfBtnRow}>
        <Pressable
          style={[styles.wfBtn, styles.wfBtnPrimary, submitting && styles.buttonDisabled]}
          disabled={submitting}
          onPress={() => void submit()}
        >
          <Feather name="save" size={16} color="#1F3B70" />
          <Text style={styles.wfBtnText}>{submitting ? "Đang lưu..." : "Lưu"}</Text>
        </Pressable>
        <Pressable
          style={styles.wfBtn}
          onPress={() =>
            Alert.alert("Hoãn nhập", "Xóa toàn bộ dữ liệu đang nhập trên form?", [
              { text: "Không", style: "cancel" },
              {
                text: "Xóa",
                style: "destructive",
                onPress: () => onChangeDraft({ ...chototFieldDefaults, brokerage_percent: 1 }),
              },
            ])
          }
        >
          <Feather name="rotate-ccw" size={16} color="#1F3B70" />
          <Text style={styles.wfBtnText}>Hoãn</Text>
        </Pressable>
      </View>
      <Text style={styles.submitPanelDescription}>
        Trạng thái mặc định: Chờ duyệt · Số ĐK và Tiêu đề tự sinh khi lưu
      </Text>

      {/* Chon tin khi clipboard chua nhieu tin Cho Tot */}
      <Modal
        visible={listingOptions !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setListingOptions(null)}
      >
        <View style={styles.chototPickerBackdrop}>
          <View style={styles.chototPickerSheet}>
            <View style={styles.chototPickerHeader}>
              <Feather name="list" size={18} color="#17305D" />
              <Text style={styles.chototPickerTitle}>
                Chọn tin để điền ({listingOptions?.length ?? 0} tin)
              </Text>
            </View>
            <ScrollView style={styles.chototPickerList}>
              {(listingOptions ?? []).map((option, index) => (
                <Pressable
                  key={`${option.title}-${index}`}
                  style={({ pressed }) => [
                    styles.chototPickerItem,
                    pressed && styles.chototPickerItemPressed,
                  ]}
                  onPress={() => applyListing(option)}
                >
                  <Text style={styles.chototPickerItemTitle} numberOfLines={2}>
                    {option.title}
                  </Text>
                  {option.subtitle ? (
                    <Text style={styles.chototPickerItemSub} numberOfLines={1}>
                      {option.subtitle}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable style={styles.chototPickerCancel} onPress={() => setListingOptions(null)}>
              <Text style={styles.chototPickerCancelText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
