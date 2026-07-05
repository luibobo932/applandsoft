import { Feather } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
import { Modal, Pressable, Text, View } from "react-native";

import { styles } from "../styles";
import { cleanDisplayText } from "../utils";
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

// Header gon: chi hamburger + tieu de. Thong tin user va nut Dang xuat da doi
// vao menu 3 gach -> mo app la thay ngay danh sach nha, khong bi che tam nhin.
export function AppHeader({
  title,
  onMenu,
}: {
  user: CurrentUser;
  title: string;
  onLogout: () => void;
  onMenu?: () => void;
}) {
  return (
    <View style={styles.headerCompact}>
      {onMenu ? (
        <Pressable style={styles.menuButton} onPress={onMenu}>
          <Feather name="menu" size={22} color="#17305D" />
        </Pressable>
      ) : null}
      <Text style={styles.headerCompactTitle} numberOfLines={1}>
        {title}
      </Text>
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

// Menu 3 gach ben hong: cac chuc nang gom vao drawer truot ra
export function LandsoftDrawer({
  visible,
  activeTab,
  user,
  onChange,
  onClose,
  onLogout,
}: {
  visible: boolean;
  activeTab: LandsoftView;
  user: CurrentUser;
  onChange: (tab: LandsoftView) => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  const items: Array<{ key: LandsoftView; label: string; icon: React.ComponentProps<typeof Feather>["name"] }> = [
    { key: "workspace", label: "HomeApp", icon: "grid" },
    { key: "kingland", label: "King Land", icon: "monitor" },
    { key: "properties", label: "Kho hàng", icon: "home" },
    { key: "create", label: "Nhập nhà", icon: "plus-circle" },
    { key: "callLogs", label: "Theo dõi gọi SĐT", icon: "phone-call" },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerBackdrop}>
        <View style={styles.drawerPanel}>
          <View style={styles.drawerHeader}>
            <Text style={styles.drawerBrand}>KING LAND · HOMEAPP</Text>
            <Text style={styles.drawerUser}>{cleanDisplayText(user.display_name)}</Text>
            <Text style={styles.drawerRole}>
              {cleanDisplayText(user.role_name || "Môi giới")} · {cleanDisplayText(user.landsoft_username ?? user.username)}
            </Text>
          </View>
          {items.map((item) => {
            const active = activeTab === item.key;
            return (
              <Pressable
                key={item.key}
                style={[styles.drawerItem, active && styles.drawerItemActive]}
                onPress={() => onChange(item.key)}
              >
                <Feather name={item.icon} size={19} color={active ? "#15428B" : "#5B6B85"} />
                <Text style={[styles.drawerItemText, active && styles.drawerItemTextActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
          <Pressable style={styles.drawerLogout} onPress={onLogout}>
            <Feather name="log-out" size={19} color="#C0392B" />
            <Text style={[styles.drawerItemText, { color: "#C0392B" }]}>Đăng xuất</Text>
          </Pressable>
        </View>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </View>
    </Modal>
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
