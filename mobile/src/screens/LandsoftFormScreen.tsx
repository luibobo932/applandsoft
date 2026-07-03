import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Field, Section, SelectField } from "../components/shared";
import { styles } from "../styles";
import { normalizeApiError, parseNumberInput } from "../utils";
import { checkHouseNumber, checkPhone, cleanPhoneCompare, createProperty, fetchNextPropertyCode, fetchStreets } from "../api";
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

  // Mac dinh theo quy trinh: Cap do = Hang Hot, Nguon = Khao sat thuc te, Phap ly = So hong
  useEffect(() => {
    const patch: Partial<PropertyCreatePayload> = {};
    if (!draft.grade_code && lookups.grades.length > 0) {
      const hot = lookups.grades.find((g) => stripAccents(g.label).includes("hang hot"));
      if (hot) patch.grade_code = hot.code;
    }
    if (!draft.source_code && lookups.sources.length > 0) {
      const ks = lookups.sources.find((x) => stripAccents(x.label).includes("khao sat"));
      if (ks) patch.source_code = ks.code;
    }
    if (!draft.legal_status_code && lookups.legal_statuses.length > 0) {
      const sh = lookups.legal_statuses.find((x) => stripAccents(x.label).includes("so hong"));
      if (sh) patch.legal_status_code = sh.code;
    }
    if (Object.keys(patch).length > 0) onChangeDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookups, draft.grade_code, draft.source_code, draft.legal_status_code]);

  // So nha trung -> to do (nhu logic SDT chu nha)
  const [houseCheck, setHouseCheck] = useState<{
    checking: boolean;
    count: number;
    sample: string;
    checked: string;
  }>({ checking: false, count: 0, sample: "", checked: "" });
  useEffect(() => {
    const house = (draft.address ?? "").trim();
    const street = (draft.street_name ?? "").trim();
    // Chi bao trung khi TRUNG CA: so nha + ten duong + quan
    if (!house || !street || !draft.district_code) {
      setHouseCheck({ checking: false, count: 0, sample: "", checked: "" });
      return;
    }
    let cancelled = false;
    setHouseCheck((prev) => ({ ...prev, checking: true }));
    const timer = setTimeout(() => {
      checkHouseNumber(token, house, draft.district_code || undefined, street)
        .then((res) => {
          if (!cancelled)
            setHouseCheck({ checking: false, count: res.count, sample: res.sample ?? "", checked: house });
        })
        .catch(() => {
          if (!cancelled) setHouseCheck({ checking: false, count: 0, sample: "", checked: house });
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft.address, draft.district_code, draft.street_name, token]);
  const houseDup = houseCheck.count > 0 && houseCheck.checked === (draft.address ?? "").trim();

  // Tinh -> Quan -> Phuong -> Duong lien ket chuoi
  const districtOptions = lookups.districts.filter(
    (item) => !draft.province_code || !item.parent_code || item.parent_code === draft.province_code
  );
  const wardOptions = lookups.wards.filter(
    (item) => !draft.district_code || item.parent_code === draft.district_code
  );
  useEffect(() => {
    if (!draft.province_code && lookups.provinces.length > 0) {
      const hcm = lookups.provinces.find((x) => stripAccents(x.label).includes("ho chi minh"));
      onChangeDraft({ province_code: (hcm ?? lookups.provinces[0]).code });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookups.provinces, draft.province_code]);

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
    if (!q) return pool.slice(0, 12);
    // Da chon dung 1 ten -> bam mui ten mo lai thi hien ca danh sach de doi
    if (pool.some((name) => stripAccents(name) === q)) return pool.slice(0, 12);
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
    // Tieu de de trong neu nguoi dung khong go — giong het Landsoft desktop
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

      {/* ===== KHACH HANG: chi Ho ten + Di dong theo yeu cau ===== */}
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
      </View>

      {/* ===== THONG TIN CO BAN: dung thu tu anh Landsoft ===== */}
      <View style={styles.wfGroup}>
        <Text style={styles.wfGroupTitle}>Thông tin cơ bản</Text>
        <WfRow label="Số ĐK (*)">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value={nextCode ? String(nextCode) : "Tự sinh"} editable={false} />
        </WfRow>
        <WfRow label="Tỉnh (TP)">
          <WfSelect
            value={draft.province_code ?? ""}
            items={lookups.provinces}
            onChange={(v) => onChangeDraft({ province_code: v, district_code: "", ward_code: "", street_name: "" })}
          />
        </WfRow>
        <WfRow label="Quận (H)">
          <WfSelect
            value={draft.district_code}
            items={districtOptions}
            onChange={(v) => onChangeDraft({ district_code: v, ward_code: "", street_name: "" })}
          />
        </WfRow>
        <WfRow label="Phường (Xã)">
          <WfSelect
            value={draft.ward_code}
            items={wardOptions}
            onChange={(v) => onChangeDraft({ ward_code: v })}
          />
        </WfRow>
        <WfRow label="Tên đường">
          <View style={{ position: "relative" }}>
            <TextInput
              style={[styles.wfInput, { paddingRight: 36 }]}
              value={draft.street_name ?? ""}
              onChangeText={(v) => onChangeDraft({ street_name: v })}
              onFocus={() => setStreetFocused(true)}
              onBlur={() => setTimeout(() => setStreetFocused(false), 200)}
              placeholder={draft.district_code ? "" : "Chọn quận trước"}
              editable={!!draft.district_code}
            />
            <Pressable
              style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 36, alignItems: "center", justifyContent: "center" }}
              onPress={() => {
                if (draft.district_code) setStreetFocused((f) => !f);
              }}
            >
              <Feather name="chevron-down" size={18} color="#44536E" />
            </Pressable>
          </View>
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
        <WfRow label="Số nhà">
          <TextInput
            style={[styles.wfInput, houseDup && styles.wfInputRequiredPhone]}
            value={draft.address}
            onChangeText={(v) => onChangeDraft({ address: v })}
          />
        </WfRow>
        {houseCheck.checking ? (
          <Text style={styles.wfHint}>Đang kiểm tra số nhà...</Text>
        ) : houseDup ? (
          <Text style={styles.lsPhoneDupWarn}>
            ⚠ Trùng số nhà + đường + quận ({houseCheck.count} căn): {houseCheck.sample}
          </Text>
        ) : null}
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
        <WfRow label="Loại BĐS (*)">
          <WfSelect
            value={draft.property_type_code}
            items={lookups.property_types}
            onChange={(v) => onChangeDraft({ property_type_code: v })}
          />
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
        <WfRow label="Nguồn">
          <WfSelect
            value={draft.source_code}
            items={lookups.sources}
            onChange={(v) => onChangeDraft({ source_code: v })}
          />
        </WfRow>
        <WfRow label="Diện tích">
          <TextInput
            style={[styles.wfInput, styles.wfInputDisabled]}
            value={draft.area ? `${draft.area} m²` : ""}
            editable={false}
            placeholder="= Ngang × Dài"
          />
        </WfRow>
        <WfRow label="Đơn giá">
          <TextInput
            style={[styles.wfInput, styles.wfInputDisabled]}
            value={draft.price > 0 && draft.area > 0 ? `${Math.round((draft.price * 1000) / draft.area)} triệu/m²` : "0"}
            editable={false}
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
        <WfRow label="Chia sẻ">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value="Nội bộ" editable={false} />
        </WfRow>
        <WfRow label="Loại tiền/ĐVT">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value="VNĐ" editable={false} />
        </WfRow>
        <WfRow label="Nhân viên">
          <TextInput style={[styles.wfInput, styles.wfInputDisabled]} value={staffName || "Theo tài khoản đăng nhập"} editable={false} />
        </WfRow>
        {draft.negotiable ? <Text style={styles.wfThuongLuong}>Thương lượng</Text> : null}
      </View>

      {/* ===== DAC DIEM VA TIEN ICH: chi Phap ly / Loai duong / Ngang / Dai ===== */}
      <View style={styles.wfGroup}>
        <Text style={styles.wfGroupTitle}>Đặc điểm và tiện ích</Text>
        <WfRow label="Pháp lý">
          <WfSelect
            value={draft.legal_status_code ?? ""}
            items={lookups.legal_statuses}
            onChange={(v) => onChangeDraft({ legal_status_code: v })}
          />
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
        <WfRow label="Ngang KV">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.width ? String(draft.width) : ""}
            onChangeText={(v) => {
              const width = parseNumberInput(v);
              // Dien tich = Ngang x Dai (tu tinh)
              const area = width > 0 && (draft.length ?? 0) > 0 ? Math.round(width * (draft.length ?? 0) * 100) / 100 : draft.area;
              onChangeDraft({ width, area });
            }}
            placeholder="0 m"
          />
        </WfRow>
        <WfRow label="Dài KV">
          <TextInput
            style={styles.wfInput}
            keyboardType="decimal-pad"
            value={draft.length ? String(draft.length) : ""}
            onChangeText={(v) => {
              const length = parseNumberInput(v);
              const area = length > 0 && (draft.width ?? 0) > 0 ? Math.round((draft.width ?? 0) * length * 100) / 100 : draft.area;
              onChangeDraft({ length, area });
            }}
            placeholder="0 m"
          />
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
