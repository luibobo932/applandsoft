import { Feather } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";

import { LandsoftView } from "../components/shared";
import { styles } from "../styles";
import { CurrentUser } from "../types";
import { cleanDisplayText, formatCount } from "../utils";

type ModuleItem = {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  target?: LandsoftView;
};

const moduleGroups: Array<{ title: string; items: ModuleItem[] }> = [
  {
    title: "Giao dịch bất động sản",
    items: [
      { key: "properties", label: "Sản phẩm bán, cho thuê", description: "Kho nhà, tìm kiếm, bộ lọc và chi tiết căn", icon: "home", target: "properties" },
      { key: "buyer-needs", label: "Nhu cầu mua, thuê", description: "Quản lý nhu cầu và ghép căn phù hợp", icon: "search" },
      { key: "transactions", label: "Quản lý giao dịch", description: "Theo dõi cọc, công chứng và hoàn tất", icon: "repeat" },
    ],
  },
  {
    title: "Khách hàng & công việc",
    items: [
      { key: "customers", label: "Khách hàng", description: "Danh bạ, lịch sử chăm sóc và nhu cầu", icon: "users" },
      { key: "activity", label: "Lịch sử thực hiện", description: "Các thao tác gần đây trên dữ liệu HomeApp", icon: "clock", target: "activity" },
      { key: "calendar", label: "Lịch làm việc", description: "Lịch hẹn, nhắc gọi và việc cần xử lý", icon: "calendar" },
      { key: "search-all", label: "Tìm kiếm tổng hợp", description: "Tìm xuyên suốt nhà, khách và giao dịch", icon: "crosshair" },
    ],
  },
  {
    title: "Quản trị & tiện ích",
    items: [
      { key: "employees", label: "Nhân viên", description: "Thông tin nhân sự và phân quyền truy cập", icon: "user-check" },
      { key: "documents", label: "Tài liệu", description: "Biểu mẫu, hồ sơ và tài liệu giao dịch", icon: "file-text" },
      { key: "fund", label: "Quỹ", description: "Theo dõi thu chi và công nợ", icon: "credit-card" },
      { key: "other", label: "Khác", description: "Báo cáo, import, export và cấu hình", icon: "grid" },
    ],
  },
];

export function LandsoftWorkspaceScreen({
  user,
  propertyTotal,
  activityCount,
  onOpen,
}: {
  user: CurrentUser;
  propertyTotal: number;
  activityCount: number;
  onOpen: (view: LandsoftView) => void;
}) {
  const openModule = (item: ModuleItem) => {
    if (item.target) {
      onOpen(item.target);
      return;
    }
    Alert.alert(
      item.label,
      "Phân hệ đã được đưa vào giao diện HomeApp. Cần nối API và bảng dữ liệu thật trước khi cho phép sử dụng."
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.workspaceContent}>
      <View style={styles.workspaceHero}>
        <View style={styles.workspaceHeroIcon}>
          <Feather name="briefcase" size={26} color="#ffffff" />
        </View>
        <View style={styles.workspaceHeroText}>
          <Text style={styles.workspaceEyebrow}>KING LAND · HOMEAPP</Text>
          <Text style={styles.workspaceTitle}>Trung tâm điều hành HomeApp</Text>
          <Text style={styles.workspaceDescription}>
            Toàn bộ nghiệp vụ được gom trong HomeApp, tối ưu để thao tác trên điện thoại.
          </Text>
        </View>
      </View>

      <View style={styles.workspaceStats}>
        <Pressable style={styles.workspaceStatCard} onPress={() => onOpen("properties")}>
          <Text style={styles.workspaceStatValue}>{formatCount(propertyTotal)}</Text>
          <Text style={styles.workspaceStatLabel}>Sản phẩm đang hoạt động</Text>
        </Pressable>
        <Pressable style={styles.workspaceStatCard} onPress={() => onOpen("activity")}>
          <Text style={styles.workspaceStatValue}>{formatCount(activityCount)}</Text>
          <Text style={styles.workspaceStatLabel}>Thao tác gần đây</Text>
        </Pressable>
      </View>

      <View style={styles.workspaceUserBanner}>
        <Feather name="user" size={18} color="#F37021" />
        <View style={styles.workspaceUserText}>
          <Text style={styles.workspaceUserName}>{cleanDisplayText(user.display_name)}</Text>
          <Text style={styles.workspaceUserRole}>
            {cleanDisplayText(user.role_name || "Chuyên viên kinh doanh")} · {cleanDisplayText(user.landsoft_username ?? user.username)}
          </Text>
        </View>
      </View>

      {moduleGroups.map((group) => (
        <View key={group.title} style={styles.workspaceGroup}>
          <Text style={styles.workspaceGroupTitle}>{group.title}</Text>
          <View style={styles.workspaceModuleGrid}>
            {group.items.map((item) => {
              const ready = Boolean(item.target);
              return (
                <Pressable
                  key={item.key}
                  style={({ pressed }) => [styles.workspaceModuleCard, pressed && styles.workspaceModuleCardPressed]}
                  onPress={() => openModule(item)}
                >
                  <View style={[styles.workspaceModuleIcon, ready && styles.workspaceModuleIconReady]}>
                    <Feather name={item.icon} size={21} color={ready ? "#F37021" : "#64748B"} />
                  </View>
                  <Text style={styles.workspaceModuleTitle}>{item.label}</Text>
                  <Text style={styles.workspaceModuleDescription}>{item.description}</Text>
                  <View style={styles.workspaceModuleFooter}>
                    <Text style={[styles.workspaceModuleStatus, ready && styles.workspaceModuleStatusReady]}>
                      {ready ? "Mở chức năng" : "Đã tạo giao diện"}
                    </Text>
                    <Feather name="chevron-right" size={16} color={ready ? "#F37021" : "#94A3B8"} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
