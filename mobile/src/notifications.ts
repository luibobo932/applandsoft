import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const CALL_LOGS_CHANNEL_ID = "call-logs";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(CALL_LOGS_CHANNEL_ID, {
    name: "Lượt gọi SĐT",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#F37021",
    sound: "default",
  });
}

export async function registerForCallLogPushAsync(): Promise<string | null> {
  try {
    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let finalStatus = existing.status;
    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }
    if (finalStatus !== "granted") {
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      return null;
    }

    const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenResponse.data;
  } catch {
    return null;
  }
}
