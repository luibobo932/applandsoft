// Phien ban dang chay — hien trong menu 3 gach de biet may nhan vien dang dung ban nao.
//
// Lay THANG tu goi APK da cai (versionName + versionCode), khong phai tu app.json,
// nen con so hien tren man hinh luon dung bang con so Android dung de so sanh ban moi/cu.
// GitHub Actions truyen -PappVersionName=1.1.<so lan build> -PappVersionCode=<so lan build+100>.
import * as Application from "expo-application";
import Constants from "expo-constants";

function resolveAppVersion(): string {
  const name = Application.nativeApplicationVersion;
  const build = Application.nativeBuildVersion;
  if (name && build) {
    return `${name} (build ${build})`;
  }
  if (name) {
    return name;
  }
  // Chay tren Expo Go / web: chua co goi native nao de doc
  return `${Constants.expoConfig?.version ?? "1.0.0"} (dev)`;
}

export const APP_VERSION: string = resolveAppVersion();
