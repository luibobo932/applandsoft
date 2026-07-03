import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
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

import { fetchCustomerDetail, fetchCustomers } from "../api";
import { styles } from "../styles";
import { CustomerDetail, CustomerSummary } from "../types";
import { cleanDisplayText, normalizeApiError } from "../utils";

function formatPriceTy(price?: number | null): string {
  if (!price) return "";
  const ty = price / 1_000_000_000;
  return ty >= 1 ? `${Math.round(ty * 100) / 100} tỷ` : `${Math.round(price / 1_000_000)} triệu`;
}

export function CustomersScreen({
  token,
  onOpenProperty,
}: {
  token: string;
  onOpenProperty: (landsoftId: number) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<CustomerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const pageRef = useRef(1);

  const load = useCallback(
    async (kw: string, page: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await fetchCustomers(token, kw, page, 30);
        setTotal(res.total);
        setItems((prev) => {
          if (!append) return res.items;
          const seen = new Set(prev.map((i) => i.makh));
          return [...prev, ...res.items.filter((i) => !seen.has(i.makh))];
        });
        pageRef.current = page;
      } catch (error) {
        Alert.alert("Không tải được khách hàng", normalizeApiError(error));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token]
  );

  // Live search (debounce 450ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      void load(keyword, 1, false);
    }, 450);
    return () => clearTimeout(timer);
  }, [keyword, load]);

  const openDetail = async (makh: number) => {
    setDetailLoading(true);
    try {
      setDetail(await fetchCustomerDetail(token, makh));
    } catch (error) {
      Alert.alert("Không tải được hồ sơ khách", normalizeApiError(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const copyPhone = (phone?: string | null) => {
    if (!phone) return;
    void Clipboard.setStringAsync(phone);
    Alert.alert("Đã copy số", phone);
  };

  // ===== Chi tiet khach hang =====
  if (detail || detailLoading) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <Pressable style={styles.khBackRow} onPress={() => setDetail(null)}>
          <Feather name="arrow-left" size={18} color="#15428B" />
          <Text style={styles.khBackText}>Danh bạ khách hàng</Text>
        </Pressable>
        {detailLoading || !detail ? (
          <ActivityIndicator size="large" color="#F37021" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.khDetailHero}>
              <View style={styles.khAvatar}>
                <Feather name="user" size={22} color="#ffffff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.khDetailName}>{cleanDisplayText(detail.full_name)}</Text>
                <Text style={styles.khMeta}>
                  Mã KH: {detail.makh}
                  {detail.staff_name ? ` · NV: ${cleanDisplayText(detail.staff_name)}` : ""}
                </Text>
                {detail.registered_at ? (
                  <Text style={styles.khMeta}>Đăng ký: {detail.registered_at}</Text>
                ) : null}
              </View>
            </View>

            {[detail.phone, detail.phone2].filter(Boolean).map((phone) => (
              <Pressable key={String(phone)} style={styles.khPhoneRow} onPress={() => copyPhone(phone)}>
                <Feather name="phone" size={16} color="#F37021" />
                <Text style={styles.khPhoneText}>{phone}</Text>
                <Text style={styles.khPhoneHint}>chạm để copy</Text>
              </Pressable>
            ))}

            {detail.address ? (
              <View style={styles.khInfoRow}>
                <Feather name="map-pin" size={15} color="#6B7FA3" />
                <Text style={styles.khInfoText}>{cleanDisplayText(detail.address)}</Text>
              </View>
            ) : null}
            {detail.email ? (
              <View style={styles.khInfoRow}>
                <Feather name="mail" size={15} color="#6B7FA3" />
                <Text style={styles.khInfoText}>{detail.email}</Text>
              </View>
            ) : null}
            {detail.note_text ? (
              <View style={styles.khNoteBox}>
                <Text style={styles.khNoteText}>{detail.note_text}</Text>
              </View>
            ) : null}

            <Text style={styles.khSectionTitle}>
              Căn đứng tên ({detail.properties.length})
            </Text>
            {detail.properties.length === 0 ? (
              <Text style={styles.khEmpty}>Chưa có căn nào trong hệ thống.</Text>
            ) : (
              detail.properties.map((prop) => (
                <Pressable
                  key={prop.landsoft_id}
                  style={styles.khPropCard}
                  onPress={() => onOpenProperty(prop.landsoft_id)}
                >
                  <Text style={styles.khPropTitle} numberOfLines={2}>
                    {cleanDisplayText(prop.title)}
                  </Text>
                  <Text style={styles.khMeta}>
                    {[
                      prop.district_name,
                      formatPriceTy(prop.price),
                      prop.area ? `${prop.area} m²` : "",
                      prop.status_name,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </Pressable>
              ))
            )}

            {detail.notes.length > 0 ? (
              <>
                <Text style={styles.khSectionTitle}>Ghi chú chăm sóc ({detail.notes.length})</Text>
                {detail.notes.map((note, index) => (
                  <View key={index} style={styles.khNoteBox}>
                    {note.title ? <Text style={styles.khPropTitle}>{note.title}</Text> : null}
                    {note.content ? <Text style={styles.khNoteText}>{note.content}</Text> : null}
                    {note.created_at ? <Text style={styles.khMeta}>{note.created_at}</Text> : null}
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    );
  }

  // ===== Danh sach + tim kiem =====
  return (
    <View style={styles.screen}>
      <View style={styles.khSearchWrap}>
        <Feather name="search" size={16} color="#6B7FA3" />
        <TextInput
          style={styles.khSearchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Tìm theo tên hoặc SĐT khách..."
          autoCorrect={false}
        />
        {loading ? <ActivityIndicator size="small" color="#F37021" /> : null}
      </View>
      <Text style={styles.khTotal}>
        {total.toLocaleString("vi-VN")} khách hàng{keyword.trim() ? " khớp tìm kiếm" : " trong hệ thống"}
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.makh)}
        contentContainerStyle={{ paddingBottom: 24 }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!loading && !loadingMore && items.length < total) {
            void load(keyword, pageRef.current + 1, true);
          }
        }}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator size="small" color="#F37021" style={{ marginVertical: 12 }} /> : null
        }
        renderItem={({ item }) => (
          <Pressable style={styles.khCard} onPress={() => void openDetail(item.makh)}>
            <View style={styles.khAvatarSmall}>
              <Text style={styles.khAvatarText}>
                {cleanDisplayText(item.full_name).slice(0, 1).toUpperCase() || "K"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.khName} numberOfLines={1}>
                {cleanDisplayText(item.full_name)}
              </Text>
              <Text style={styles.khMeta} numberOfLines={1}>
                {[item.phone, item.address].filter(Boolean).join(" · ") || "Chưa có SĐT"}
              </Text>
            </View>
            {item.property_count > 0 ? (
              <View style={styles.khBadge}>
                <Text style={styles.khBadgeText}>{item.property_count} căn</Text>
              </View>
            ) : null}
            <Feather name="chevron-right" size={16} color="#94A3B8" />
          </Pressable>
        )}
      />
    </View>
  );
}
