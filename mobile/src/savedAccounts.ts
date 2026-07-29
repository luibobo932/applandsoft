// Danh sach tai khoan da dang nhap tren MAY NAY — de chuyen nhanh khong can go lai.
//
// AN TOAN: KHONG co mat khau nao nam trong file APK. Moi thu luu trong AsyncStorage
// (vung du lieu rieng cua app tren dien thoai, khong di theo file APK chia se qua Zalo).
// Lan dau moi tai khoan phai dang nhap 1 lan; sau do app nho phien (token) de doi tuc thi.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { CurrentUser } from "./types";

const SAVED_ACCOUNTS_KEY = "landsoft_saved_accounts";

export type SavedAccount = {
  username: string;
  displayName: string;
  roleName?: string;
  token: string;
  /** Luu de tu dang nhap lai khi token het han (12h). Chi nam tren may, khong vao APK. */
  password?: string;
  savedAt: string;
};

export async function loadSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((a) => a && typeof a.username === "string") : [];
  } catch {
    return [];
  }
}

async function writeAccounts(accounts: SavedAccount[]): Promise<void> {
  await AsyncStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
}

/** Them hoac cap nhat 1 tai khoan sau khi dang nhap thanh cong. */
export async function rememberAccount(
  user: CurrentUser,
  token: string,
  password?: string
): Promise<SavedAccount[]> {
  const username = (user.landsoft_username ?? user.username ?? "").trim();
  if (!username) return loadSavedAccounts();

  const accounts = await loadSavedAccounts();
  const existing = accounts.find((a) => sameUser(a.username, username));
  const entry: SavedAccount = {
    username,
    displayName: (user.display_name || username).trim(),
    roleName: user.role_name ?? undefined,
    token,
    // Giu mat khau cu neu lan nay khong truyen vao (VD doi bang token con han)
    password: password ?? existing?.password,
    savedAt: new Date().toISOString(),
  };
  const next = [entry, ...accounts.filter((a) => !sameUser(a.username, username))];
  await writeAccounts(next);
  return next;
}

/** Cap nhat token moi cho tai khoan (sau khi tu dang nhap lai). */
export async function updateAccountToken(username: string, token: string): Promise<SavedAccount[]> {
  const accounts = await loadSavedAccounts();
  const next = accounts.map((a) =>
    sameUser(a.username, username) ? { ...a, token, savedAt: new Date().toISOString() } : a
  );
  await writeAccounts(next);
  return next;
}

/**
 * Nap san cac tai khoan cau hinh trong .env vao danh sach, de menu 3 gach hien
 * ca 2 tai khoan ngay lan mo app dau tien (chua tung dang nhap tay).
 * Giu nguyen token/ten hien thi neu tai khoan do da co san.
 */
export async function seedAccounts(
  configs: { username: string; password: string; label: string }[]
): Promise<SavedAccount[]> {
  if (configs.length === 0) return loadSavedAccounts();
  const accounts = await loadSavedAccounts();
  let changed = false;

  for (const cfg of configs) {
    const existing = accounts.find((a) => sameUser(a.username, cfg.username));
    if (!existing) {
      accounts.push({
        username: cfg.username,
        displayName: cfg.label,
        token: "",
        password: cfg.password,
        savedAt: new Date().toISOString(),
      });
      changed = true;
    } else if (existing.password !== cfg.password) {
      // Mat khau trong cau hinh moi hon -> cap nhat
      existing.password = cfg.password;
      changed = true;
    }
  }

  if (changed) await writeAccounts(accounts);
  return accounts;
}

export async function forgetAccount(username: string): Promise<SavedAccount[]> {
  const accounts = await loadSavedAccounts();
  const next = accounts.filter((a) => !sameUser(a.username, username));
  await writeAccounts(next);
  return next;
}

export function sameUser(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}
