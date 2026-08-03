import {
  buildRangeLabel,
  cleanDisplayText,
  formatMoney,
  getInitials,
  isConnectivityFailure,
  normalizeApiError,
  parseNumberInput,
  splitAddress,
} from "../utils";

describe("formatMoney", () => {
  it("doi sang 'ty' khi tu 1 ty tro len", () => {
    expect(formatMoney(5_200_000_000)).toBe("5,2 tỷ");
    expect(formatMoney(15_000_000_000)).toBe("15 tỷ");
  });

  it("doi sang 'trieu' khi duoi 1 ty", () => {
    expect(formatMoney(950_000_000)).toBe("950 triệu");
  });

  it("tra ve '-' khi khong co gia", () => {
    expect(formatMoney(null)).toBe("-");
    expect(formatMoney(undefined)).toBe("-");
    expect(formatMoney(Number.NaN)).toBe("-");
  });
});

describe("parseNumberInput", () => {
  it("hieu dau phay kieu Viet Nam", () => {
    expect(parseNumberInput("5,2")).toBe(5.2);
  });

  it("bo ky tu khong phai so", () => {
    expect(parseNumberInput("15 tỷ")).toBe(15);
    expect(parseNumberInput("4m")).toBe(4);
  });

  it("tra ve 0 khi go rac", () => {
    expect(parseNumberInput("")).toBe(0);
    expect(parseNumberInput("abc")).toBe(0);
  });
});

describe("cleanDisplayText", () => {
  it("gom khoang trang thua va cat dau dong", () => {
    expect(cleanDisplayText("  Trần   Đăng  Duy ")).toBe("Trần Đăng Duy");
  });

  it("dung fallback khi rong", () => {
    expect(cleanDisplayText("", "Chưa rõ")).toBe("Chưa rõ");
    expect(cleanDisplayText(null)).toBe("-");
  });
});

describe("splitAddress", () => {
  it("tach phan dau lam dia chi chinh", () => {
    expect(splitAddress("124 Huỳnh Mẫn Đạt, Phường 3, Quận 5")).toEqual({
      primary: "124 Huỳnh Mẫn Đạt",
      secondary: "Phường 3, Quận 5",
    });
  });

  it("bao 'Chua co dia chi' khi rong", () => {
    expect(splitAddress(null).primary).toBe("Chưa có địa chỉ");
  });
});

describe("buildRangeLabel", () => {
  it("hien day du khi co ca hai dau", () => {
    expect(buildRangeLabel("Giá", 5, 10, " tỷ")).toBe("Giá: 5-10 tỷ");
  });

  it("hien mot dau khi chi co min hoac max", () => {
    expect(buildRangeLabel("Giá", 5, undefined, " tỷ")).toBe("Giá: từ 5 tỷ");
    expect(buildRangeLabel("DT", undefined, 80, " m²")).toBe("DT: đến 80 m²");
  });

  it("tra ve rong khi khong loc gi", () => {
    expect(buildRangeLabel("Giá", undefined, undefined)).toBe("");
    expect(buildRangeLabel("Giá", 0, 0)).toBe("");
  });
});

describe("loi ket noi", () => {
  it("nhan dien loi mang", () => {
    expect(isConnectivityFailure("Network request failed")).toBe(true);
    expect(isConnectivityFailure("API lỗi 500")).toBe(false);
  });

  it("giu nguyen thong bao loi tu backend", () => {
    expect(normalizeApiError(new Error("Sai mật khẩu"))).toBe("Sai mật khẩu");
  });

  it("khong vo khi loi khong phai Error", () => {
    expect(normalizeApiError("hong")).toBe("Đã có lỗi xảy ra");
  });
});

describe("getInitials", () => {
  it("lay 2 chu cai dau", () => {
    expect(getInitials("Trần Đăng Duy")).toBe("TĐ");
  });

  it("dung fallback khi rong", () => {
    expect(getInitials("")).toBe("LS");
  });
});
