// Ket qua cua ham nay quyet dinh co XOA tai khoan da nho tren may hay khong.
// Phan loai sai mot truong hop = sang ra nhan vien mo app phai go lai mat khau.
import { ApiError } from "../api";
import { BOOT_TIMEOUT_MESSAGE, isTransientBootFailure } from "../bootFailure";

describe("isTransientBootFailure — GIU tai khoan", () => {
  it("het gio cho khi khoi dong (backend Render dang ngu)", () => {
    expect(isTransientBootFailure(new Error(BOOT_TIMEOUT_MESSAGE))).toBe(true);
  });

  it("mat mang / khong goi duoc backend", () => {
    expect(isTransientBootFailure(new ApiError("Không kết nối được tới backend. Kiểm tra mạng."))).toBe(
      true
    );
    expect(isTransientBootFailure(new TypeError("Network request failed"))).toBe(true);
  });

  it("backend tra 500/502/503 luc dang khoi dong lai", () => {
    expect(isTransientBootFailure(new ApiError("API lỗi 502", 502))).toBe(true);
    expect(isTransientBootFailure(new ApiError("API lỗi 503", 503))).toBe(true);
    expect(isTransientBootFailure(new ApiError("API lỗi 500", 500))).toBe(true);
  });
});

describe("isTransientBootFailure — QUEN tai khoan", () => {
  it("sai tai khoan / mat khau", () => {
    expect(isTransientBootFailure(new ApiError("Sai tên đăng nhập hoặc mật khẩu", 401))).toBe(false);
  });

  it("token het han", () => {
    expect(isTransientBootFailure(new ApiError("Token không hợp lệ", 401))).toBe(false);
  });

  it("bi cam truy cap hoac khong tim thay", () => {
    expect(isTransientBootFailure(new ApiError("Không có quyền", 403))).toBe(false);
    expect(isTransientBootFailure(new ApiError("Không tìm thấy", 404))).toBe(false);
  });

  it("loi la khong ro nguon goc", () => {
    expect(isTransientBootFailure(new Error("hỏng gì đó"))).toBe(false);
    expect(isTransientBootFailure("hong")).toBe(false);
  });
});
