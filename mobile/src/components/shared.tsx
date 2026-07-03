import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { Pressable, Text, View } from "react-native";

import { styles } from "../styles";
import { cleanDisplayText, getInitials } from "../utils";
import { CurrentUser, LookupItem } from "../types";

export type LandsoftView =
  | "workspace"
  | "properties"
  | "create"
  | "activity"
  | "callLogs"
  | "customers"
  | "employees"
  | "kingland";

export function AppHeader({
  user,
  title,
  onLogout,
}: {
  user: CurrentUser;
  title: string;
  onLogout: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTextGroup}>
        <Text style={styles.headerEyebrow}>{cleanDisplayText(user.role_name || "HomeApp")}</Text>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSubtitle}>
          {cleanDisplayText(user.display_name)} • {cleanDisplayText(user.landsoft_username ?? user.username)}
        </Text>
      </View>
      <View style={styles.headerActions}>
        <View style={styles.userPill}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{getInitials(user.display_name)}</Text>
          </View>
          <View style={styles.userPillTextGroup}>
            <Text style={styles.userPillName}>{cleanDisplayText(user.landsoft_username ?? user.username)}</Text>
            <Text style={styles.userPillRole}>{cleanDisplayText(user.role_name || "Môi giới")}</Text>
          </View>
        </View>
        <Pressable style={styles.logoutPill} onPress={onLogout}>
          <Feather name="log-out" size={14} color="#17305D" />
          <Text style={styles.logoutPillText}>Đăng xuất</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function LandsoftNavBar({
  activeTab,
  onChange,
}: {
  activeTab: LandsoftView;
  onChange: (tab: LandsoftView) => void;
}) {
  const tabs: Array<{ key: LandsoftView; label: string; icon: React.ComponentProps<typeof Feather>["name"] }> = [
    { key: "workspace", label: "HomeApp", icon: "grid" },
    { key: "kingland", label: "King Land", icon: "monitor" },
    { key: "properties", label: "Kho hàng", icon: "home" },
    { key: "create", label: "Nhập nhà", icon: "plus-circle" },
    { key: "callLogs", label: "Gọi SĐT", icon: "phone-call" },
    { key: "activity", label: "Gần đây", icon: "clock" },
  ];

  return (
    <View style={styles.tabBar}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
          onPress={() => onChange(tab.key)}
        >
          <Feather
            name={tab.icon}
            size={18}
            color={activeTab === tab.key ? "#ffffff" : "#64748B"}
            style={styles.tabButtonIcon}
          />
          <Text style={[styles.tabButtonText, activeTab === tab.key && styles.tabButtonTextActive]}>
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function DetailInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailInfoRow}>
      <View style={styles.detailInfoLeft}>
        <View style={styles.detailInfoIconWrap}>
          <Feather name={icon} size={16} color="#F37021" />
        </View>
        <Text style={styles.detailInfoLabel}>{label}</Text>
      </View>
      <Text style={styles.detailInfoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export function SelectField({
  label,
  value,
  items,
  onChange,
  allowEmpty = true,
  emptyLabel = "Chọn",
}: {
  label: string;
  value?: string;
  items: LookupItem[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
}) {
  return (
    <Field label={label}>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={value ?? ""} onValueChange={(selected) => onChange(String(selected ?? ""))}>
          {allowEmpty ? <Picker.Item label={emptyLabel} value="" /> : null}
          {items.map((item) => (
            <Picker.Item key={item.code} label={cleanDisplayText(item.label, item.code)} value={item.code} />
          ))}
        </Picker>
      </View>
    </Field>
  );
}
