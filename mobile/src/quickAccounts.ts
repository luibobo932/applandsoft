// Danh sach tai khoan de chuyen nhanh trong menu 3 gach.
// Cau hinh o file .env (KHONG commit len GitHub), bien EXPO_PUBLIC_QUICK_ACCOUNTS:
//   [{"username":"NV-215","password":"6","label":"Nguyễn Tuấn Dũng"}, ...]
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

// So sanh tai khoan dang dung — Landsoft tra ve landsoft_username (VD "SKL-473")
export function isSameAccount(username: string | null | undefined, account: QuickAccount): boolean {
  return (username ?? "").trim().toLowerCase() === account.username.toLowerCase();
}
