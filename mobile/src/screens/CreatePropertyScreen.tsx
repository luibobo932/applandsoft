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

const emptyDraft: PropertyCreatePayload = {
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
  floors: 0,
  bedrooms: 0,
  bathrooms: 0,
  legal_status_code: "",
  direction_code: "",
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
    () => lookups.wards.filter((item) => !draft.district_code || item.parent_code === draft.district_code),
    [draft.district_code, lookups.wards]
  );
  const quickChecks = [
    { label: "Khu vực", done: Boolean(draft.district_code && draft.ward_code) },
    { label: "Giá", done: Boolean(draft.price && draft.price > 0) },
    { label: "Liên hệ", done: Boolean(draft.owner_name.trim() && draft.contact_phone.trim()) },
  ];

  const validate = (): string | null => {
    if (!draft.title.trim()) return "Thiếu tiêu đề căn";
    if (!draft.address.trim()) return "Thiếu địa chỉ";
    if (!draft.district_code) return "Thiếu quận";
    if (!draft.ward_code) return "Thiếu phường";
    if (!draft.property_type_code) return "Thiếu loại nhà";
    if (!draft.status_code) return "Thiếu trạng thái";
    if (!draft.source_code) return "Thiếu nguồn tin";
    if (!draft.owner_name.trim()) return "Thiếu tên chủ nhà";
    if (!draft.contact_phone.trim()) return "Thiếu số điện thoại";
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
    setSubmitting(true);
    try {
      const result = await createProperty(token, draft);
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
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.formHeroCard}>
        <Text style={styles.formHeroEyebrow}>NHẬP NHÀ MỚI</Text>
        <Text style={styles.formHeroTitle}>Điền nhanh các thông tin cốt lõi trước khi đẩy vào Landsoft</Text>
        <Text style={styles.formHeroDescription}>
          Form được lưu tạm trên máy. Khi mất mạng, nội dung anh đang nhập vẫn được giữ lại.
        </Text>
        <View style={styles.formHeroChipRow}>
          {quickChecks.map((item) => (
            <View
              key={item.label}
              style={[styles.formHeroChip, item.done ? styles.formHeroChipDone : styles.formHeroChipPending]}
            >
              <Text style={[styles.formHeroChipText, item.done ? styles.formHeroChipTextDone : styles.formHeroChipTextPending]}>
                {item.done ? "Đã có " : "Thiếu "}
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <Section title="Loại giao dịch">
        <View style={styles.listingTypeRow}>
          <Pressable
            style={[styles.listingTypeButton, draft.listing_type === "ban" && styles.listingTypeButtonActive]}
            onPress={() => onChangeDraft({ listing_type: "ban" })}
          >
            <Text style={[styles.listingTypeButtonText, draft.listing_type === "ban" && styles.listingTypeButtonTextActive]}>
              <Feather name="tag" size={14} /> Bán
            </Text>
          </Pressable>
          <Pressable
            style={[styles.listingTypeButton, draft.listing_type === "thue" && styles.listingTypeButtonActive]}
            onPress={() => onChangeDraft({ listing_type: "thue" })}
          >
            <Text style={[styles.listingTypeButtonText, draft.listing_type === "thue" && styles.listingTypeButtonTextActive]}>
              <Feather name="key" size={14} /> Cho thuê
            </Text>
          </Pressable>
        </View>
      </Section>

      <Section title="Thông tin chính">
        <Field label="Tiêu đề">
          <TextInput
            style={styles.input}
            value={draft.title}
            onChangeText={(value) => onChangeDraft({ title: value })}
            placeholder="Ví dụ: Nhà phố Phan Xích Long"
          />
        </Field>
        <Field label="Địa chỉ">
          <TextInput
            style={styles.input}
            value={draft.address}
            onChangeText={(value) => onChangeDraft({ address: value })}
            placeholder="Số nhà, đường, phường..."
          />
        </Field>
        <Field label="Tên đường">
          <TextInput
            style={styles.input}
            value={draft.street_name ?? ""}
            onChangeText={(value) => onChangeDraft({ street_name: value })}
            placeholder="Ví dụ: Nguyễn Đình Chiểu"
          />
        </Field>
        <SelectField
          label="Quận"
          value={draft.district_code}
          items={lookups.districts}
          onChange={(value) => onChangeDraft({ district_code: value, ward_code: "" })}
          allowEmpty={false}
          emptyLabel="Chọn quận"
        />
        <SelectField
          label="Phường"
          value={draft.ward_code}
          items={wardOptions}
          onChange={(value) => onChangeDraft({ ward_code: value })}
          allowEmpty={false}
          emptyLabel="Chọn phường"
        />
        <SelectField
          label="Loại nhà"
          value={draft.property_type_code}
          items={lookups.property_types}
          onChange={(value) => onChangeDraft({ property_type_code: value })}
          allowEmpty={false}
          emptyLabel="Chọn loại nhà"
        />
        <SelectField
          label="Trạng thái"
          value={draft.status_code}
          items={lookups.statuses}
          onChange={(value) => onChangeDraft({ status_code: value })}
          allowEmpty={false}
          emptyLabel="Chọn trạng thái"
        />
      </Section>

      <Section title="Giá và diện tích">
        <Field label="Giá (tỷ)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.price ? String(draft.price) : ""}
            onChangeText={(value) => onChangeDraft({ price: parseNumberInput(value) })}
            placeholder="Ví dụ: 18.5"
          />
        </Field>
        <Field label="Diện tích (m²)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.area ? String(draft.area) : ""}
            onChangeText={(value) => onChangeDraft({ area: parseNumberInput(value) })}
            placeholder="Ví dụ: 72"
          />
        </Field>
        <Field label="Ngang (m)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.width ? String(draft.width) : ""}
            onChangeText={(value) => onChangeDraft({ width: parseNumberInput(value) })}
            placeholder="Ví dụ: 4.2"
          />
        </Field>
        <Field label="Dài (m)">
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            value={draft.length ? String(draft.length) : ""}
            onChangeText={(value) => onChangeDraft({ length: parseNumberInput(value) })}
            placeholder="Ví dụ: 13.1"
          />
        </Field>
      </Section>

      <Section title="Liên hệ">
        <Field label="Tên chủ nhà">
          <TextInput
            style={styles.input}
            value={draft.owner_name}
            onChangeText={(value) => onChangeDraft({ owner_name: value })}
            placeholder="Nhập tên chủ nhà"
          />
        </Field>
        <Field label="Số điện thoại">
          <TextInput
            style={styles.input}
            keyboardType="phone-pad"
            value={draft.contact_phone}
            onChangeText={(value) => onChangeDraft({ contact_phone: value })}
            placeholder="0909..."
          />
        </Field>
        <SelectField
          label="Nguồn tin"
          value={draft.source_code}
          items={lookups.sources}
          onChange={(value) => onChangeDraft({ source_code: value })}
          allowEmpty={false}
          emptyLabel="Chọn nguồn tin"
        />
      </Section>

      <Section title="Bổ sung">
        <Field label="Số tầng">
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={draft.floors ? String(draft.floors) : ""}
            onChangeText={(value) => onChangeDraft({ floors: Math.round(parseNumberInput(value)) })}
            placeholder="Ví dụ: 4"
          />
        </Field>
        <Field label="Phòng ngủ">
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={draft.bedrooms ? String(draft.bedrooms) : ""}
            onChangeText={(value) => onChangeDraft({ bedrooms: Math.round(parseNumberInput(value)) })}
            placeholder="Ví dụ: 3"
          />
        </Field>
        <Field label="Phòng tắm">
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            value={draft.bathrooms ? String(draft.bathrooms) : ""}
            onChangeText={(value) => onChangeDraft({ bathrooms: Math.round(parseNumberInput(value)) })}
            placeholder="Ví dụ: 4"
          />
        </Field>
        <SelectField
          label="Pháp lý"
          value={draft.legal_status_code ?? ""}
          items={lookups.legal_statuses}
          onChange={(value) => onChangeDraft({ legal_status_code: value })}
          emptyLabel="Chưa chọn"
        />
        <SelectField
          label="Hướng"
          value={draft.direction_code ?? ""}
          items={lookups.directions}
          onChange={(value) => onChangeDraft({ direction_code: value })}
          emptyLabel="Chưa chọn"
        />
        <Field label="Mô tả">
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft.description ?? ""}
            onChangeText={(value) => onChangeDraft({ description: value })}
            placeholder="Mô tả nhanh về căn"
          />
        </Field>
        <Field label="Ghi chú ban đầu">
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={draft.note ?? ""}
            onChangeText={(value) => onChangeDraft({ note: value })}
            placeholder="Ghi chú cho căn mới"
          />
        </Field>
      </Section>

      <View style={styles.draftHint}>
        <Text style={styles.draftHintText}>
          {savingDraft ? "Đang lưu draft..." : "Draft form được giữ lại trên máy khi mạng chập chờn."}
        </Text>
      </View>

      <View style={styles.submitPanel}>
        <Text style={styles.submitPanelTitle}>Sẵn sàng đẩy sang Landsoft</Text>
        <Text style={styles.submitPanelDescription}>
          Chỉ gửi khi các thông tin bắt buộc đã đủ. Phần còn lại có thể bổ sung sau trong Landsoft.
        </Text>
        <Pressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          disabled={submitting}
          onPress={() => void submit()}
        >
          <Text style={styles.primaryButtonText}>{submitting ? "Đang gửi..." : "Tạo nhà mới"}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
