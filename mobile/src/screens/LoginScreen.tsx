import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Pressable, SafeAreaView, Text, TextInput, View } from "react-native";

import { Field } from "../components/shared";
import { styles } from "../styles";
import { LoginPayload } from "../types";

export function LoginScreen({
  apiBaseUrlValue,
  showApiSettings,
  loading,
  onChangeApiBaseUrl,
  onUseEmulatorApiBaseUrl,
  onLogin,
}: {
  apiBaseUrlValue: string;
  showApiSettings: boolean;
  loading: boolean;
  onChangeApiBaseUrl: (value: string) => void;
  onUseEmulatorApiBaseUrl: () => void;
  onLogin: (payload: LoginPayload) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={styles.loginScreen}>
      <StatusBar style="dark" />
      <View style={styles.loginPanel}>
        <Text style={styles.loginTitle}>HomeApp</Text>
        <Text style={styles.loginDescription}>
          App Android để xem kho nhà và nhập nhà mới trực tiếp qua hệ thống cloud.
        </Text>
        {showApiSettings ? <Field label="API backend">
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            value={apiBaseUrlValue}
            onChangeText={onChangeApiBaseUrl}
            placeholder="https://.../api/v1"
          />
          <View style={styles.apiPresetRow}>
            <Pressable style={styles.apiPresetButtonPrimary} onPress={onUseEmulatorApiBaseUrl}>
              <Feather name="monitor" size={15} color="#17305D" />
              <Text style={styles.apiPresetButtonPrimaryText}>Máy này</Text>
            </Pressable>
            <View style={styles.apiPresetHint}>
              <Feather name="info" size={14} color="#7C8BA1" />
              <Text style={styles.apiPresetHintText}>
                Nếu đang test trên emulator Android, bấm nút này để dùng backend đang chạy trên laptop.
              </Text>
            </View>
          </View>
        </Field> : null}
        <Field label="Tên đăng nhập">
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            placeholder="Nhập username"
          />
        </Field>
        <Field label="Mật khẩu">
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Nhập mật khẩu"
          />
        </Field>
        <Pressable
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          disabled={loading}
          onPress={() => onLogin({ username: username.trim(), password })}
        >
          <Text style={styles.primaryButtonText}>{loading ? "Đang đăng nhập..." : "Đăng nhập"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
