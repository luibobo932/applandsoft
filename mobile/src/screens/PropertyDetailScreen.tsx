import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { DetailInfoRow, Section, SelectField } from "../components/shared";
import { styles } from "../styles";
import {
  cleanDisplayText,
  formatArea,
  formatDateTime,
  formatMoney,
  getStatusTone,
  normalizeApiError,
  splitAddress,
} from "../utils";
import {
  addPropertyNote,
  fetchPropertyDetail,
  updatePropertyStatus,
} from "../api";
import { LookupCollections, PropertyDetail } from "../types";

export function PropertyDetailScreen({
  token,
  propertyId,
  lookups,
  onBack,
  onChanged,
}: {
  token: string;
  propertyId: number;
  lookups: LookupCollections;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusCode, setStatusCode] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await fetchPropertyDetail(token, propertyId);
      setProperty(detail);
      setStatusCode(detail.status_code ?? "");
    } catch (error) {
      Alert.alert("Không tải được chi tiết", normalizeApiError(error));
    } finally {
      setLoading(false);
    }
  }, [propertyId, token]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const copySummary = async () => {
    if (!property) {
      return;
    }
    const lines = [
      property.code,
      cleanDisplayText(property.title, ""),
      cleanDisplayText(property.address, ""),
      `${formatMoney(property.price)} • ${formatArea(property.area)}`,
      cleanDisplayText(property.description, ""),
      `Liên hệ: ${property.owner_name ?? "-"} - ${property.contact_phone ?? "-"}`,
    ];
    await Clipboard.setStringAsync(lines.filter(Boolean).join("\n"));
    Alert.alert("Đã copy", "Thông tin căn đã được copy.");
  };

  const makePhoneCall = async () => {
    if (!property?.contact_phone) {
      Alert.alert("Thiếu số điện thoại", "Căn này chưa có số liên hệ.");
      return;
    }
    const url = `tel:${property.contact_phone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Không gọi được", "Thiết bị này không mở được màn hình gọi.");
      return;
    }
    await Linking.openURL(url);
  };

  const submitStatus = async () => {
    if (!statusCode) {
      Alert.alert("Thiếu trạng thái", "Chọn trạng thái trước khi cập nhật.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await updatePropertyStatus(token, propertyId, statusCode);
      Alert.alert("Đã cập nhật", result.message);
      await loadDetail();
      await onChanged();
    } catch (error) {
      Alert.alert("Cập nhật thất bại", normalizeApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitNote = async () => {
    if (!note.trim()) {
      Alert.alert("Thiếu ghi chú", "Nhập nội dung ghi chú trước.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await addPropertyNote(token, propertyId, note.trim());
      setNote("");
      Alert.alert("Đã thêm ghi chú", result.message);
      await loadDetail();
      await onChanged();
    } catch (error) {
      Alert.alert("Thêm ghi chú thất bại", normalizeApiError(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.screenCenter}>
        <ActivityIndicator size="large" color="#0f766e" />
      </View>
    );
  }

  if (!property) {
    return (
      <View style={styles.screenCenter}>
        <Text style={styles.emptyStateText}>Không tìm thấy căn.</Text>
        <Pressable style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>Quay lại</Text>
        </Pressable>
      </View>
    );
  }

  const statusTone = getStatusTone(property.status_name);
  const locationLine = [cleanDisplayText(property.district_name, ""), cleanDisplayText(property.ward_name, "")]
    .filter(Boolean)
    .join(" • ");
  const detailAddressParts = splitAddress(property.address);
  const detailFacts = [
    { icon: "map-pin" as const, label: "Khu vực", value: cleanDisplayText(property.district_name, "Chưa rõ") },
    { icon: "layers" as const, label: "Phường", value: cleanDisplayText(property.ward_name, "Chưa rõ") },
    { icon: "home" as const, label: "Loại nhà", value: cleanDisplayText(property.property_type_name, "Chưa rõ") },
    { icon: "bookmark" as const, label: "Trạng thái", value: cleanDisplayText(property.status_name, "Chưa rõ") },
    { icon: "shield" as const, label: "Pháp lý", value: cleanDisplayText(property.legal_status_name, "Chưa rõ") },
    { icon: "compass" as const, label: "Hướng", value: cleanDisplayText(property.direction_name, "Chưa rõ") },
    { icon: "user" as const, label: "Chủ nhà", value: cleanDisplayText(property.owner_name, "Chưa rõ") },
    { icon: "phone" as const, label: "Điện thoại", value: cleanDisplayText(property.contact_phone, "Chưa rõ") },
    { icon: "radio" as const, label: "Nguồn tin", value: cleanDisplayText(property.source_name, "Chưa rõ") },
    { icon: "map" as const, label: "Địa chỉ", value: cleanDisplayText(property.address, "Chưa rõ") },
    { icon: "user-plus" as const, label: "Người nhập", value: cleanDisplayText(property.created_by, "Chưa rõ") },
    { icon: "calendar" as const, label: "Ngày nhập", value: formatDateTime(property.created_at) || "Chưa rõ" },
  ];

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.detailTopBar}>
        <Pressable style={styles.detailNavButton} onPress={onBack}>
          <Feather name="arrow-left" size={20} color="#17305D" />
          <Text style={styles.detailNavButtonText}>Kho hàng</Text>
        </Pressable>
        <View style={styles.detailTopBarActions}>
          <Pressable style={styles.detailTopIconButton} onPress={() => void copySummary()}>
            <Feather name="copy" size={18} color="#17305D" />
          </Pressable>
          <Pressable style={styles.detailTopIconButtonPrimary} onPress={() => void makePhoneCall()}>
            <Feather name="phone" size={18} color="#ffffff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.detailHeroCard}>
        <View style={styles.detailHeroTop}>
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
              {cleanDisplayText(property.status_name, "Chưa rõ")}
            </Text>
          </View>
          <View style={styles.propertyCodePill}>
            <Text style={styles.propertyCode}>{property.code}</Text>
          </View>
        </View>
        <View style={styles.detailHeroMedia}>
          <View style={styles.detailHeroMediaIconWrap}>
            <Feather name="home" size={40} color="#96A6C0" />
          </View>
          <Text style={styles.detailHeroMediaLabel}>Chưa có ảnh</Text>
        </View>
      </View>

      <View style={styles.detailSummaryCard}>
        <Text style={styles.detailTitle}>{cleanDisplayText(property.title, "Chưa có tiêu đề")}</Text>
        <Text style={styles.detailAddressPrimary}>{detailAddressParts.primary}</Text>
        {detailAddressParts.secondary ? (
          <Text style={styles.detailAddressSecondary}>{detailAddressParts.secondary}</Text>
        ) : null}
        <Text style={styles.detailLocation}>{locationLine || "Chưa rõ khu vực"}</Text>
        <View style={styles.detailHeroMetaRow}>
          <Text style={styles.detailPrice}>{formatMoney(property.price)}</Text>
          <Text style={styles.detailArea}>{formatArea(property.area)}</Text>
        </View>
        <View style={styles.detailChipRow}>
          <View style={styles.detailChip}>
            <Text style={styles.detailChipText}>{cleanDisplayText(property.property_type_name, "Chưa rõ loại nhà")}</Text>
          </View>
          <View style={styles.detailChip}>
            <Text style={styles.detailChipText}>{cleanDisplayText(property.legal_status_name, "Chưa rõ pháp lý")}</Text>
          </View>
          <View style={styles.detailChip}>
            <Text style={styles.detailChipText}>{cleanDisplayText(property.direction_name, "Chưa rõ hướng")}</Text>
          </View>
        </View>
        <View style={styles.detailActionRow}>
          <Pressable style={styles.detailActionPrimary} onPress={() => void makePhoneCall()}>
            <Feather name="phone-call" size={16} color="#ffffff" />
            <Text style={styles.detailActionPrimaryText}>Gọi ngay</Text>
          </Pressable>
          <Pressable style={styles.detailActionSecondary} onPress={() => void copySummary()}>
            <Feather name="copy" size={16} color="#17305D" />
            <Text style={styles.detailActionSecondaryText}>Copy thông tin</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.detailContactCard}>
        <View style={styles.detailContactHeader}>
          <View style={styles.detailContactBadge}>
            <Feather name="phone" size={16} color="#F37021" />
          </View>
          <View style={styles.detailContactHeaderText}>
            <Text style={styles.detailContactEyebrow}>Liên hệ chủ nhà</Text>
            <Text style={styles.detailContactOwner}>{cleanDisplayText(property.owner_name, "Chưa rõ chủ nhà")}</Text>
          </View>
        </View>
        {/* BUG FIX: tap copies phone number, not the full summary */}
        <Pressable
          style={styles.detailContactNumberWrap}
          onPress={() => void Clipboard.setStringAsync(cleanDisplayText(property.contact_phone, ""))}
        >
          <Text style={styles.detailContactNumber}>{cleanDisplayText(property.contact_phone, "Chưa có số điện thoại")}</Text>
          <Text style={styles.detailContactHint}>Chạm để copy số điện thoại</Text>
        </Pressable>
        <View style={styles.detailContactActions}>
          <Pressable style={styles.detailContactPrimaryButton} onPress={() => void makePhoneCall()}>
            <Feather name="phone-call" size={16} color="#ffffff" />
            <Text style={styles.detailContactPrimaryButtonText}>Gọi số này</Text>
          </Pressable>
          <Pressable
            style={styles.detailContactSecondaryButton}
            onPress={() => void Clipboard.setStringAsync(cleanDisplayText(property.contact_phone, ""))}
          >
            <Feather name="copy" size={16} color="#17305D" />
            <Text style={styles.detailContactSecondaryButtonText}>Copy số</Text>
          </Pressable>
        </View>
      </View>

      <Section title="Thông số">
        {detailFacts.map((item) => (
          <DetailInfoRow key={item.label} icon={item.icon} label={item.label} value={item.value} />
        ))}
      </Section>

      <Section title="Mô tả">
        <Text style={styles.detailDescription}>{cleanDisplayText(property.description, "Không có mô tả.")}</Text>
      </Section>

      <Section title="Cập nhật trạng thái">
        <SelectField
          label="Trạng thái mới"
          value={statusCode}
          items={lookups.statuses}
          onChange={setStatusCode}
          allowEmpty={false}
        />
        <Pressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          disabled={submitting}
          onPress={() => void submitStatus()}
        >
          <Text style={styles.primaryButtonText}>
            {submitting ? "Đang cập nhật..." : "Cập nhật trạng thái"}
          </Text>
        </Pressable>
      </Section>

      <Section title="Ghi chú">
        <View style={styles.fieldBlock}>
          <Text style={styles.fieldLabel}>Nội dung</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            value={note}
            onChangeText={setNote}
            placeholder="Nhập ghi chú mới"
          />
        </View>
        <Pressable
          style={[styles.primaryButton, submitting && styles.buttonDisabled]}
          disabled={submitting}
          onPress={() => void submitNote()}
        >
          <Text style={styles.primaryButtonText}>{submitting ? "Đang lưu..." : "Thêm ghi chú"}</Text>
        </Pressable>
        <View style={styles.notesGroup}>
          {property.notes.length === 0 ? (
            <Text style={styles.emptyStateText}>Chưa có ghi chú.</Text>
          ) : (
            property.notes.map((item) => (
              <View key={item.note_id} style={styles.noteRow}>
                <Text style={styles.noteMeta}>
                  {cleanDisplayText(item.created_by)} • {formatDateTime(item.created_at)}
                </Text>
                <Text style={styles.noteContent}>{cleanDisplayText(item.content)}</Text>
              </View>
            ))
          )}
        </View>
      </Section>
    </ScrollView>
  );
}
