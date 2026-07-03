import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { fetchEmployees } from "../api";
import { styles } from "../styles";
import { EmployeeSummary } from "../types";
import { cleanDisplayText, normalizeApiError } from "../utils";

export function EmployeesScreen({ token }: { token: string }) {
  const [keyword, setKeyword] = useState("");
  const [items, setItems] = useState<EmployeeSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);

  const load = useCallback(
    async (kw: string, page: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const res = await fetchEmployees(token, kw, page, 50);
        setTotal(res.total);
        setItems((prev) => {
          if (!append) return res.items;
          const seen = new Set(prev.map((i) => i.manv));
          return [...prev, ...res.items.filter((i) => !seen.has(i.manv))];
        });
        pageRef.current = page;
      } catch (error) {
        Alert.alert("Không tải được nhân viên", normalizeApiError(error));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [token]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void load(keyword, 1, false);
    }, 450);
    return () => clearTimeout(timer);
  }, [keyword, load]);

  const showEmployee = (item: EmployeeSummary) => {
    const lines = [
      item.code ? `Mã số: ${item.code}` : "",
      item.department ? `Phòng ban: ${cleanDisplayText(item.department)}` : "",
      item.role_name ? `Chức vụ: ${cleanDisplayText(item.role_name)}` : "",
      item.phone ? `SĐT: ${item.phone}` : "Chưa có SĐT",
      item.email ? `Email: ${item.email}` : "",
      item.locked ? "⚠ Tài khoản đã khoá" : "",
    ].filter(Boolean);
    Alert.alert(
      cleanDisplayText(item.full_name),
      lines.join("\n"),
      item.phone
        ? [
            {
              text: "Copy SĐT",
              onPress: () => {
                void Clipboard.setStringAsync(item.phone ?? "");
              },
            },
            { text: "Đóng", style: "cancel" },
          ]
        : [{ text: "Đóng", style: "cancel" }]
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.khSearchWrap}>
        <Feather name="search" size={16} color="#6B7FA3" />
        <TextInput
          style={styles.khSearchInput}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="Tìm theo tên, mã số hoặc SĐT..."
          autoCorrect={false}
        />
        {loading ? <ActivityIndicator size="small" color="#F37021" /> : null}
      </View>
      <Text style={styles.khTotal}>
        {total.toLocaleString("vi-VN")} nhân viên{keyword.trim() ? " khớp tìm kiếm" : ""}
      </Text>
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.manv)}
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
          <Pressable style={styles.khCard} onPress={() => showEmployee(item)}>
            <View style={[styles.khAvatarSmall, item.locked && { backgroundColor: "#94A3B8" }]}>
              <Text style={styles.khAvatarText}>
                {cleanDisplayText(item.full_name).slice(0, 1).toUpperCase() || "N"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.khName} numberOfLines={1}>
                {cleanDisplayText(item.full_name)}
                {item.locked ? "  (khoá)" : ""}
              </Text>
              <Text style={styles.khMeta} numberOfLines={1}>
                {[item.code, cleanDisplayText(item.department ?? "") || null].filter(Boolean).join(" · ")}
              </Text>
            </View>
            {item.phone ? (
              <View style={styles.khBadge}>
                <Text style={styles.khBadgeText}>{item.phone}</Text>
              </View>
            ) : null}
            <Feather name="chevron-right" size={16} color="#94A3B8" />
          </Pressable>
        )}
      />
    </View>
  );
}
