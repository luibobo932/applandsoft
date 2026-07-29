// Tai khoan cau hinh san (file .env, bien EXPO_PUBLIC_QUICK_ACCOUNTS):
//   [{"username":"SKL-473","password":"1","label":"Trần Đăng Duy"}, ...]
//
// Muc dich: mo app la vao thang tai khoan, va doi qua lai trong menu 3 gach.
// LUU Y: mat khau nam trong file APK -> chi gui APK cho chinh minh.
export type QuickAccount = {
  username: string;
  password: string;
  label: string;
};

function parseQuickAccounts(): QuickAccount[] {
  const raw = process.env.EXPO_PUBLIC_QUICK_ACCOUNTS?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item.username === "string" && typeof item.password === "string")
      .map((item) => ({
        username: String(item.username).trim(),
        password: String(item.password),
        label: String(item.label ?? item.username).trim(),
      }));
  } catch {
    return [];
  }
}

export const QUICK_ACCOUNTS: QuickAccount[] = parseQuickAccounts();

export function findQuickAccount(username: string | null | undefined): QuickAccount | undefined {
  const key = (username ?? "").trim().toLowerCase();
  return QUICK_ACCOUNTS.find((a) => a.username.toLowerCase() === key);
}
