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

// O nhap so thap phan: giu nguyen chuoi dang go ("3," / "3.7") de dau phay
// khong bi xoa boi re-render; chap nhan ca dau phay lan dau cham
function WfDecimal({
  value,
  onChange,
  placeholder,
  suffix,
}: {
  value?: number;
  onChange: (v: number) => void;
  placeholder?: string;
  suffix?: string;
}) {
  const [text, setText] = useState(value ? String(value) : "");
  useEffect(() => {
    // Gia tri bi doi tu ben ngoai (dan tin / xoa nhap) -> dong bo lai chuoi
    const parsed = parseNumberInput(text);
    if ((value ?? 0) !== parsed) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const input = (
    <TextInput
      style={[styles.wfInput, (value ?? 0) > 0 && styles.wfInputDone, suffix ? { flex: 1 } : null]}
      keyboardType="decimal-pad"
      value={text}
      onChangeText={(v) => {
        setText(v);
        onChange(parseNumberInput(v));
      }}
      placeholder={placeholder}
    />
  );
  if (!suffix) return input;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {input}
      <Text style={styles.wfRadioText}>{suffix}</Text>
    </View>
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
    <View style={[styles.wfPickerWrap, !!value && styles.wfPickerWrapDone]}>
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

  // Mac dinh theo quy trinh: Cap do = Hang Hot, Nguon = Khao sat thuc te, Phap ly = So hong,
  // Nhu cau = Can ban, Phi moi gioi = 1% (tat ca luon co dinh -> an khoi UI)
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
    if (draft.listing_type !== "ban") patch.listing_type = "ban";
    if (!draft.brokerage_percent) patch.brokerage_percent = 1;
    if (Object.keys(patch).length > 0) onChangeDraft(patch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookups, draft.grade_code, draft.source_code, draft.legal_status_code, draft.listing_type, draft.brokerage_percent]);

  // Loai duong tu chon theo Loai BDS (Mat tien -> Mat tien duong, Nha hem -> Duong hem lon).
  // An khoi UI nhung van dong bo ke ca khi dan tin Cho Tot pre-fill Loai BDS.
  useEffect(() => {
    if (!draft.property_type_code || lookups.road_types.length === 0) return;
    const typeLabel = stripAccents(
      lookups.property_types.find((t) => t.code === draft.property_type_code)?.label ?? ""
    );
    let roadKey = "";
    if (typeLabel.includes("mat tien")) roadKey = "mat tien";
    else if (typeLabel.includes("hem")) roadKey = "hem lon";
    if (!roadKey) return;
    const road = lookups.road_types.find((r) => stripAccents(r.label).includes(roadKey));
    if (road && draft.road_type_code !== road.code) onChangeDraft({ road_type_code: road.code });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.property_type_code, lookups.road_types, lookups.property_types]);

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
  // Loai BDS chi cho chon Mat tien / Nha hem (an cac loai khac)
  const propertyTypeOptions = useMemo(
    () =>
      lookups.property_types.filter((t) => {
        const l = stripAccents(t.label);
        return l === "mat tien" || l === "nha hem";
      }),
    [lookups.property_types]
  );
  // Tinh (TP) luon la TP HCM -> khoa cung, an khoi UI
  const hcmProvinceCode = useMemo(() => {
    const hcm = lookups.provinces.find((x) => stripAccents(x.label).includes("ho chi minh"));
    return (hcm ?? lookups.provinces[0])?.code;
  }, [lookups.provinces]);
  useEffect(() => {
    if (hcmProvinceCode && draft.province_code !== hcmProvinceCode) {
      onChangeDraft({ province_code: hcmProvinceCode });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hcmProvinceCode, draft.province_code]);

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
    // Thieu ten duong -> canh bao RIENG that ro: khong co no thi kiem tra trung
    // so nha khong chay duoc (vu 651/2 bi nhap trung ngay 10/07)
    const noStreet = !option.patch.street_name;
    Alert.alert(
      noStreet ? "⚠ Chưa nhận ra TÊN ĐƯỜNG" : "Đã điền từ tin Chợ Tốt",
      `Đã điền: ${option.filled.join(", ")}.\n\n` +
        (noStreet
          ? "Tin này không ghi rõ tên đường — hãy CHỌN TÊN ĐƯỜNG bằng tay (bấm mũi tên ở ô Tên đường), nếu không app sẽ không kiểm tra được trùng số nhà."
          : "") +
        `${missing.length ? `Bổ sung thêm: ${missing.join(" + ")}. ` : ""}Kiểm tra lại rồi bấm Lưu.`
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
    // Bat buoc ten duong: thieu no thi canh bao trung so nha cung khong chay,
    // de lot ban ghi thieu duong len Landsoft (vu 651/2 ngay 10/07)
    if (!draft.street_name?.trim()) return "Thiếu tên đường";
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
    // Dang co canh bao trung -> bat xac nhan 1 nhip truoc khi luu (van cho luu)
    const dupWarnings: string[] = [];
    if (houseDup) {
      dupWarnings.push(
        `• Số nhà TRÙNG với ${houseCheck.count} căn có sẵn (cùng đường + quận): ${houseCheck.sample}`
      );
    }
    if (phoneDup) {
      dupWarnings.push(
        `• SĐT chủ nhà đã có trong hệ thống${phoneCheck.ownerName ? ` — ${phoneCheck.ownerName}` : ""}`
      );
    }
    if (dupWarnings.length > 0) {
      Alert.alert(
        "⚠ Đang có cảnh báo trùng",
        `${dupWarnings.join("\n")}\n\nBạn vẫn muốn lưu căn này chứ?`,
        [
          { text: "Xem lại", style: "cancel" },
          { text: "Vẫn lưu", style: "destructive", onPress: () => void performSave() },
        ]
      );
      return;
    }
    await performSave();
  };

  const performSave = async () => {
    const finalDraft = { ...draft };
    // Trang thai mac dinh: Cho duyet (tim theo nhan, fallback ma 2)
    const choDuyet = lookups.statuses.find((s) =>
      (s.label ?? "").toLowerCase().includes("duy")
    );
    finalDraft.status_code = choDuyet?.code ?? lookups.statuses[0]?.code ?? "2";
    // Tieu de an khoi UI, luon de trong — giong het dong desktop (TieuDe='')
    finalDraft.title = "";
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
            style={[styles.wfInput, !!draft.owner_name?.trim() && styles.wfInputDone]}
            value={draft.owner_name}
            onChangeText={(v) => onChangeDraft({ owner_name: v })}
          />
        </WfRow>
        <WfRow label="Di động (*)">
          <TextInput
            style={[
              styles.wfInput,
              !draft.contact_phone?.trim() || phoneDup ? styles.wfInputRequiredPhone : styles.wfInputDone,
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
        {/* Tinh (TP) luon la TP HCM -> an khoi UI, gia tri van gui ve Landsoft */}
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
              style={[styles.wfInput, !!draft.street_name?.trim() && styles.wfInputDone, { paddingRight: 36 }]}
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
            style={[styles.wfInput, houseDup ? styles.wfInputRequiredPhone : !!draft.address?.trim() && styles.wfInputDone]}
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
        {/* Nhu cau luon "Can ban" -> an khoi UI */}
        <WfRow label="Loại BĐS (*)">
          <WfSelect
            value={draft.property_type_code}
            items={propertyTypeOptions}
            onChange={(v) => {
              // Mat tien -> Loai duong "Mat tien duong"; Nha hem -> "Duong hem lon"
              // (van doi lai duoc o muc Loai duong ben duoi)
              const patch: Partial<PropertyCreatePayload> = { property_type_code: v };
              const typeLabel = stripAccents(lookups.property_types.find((t) => t.code === v)?.label ?? "");
              let roadKey = "";
              if (typeLabel.includes("mat tien")) roadKey = "mat tien";
              else if (typeLabel.includes("hem")) roadKey = "hem lon";
              if (roadKey) {
                const road = lookups.road_types.find((r) => stripAccents(r.label).includes(roadKey));
                if (road) patch.road_type_code = road.code;
              }
              onChangeDraft(patch);
            }}
          />
        </WfRow>
        {/* Cap do (Hang Hot), Nguon (Khao sat thuc te), Dien tich (= Ngang x Dai),
            Don gia (= Gia / Dien tich) deu tu dien ngam -> an khoi UI */}
        <WfRow label="Giá bán">
          <WfDecimal value={draft.price} onChange={(v) => onChangeDraft({ price: v })} placeholder="tỷ (VD: 3.7)" />
        </WfRow>
        {giaQuyDoi ? <Text style={styles.wfHint}>{giaQuyDoi}</Text> : null}
        {/* Phi moi gioi luon 1%, Chia se "Noi bo", Loai tien "VND", Nhan vien theo
            tai khoan dang nhap -> tat ca an khoi UI, gia tri van gui ve Landsoft */}
        {draft.negotiable ? <Text style={styles.wfThuongLuong}>Thương lượng</Text> : null}
      </View>

      {/* ===== DAC DIEM VA TIEN ICH: chi Ngang / Dai ===== */}
      <View style={styles.wfGroup}>
        <Text style={styles.wfGroupTitle}>Đặc điểm và tiện ích</Text>
        {/* Phap ly luon "So hong", Loai duong tu chon theo Loai BDS (Mat tien->Mat tien duong,
            Nha hem->Duong hem lon) -> ca 2 an khoi UI, gia tri van gui ve Landsoft */}
        {/* Ngang & Dai nam ngang cung 1 hang cho gon; nhap so thap phan (4.5 / 4,5) */}
        <View style={styles.wfDimRow}>
          <View style={styles.wfDimCell}>
            <Text style={styles.wfDimLabel}>Ngang</Text>
            <WfDecimal
              value={draft.width}
              onChange={(width) => {
                // Dien tich = Ngang x Dai (tu tinh)
                const area = width > 0 && (draft.length ?? 0) > 0 ? Math.round(width * (draft.length ?? 0) * 100) / 100 : draft.area;
                onChangeDraft({ width, area });
              }}
              placeholder="m"
            />
          </View>
          <View style={styles.wfDimCell}>
            <Text style={styles.wfDimLabel}>Dài</Text>
            <WfDecimal
              value={draft.length}
              onChange={(length) => {
                const area = length > 0 && (draft.width ?? 0) > 0 ? Math.round((draft.width ?? 0) * length * 100) / 100 : draft.area;
                onChangeDraft({ length, area });
              }}
              placeholder="m"
            />
          </View>
        </View>
      </View>

      {/* ===== DIEN GIAI (Tieu de an khoi UI, khong dien - giong dòng desktop TieuDe='') ===== */}
      <View style={styles.wfGroup}>
        <WfRow label="Diễn giải">
          <TextInput
            style={[styles.wfInput, styles.textArea, !!draft.description?.trim() && styles.wfInputDone]}
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
