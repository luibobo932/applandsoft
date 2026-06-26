import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Field, Section, SelectField } from "../components/shared";
import { styles } from "../styles";
import { normalizeApiError, parseNumberInput } from "../utils";
import { checkPhoneExists, createProperty } from "../api";
import { LookupCollections, PropertyCreatePayload } from "../types";

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

// Chuan hoa SDT de so sanh trung (bo ky tu khong phai so, +84 -> 0)
function normalizePhone(raw?: string | null): string {
  let s = (raw ?? "").replace(/[^\d+]/g, "");
  if (s.startsWith("+84")) s = "0" + s.slice(3);
  else if (s.startsWith("84") && s.length >= 11) s = "0" + s.slice(2);
  return s;
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

export function LandsoftFormScreen({
  token,
  lookups,
  draft,
  savingDraft,
  existingPhones = [],
  onChangeDraft,
  onSubmitSuccess,
}: {
  token: string;
  lookups: LookupCollections;
  draft: PropertyCreatePayload;
  savingDraft: boolean;
  existingPhones?: string[];
  onChangeDraft: (patch: Partial<PropertyCreatePayload>) => void;
  onSubmitSuccess: () => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const wardOptions = lookups.wards.filter(
    (item) => !draft.district_code || item.parent_code === draft.district_code
  );

  // Kiem tra SDT trung (giong Landsoft: o do len)
  const phoneNorm = normalizePhone(draft.contact_phone);
  const phoneDupLocal =
    phoneNorm.length >= 9 &&
    existingPhones.some((p) => normalizePhone(p) === phoneNorm);

  // Check trung TOAN BO kho qua backend (debounce 600ms)
  const [phoneDupServer, setPhoneDupServer] = useState(0);
  useEffect(() => {
    if (phoneNorm.length < 9) {
      setPhoneDupServer(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      checkPhoneExists(token, phoneNorm)
        .then((count) => {
          if (!cancelled) setPhoneDupServer(count);
        })
        .catch(() => {
          if (!cancelled) setPhoneDupServer(0);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phoneNorm, token]);

  const phoneDup = phoneDupLocal || phoneDupServer > 0;
  const giaQuyDoi = formatGiaQuyDoi(draft.price);

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
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.detailTopBar}>
        <Text style={styles.lsFormTitle}>Đăng ký bán, cho thuê</Text>
        {savingDraft ? <Text style={styles.createSavingText}>Đang lưu...</Text> : null}
      </View>
      <Text style={styles.lsFormSubtitle}>Nhập nhà mới — lưu thẳng vào hệ thống HomeApp</Text>

      {/* Nhu cau & phan loai */}
      <Section title="Nhu cầu & phân loại">
        <View style={styles.listingTypeRow}>
          <Pressable
            style={[styles.listingTypeButton, draft.listing_type === "ban" && styles.listingTypeButtonActive]}
            onPress={() => onChangeDraft({ listing_type: "ban" })}
          >
            <Text style={[styles.listingTypeButtonText, draft.listing_type === "ban" && styles.listingTypeButtonTextActive]}>
              Cần bán
            </Text>
          </Pressable>
          <Pressable
            style={[styles.listingTypeButton, draft.listing_type === "thue" && styles.listingTypeButtonActive]}
            onPress={() => onChangeDraft({ listing_type: "thue" })}
          >
            <Text style={[styles.listingTypeButtonText, draft.listing_type === "thue" && styles.listingTypeButtonTextActive]}>
              Cho thuê
            </Text>
          </Pressable>
        </View>
        <SelectField
          label="Loại BĐS"
          value={draft.property_type_code}
          items={lookups.property_types}
          onChange={(v) => onChangeDraft({ property_type_code: v })}
          allowEmpty={false}
          emptyLabel="Chọn loại BĐS"
        />
        <SelectField
          label="Nguồn tin"
          value={draft.source_code}
          items={lookups.sources}
          onChange={(v) => onChangeDraft({ source_code: v })}
          allowEmpty={false}
          emptyLabel="Chọn nguồn tin"
        />
        {lookups.grades.length > 0 ? (
          <SelectField
            label="Cấp độ"
            value={draft.grade_code ?? ""}
            items={lookups.grades}
            onChange={(v) => onChangeDraft({ grade_code: v })}
            emptyLabel="Chưa chọn"
          />
        ) : null}
      </Section>

      {/* Dia chi */}
      <Section title="Địa chỉ">
        <SelectField
          label="Quận / Huyện"
          value={draft.district_code}
          items={lookups.districts}
          onChange={(v) => onChangeDraft({ district_code: v, ward_code: "" })}
          allowEmpty={false}
          emptyLabel="Chọn quận"
        />
        <SelectField
          label="Phường / Xã"
          value={draft.ward_code}
          items={wardOptions}
          onChange={(v) => onChangeDraft({ ward_code: v })}
          allowEmpty={false}
          emptyLabel="Chọn phường"
        />
        <Field label="Tên đường">
          <TextInput
            style={styles.input}
            value={draft.street_name ?? ""}
            onChangeText={(v) => onChangeDraft({ street_name: v })}
            placeholder="VD: Nguyễn Trãi"
          />
        </Field>
        <Field label="Số nhà / Địa chỉ">
          <TextInput
            style={styles.input}
            value={draft.address}
            onChangeText={(v) => onChangeDraft({ address: v })}
            placeholder="VD: 172 Nguyễn Trãi"
          />
        </Field>
      </Section>

      {/* Gia & dien tich */}
      <Section title="Giá & diện tích">
        <Field label="Giá bán (tỷ)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.price ? String(draft.price) : ""}
            onChangeText={(v) => onChangeDraft({ price: parseNumberInput(v) })}
            placeholder="VD: 11"
          />
          {giaQuyDoi ? <Text style={styles.lsGiaQuyDoi}>{giaQuyDoi}</Text> : null}
        </Field>
        <Field label="Diện tích KV (m²)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.area ? String(draft.area) : ""}
            onChangeText={(v) => onChangeDraft({ area: parseNumberInput(v) })}
            placeholder="VD: 50"
          />
        </Field>
        <View style={styles.lsGridRow}>
          <NumField label="Ngang KV (m)" value={draft.width} onChange={(v) => onChangeDraft({ width: v })} placeholder="4" />
          <NumField label="Dài KV (m)" value={draft.length} onChange={(v) => onChangeDraft({ length: v })} placeholder="10" />
          <NumField label="Đường rộng (m)" value={draft.road_width} onChange={(v) => onChangeDraft({ road_width: v })} placeholder="6" />
        </View>
      </Section>

      {/* Ket cau */}
      <Section title="Kết cấu">
        <View style={styles.lsGridRow}>
          <NumField label="Số tầng" value={draft.floors} onChange={(v) => onChangeDraft({ floors: v })} placeholder="0" />
          <NumField label="P. Ngủ" value={draft.bedrooms} onChange={(v) => onChangeDraft({ bedrooms: v })} placeholder="0" />
          <NumField label="P. Tắm" value={draft.bathrooms} onChange={(v) => onChangeDraft({ bathrooms: v })} placeholder="0" />
          <NumField label="P. Khách" value={draft.living_rooms} onChange={(v) => onChangeDraft({ living_rooms: v })} placeholder="0" />
        </View>
      </Section>

      {/* Phap ly & huong */}
      <Section title="Pháp lý & hướng">
        <SelectField
          label="Pháp lý"
          value={draft.legal_status_code ?? ""}
          items={lookups.legal_statuses}
          onChange={(v) => onChangeDraft({ legal_status_code: v })}
          emptyLabel="Chưa chọn"
        />
        <SelectField
          label="Hướng"
          value={draft.direction_code ?? ""}
          items={lookups.directions}
          onChange={(v) => onChangeDraft({ direction_code: v })}
          emptyLabel="Chưa chọn"
        />
        <View style={styles.lsCheckGroup}>
          <CheckRow
            label="Chính chủ"
            checked={!!draft.direct_owner}
            onToggle={() => onChangeDraft({ direct_owner: !draft.direct_owner })}
          />
          <CheckRow
            label="Thương lượng"
            checked={!!draft.negotiable}
            onToggle={() => onChangeDraft({ negotiable: !draft.negotiable })}
          />
        </View>
      </Section>

      {/* Chu nha */}
      <Section title="Khách hàng (chủ nhà)">
        <Field label="Họ tên (*)">
          <TextInput
            style={styles.input}
            value={draft.owner_name}
            onChangeText={(v) => onChangeDraft({ owner_name: v })}
            placeholder="VD: Chị Liên"
          />
        </Field>
        <Field label="Di động (*)">
          <TextInput
            style={[styles.input, phoneDup && styles.inputDuplicate]}
            keyboardType="phone-pad"
            value={draft.contact_phone}
            onChangeText={(v) => onChangeDraft({ contact_phone: v })}
            placeholder="0911.380.022"
          />
          {phoneDup ? (
            <Text style={styles.lsPhoneDupWarn}>
              {phoneDupServer > 0
                ? `⚠ SĐT đã có ${phoneDupServer} tin trong hệ thống`
                : "⚠ SĐT đã có trong hệ thống"}
            </Text>
          ) : null}
        </Field>
      </Section>

      {/* Tieu de & dien giai */}
      <Section title="Tiêu đề & diễn giải">
        <Field label="Tiêu đề (tự tạo nếu bỏ trống)">
          <TextInput
            style={styles.input}
            value={draft.title}
            onChangeText={(v) => onChangeDraft({ title: v })}
            placeholder="VD: Nhà mặt tiền Nguyễn Trãi Q.5"
          />
        </Field>
        <Field label="Diễn giải">
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft.description ?? ""}
            onChangeText={(v) => onChangeDraft({ description: v })}
            placeholder="Mô tả chi tiết căn nhà..."
          />
        </Field>
        <Field label="Ghi chú ban đầu">
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft.note ?? ""}
            onChangeText={(v) => onChangeDraft({ note: v })}
            placeholder="Ghi chú nội bộ khi nhập nhà"
          />
        </Field>
      </Section>

      <View style={styles.submitPanel}>
        <Pressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          disabled={submitting}
          onPress={() => void submit()}
        >
          <Feather name="send" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>{submitting ? "Đang gửi..." : "Lưu vào HomeApp"}</Text>
        </Pressable>
        <Text style={styles.submitPanelDescription}>Trạng thái mặc định: Chờ duyệt</Text>
      </View>
    </ScrollView>
  );
}
