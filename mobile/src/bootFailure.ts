// Phan biet "backend chua san sang" voi "backend tu choi minh".
//
// Quan trong vi luc khoi dong app, ket qua phan loai nay quyet dinh co XOA phien va
// tai khoan da nho tren may hay khong. Backend chay tren Render goi re: khong ai dung
// mot luc la may chu ngu, lan goi dau mat 30-50s va trong luc thuc day co the tra
// 502/503. Neu coi do la "bi tu choi" thi nguoi mo app dau tien moi sang se bi da ve
// man dang nhap va mat luon tai khoan da luu.
import { ApiError } from "./api";
import { isConnectivityFailure, normalizeApiError } from "./utils";

export const BOOT_TIMEOUT_MESSAGE = "BOOT_REQUEST_TIMEOUT";

export function isTransientBootFailure(error: unknown): boolean {
  if (error instanceof Error && error.message === BOOT_TIMEOUT_MESSAGE) {
    return true;
  }
  if (error instanceof ApiError) {
    if (error.statusCode == null) {
      return isConnectivityFailure(error.message);
    }
    return error.statusCode >= 500; // 502/503: Render dang khoi dong lai
  }
  return isConnectivityFailure(normalizeApiError(error));
}
