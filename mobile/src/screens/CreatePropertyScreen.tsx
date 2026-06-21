import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Field, Section, SelectField } from "../components/shared";
import { styles } from "../styles";
import { normalizeApiError, parseNumberInput } from "../utils";
import { createProperty } from "../api";
import { LookupCollections, PropertyCreatePayload } from "../types";

const CREATE_DRAFT_KEY = "landsoft_mobile_create_draft";

export const emptyDraft: PropertyCreatePayload = {
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
  legal_status_code: "",
  direction_code: "",
  grade_code: "",
  description: "",
  note: "",
  listing_type: "ban",
};

export function CreatePropertyScreen({
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
    () => lookups.wards.filter((w) => !draft.district_code || w.parent_code === draft.district_code),
    [draft.district_code, lookups.wards]
  );

  const readyChecks = [
    { label: "Vị trí", done: Boolean(draft.district_code && draft.ward_code) },
    { label: "Giá", done: Boolean(draft.price && draft.price > 0) },
    { label: "Chủ nhà", done: Boolean(draft.owner_name?.trim() && draft.contact_phone?.trim()) },
  ];

  const validate = (): string | null => {
    if (!draft.address?.trim()) return "Thiếu địa chỉ (số nhà, đường)";
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
    // Auto-set status to "Chờ duyệt" — find by label, fallback to code "2"
    const finalDraft = { ...draft };
    const choDouyetStatus = lookups.statuses.find(
      (s) => s.label.toLowerCase().includes("duy") || s.label.toLowerCase().includes("chờ")
    );
    finalDraft.status_code = choDouyetStatus?.code ?? lookups.statuses[0]?.code ?? "2";

    // Auto-generate title if empty
    if (!finalDraft.title?.trim()) {
      const parts = [
        finalDraft.address,
        finalDraft.district_code ? lookups.districts.find(d => d.code === finalDraft.district_code)?.label : null,
      ].filter(Boolean);
      finalDraft.title = parts.join(", ");
    }
    setSubmitting(true);
    try {
      const result = await createProperty(token, finalDraft);
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
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

      {/* Status chips */}
      <View style={styles.createReadyRow}>
        {readyChecks.map((item) => (
          <View key={item.label} style={[styles.createReadyChip, item.done && styles.createReadyChipDone]}>
            <Feather name={item.done ? "check-circle" : "circle"} size={12} color={item.done ? "#16A34A" : "#94A3B8"} />
            <Text style={[styles.createReadyChipText, item.done && styles.createReadyChipTextDone]}>{item.label}</Text>
          </View>
        ))}
        {savingDraft ? (
          <Text style={styles.createSavingText}>Đang lưu...</Text>
        ) : null}
      </View>

      {/* SECTION: Loại tin */}
      <Section title="Loại tin">
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
        {(lookups.grades?.length ?? 0) > 0 ? (
          <SelectField
            label="Cấp độ"
            value={draft.grade_code ?? ""}
            items={lookups.grades}
            onChange={(v) => onChangeDraft({ grade_code: v })}
            emptyLabel="Chưa chọn"
          />
        ) : null}
        <SelectField
          label="Nguồn tin"
          value={draft.source_code}
          items={lookups.sources}
          onChange={(v) => onChangeDraft({ source_code: v })}
          emptyLabel="Chọn nguồn tin"
        />
      </Section>

      {/* SECTION: Vị trí */}
      <Section title="Vị trí">
        <SelectField
          label="Quận"
          value={draft.district_code}
          items={lookups.districts}
          onChange={(v) => onChangeDraft({ district_code: v, ward_code: "" })}
          emptyLabel="Chọn quận"
        />
        <SelectField
          label="Phường"
          value={draft.ward_code}
          items={wardOptions}
          onChange={(v) => onChangeDraft({ ward_code: v })}
          emptyLabel="Chọn phường"
        />
        <Field label="Tên đường">
          <TextInput
            style={styles.input}
            value={draft.street_name ?? ""}
            onChangeText={(v) => onChangeDraft({ street_name: v })}
            placeholder="Ví dụ: An Bình"
            returnKeyType="next"
          />
        </Field>
        <Field label="Số nhà / Địa chỉ">
          <TextInput
            style={styles.input}
            value={draft.address}
            onChangeText={(v) => onChangeDraft({ address: v })}
            placeholder="Ví dụ: 172 An Bình"
            returnKeyType="next"
          />
        </Field>
      </Section>

      {/* SECTION: Nhà */}
      <Section title="Nhà">
        <SelectField
          label="Loại BĐS"
          value={draft.property_type_code}
          items={lookups.property_types}
          onChange={(v) => onChangeDraft({ property_type_code: v })}
          emptyLabel="Chọn loại nhà"
        />
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
      </Section>

      {/* SECTION: Giá & Kích thước */}
      <Section title="Giá & Kích thước">
        <Field label="Giá bán (tỷ)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.price ? String(draft.price) : ""}
            onChangeText={(v) => onChangeDraft({ price: parseNumberInput(v) })}
            placeholder="Ví dụ: 25"
            returnKeyType="next"
          />
        </Field>
        <Field label="Diện tích KV (m²)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.area ? String(draft.area) : ""}
            onChangeText={(v) => onChangeDraft({ area: parseNumberInput(v) })}
            placeholder="Ví dụ: 50"
            returnKeyType="next"
          />
        </Field>
        <View style={styles.createDimsRow}>
          <View style={styles.createDimsField}>
            <Text style={styles.fieldLabel}>Ngang KV (m)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={draft.width ? String(draft.width) : ""}
              onChangeText={(v) => onChangeDraft({ width: parseNumberInput(v) })}
              placeholder="5"
              returnKeyType="next"
            />
          </View>
          <Text style={styles.createDimsSep}>×</Text>
          <View style={styles.createDimsField}>
            <Text style={styles.fieldLabel}>Dài KV (m)</Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={draft.length ? String(draft.length) : ""}
              onChangeText={(v) => onChangeDraft({ length: parseNumberInput(v) })}
              placeholder="10"
              returnKeyType="next"
            />
          </View>
        </View>
      </Section>

      {/* SECTION: Chủ nhà */}
      <Section title="Chủ nhà">
        <Field label="Họ tên chủ (*)">
          <TextInput
            style={styles.input}
            value={draft.owner_name}
            onChangeText={(v) => onChangeDraft({ owner_name: v })}
            placeholder="Ví dụ: Chị Liên"
            returnKeyType="next"
          />
        </Field>
        <Field label="Di động (*)">
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            value={draft.contact_phone}
            onChangeText={(v) => onChangeDraft({ contact_phone: v })}
            placeholder="0911.380.022"
            returnKeyType="next"
          />
        </Field>
      </Section>

      {/* SECTION: Mô tả */}
      <Section title="Mô tả">
        <Field label="Tiêu đề (tự tạo nếu bỏ trống)">
          <TextInput
            style={styles.input}
            value={draft.title}
            onChangeText={(v) => onChangeDraft({ title: v })}
            placeholder="Ví dụ: Nhà mặt tiền An Bình, Q.5"
            returnKeyType="next"
          />
        </Field>
        <Field label="Diễn giải">
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft.description ?? ""}
            onChangeText={(v) => onChangeDraft({ description: v })}
            placeholder="Nhà đẹp, giá tốt..."
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

      {/* Submit */}
      <View style={styles.submitPanel}>
        <Pressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          disabled={submitting}
          onPress={() => void submit()}
        >
          <Feather name="send" size={16} color="#fff" />
          <Text style={styles.primaryButtonText}>{submitting ? "Đang gửi..." : "Đẩy vào Landsoft"}</Text>
        </Pressable>
        <Text style={styles.submitPanelDescription}>Draft tự lưu trên máy khi mạng chập chờn</Text>
      </View>

    </ScrollView>
  );
}
