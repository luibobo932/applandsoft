import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { styles } from "../styles";
import {
  cleanDisplayText,
  formatActivityAction,
  formatActivityEntity,
  formatDateTime,
  getActivityTone,
} from "../utils";
import { ActivityItem } from "../types";

export function ActivityScreen({
  items,
  loading,
  onReload,
}: {
  items: ActivityItem[];
  loading: boolean;
  onReload: () => Promise<void>;
}) {
  const latestTime =
    items[0]?.created_at || items[0]?.server_time
      ? formatDateTime(items[0]?.created_at ?? items[0]?.server_time ?? "")
      : "Chưa có dữ liệu";

  return (
    <View style={styles.screen}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => item.id ?? `${item.action}-${item.created_at ?? item.server_time ?? index}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void onReload()} />}
        contentContainerStyle={items.length === 0 ? styles.activityListEmpty : styles.activityListContent}
        ListHeaderComponent={
          <>
            <View style={styles.activityHeroCard}>
              <Text style={styles.formHeroEyebrow}>NHẬT KÝ APP</Text>
              <Text style={styles.formHeroTitle}>Theo dõi các thao tác vừa thực hiện từ điện thoại</Text>
              <Text style={styles.formHeroDescription}>Lần đồng bộ gần nhất: {latestTime}</Text>
              <View style={styles.activityHeroStatsRow}>
                <View style={styles.activityHeroStat}>
                  <Text style={styles.activityHeroStatValue}>{String(items.length)}</Text>
                  <Text style={styles.activityHeroStatLabel}>Bản ghi gần đây</Text>
                </View>
                <Pressable style={styles.secondaryButtonCompact} onPress={() => void onReload()}>
                  <Text style={styles.secondaryButtonText}>{loading ? "Đang tải..." : "Tải lại"}</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderTitle}>Lịch sử thao tác gần đây</Text>
              <Text style={styles.listHeaderCount}>{loading ? "Đang tải..." : String(items.length) + " mục"}</Text>
            </View>
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyStateText}>Chưa có thao tác nào từ app.</Text>}
        renderItem={({ item }) => {
          const resultMessage = cleanDisplayText(item.result_message ?? item.message, "Không có mô tả kết quả");
          const createdAt = item.created_at ?? item.server_time;
          const entityType = item.entity_type ?? item.target_type;
          const activityTone = getActivityTone(resultMessage);

          return (
            <View style={styles.activityRow}>
              <View style={styles.activityRowTop}>
                <Text style={styles.activityAction}>{formatActivityAction(item.action)}</Text>
                <View style={[styles.activityBadge, { backgroundColor: activityTone.backgroundColor }]}>
                  <Text style={[styles.activityBadgeText, { color: activityTone.color }]}>
                    {activityTone.label}
                  </Text>
                </View>
              </View>
              <Text style={styles.activityMeta}>
                {formatActivityEntity(entityType)} • {formatDateTime(createdAt) || "Chưa có thời gian"}
              </Text>
              <Text style={styles.activityResult}>{resultMessage}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}
