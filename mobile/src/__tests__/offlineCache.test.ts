import { isDefaultFilters } from "../offlineCache";
import { PropertyFilters } from "../types";

const baseFilters: PropertyFilters = {
  keyword: "",
  district: "",
  ward: "",
  status: "",
  sort: "newest",
  page: 1,
  page_size: 50,
};

describe("isDefaultFilters", () => {
  it("dung khi dang xem toan bo kho hang", () => {
    expect(isDefaultFilters(baseFilters)).toBe(true);
  });

  it("sai khi co bat ky bo loc chu nao", () => {
    expect(isDefaultFilters({ ...baseFilters, keyword: "Mai Hắc Đế" })).toBe(false);
    expect(isDefaultFilters({ ...baseFilters, phone: "0938" })).toBe(false);
    expect(isDefaultFilters({ ...baseFilters, district: "5" })).toBe(false);
    expect(isDefaultFilters({ ...baseFilters, property_types: "2,12" })).toBe(false);
  });

  it("sai khi co bo loc khoang", () => {
    expect(isDefaultFilters({ ...baseFilters, price_min: 5 })).toBe(false);
    expect(isDefaultFilters({ ...baseFilters, area_max: 80 })).toBe(false);
    expect(isDefaultFilters({ ...baseFilters, width_min: 4 })).toBe(false);
  });

  it("sai khi khong phai trang dau (tranh cache nham trang 2)", () => {
    expect(isDefaultFilters({ ...baseFilters, page: 2 })).toBe(false);
  });

  it("khong tinh sort la bo loc", () => {
    expect(isDefaultFilters({ ...baseFilters, sort: "price_asc" })).toBe(true);
  });
});
