// Parser "Dan tin Cho Tot" la phan de vo nhat khi nguon tin doi cach viet:
// mot loi o day = nhan vien nhap nham du lieu vao Landsoft. Khoa lai bang test.
import { parseBatchListings, parseChototListing, splitChototMessages } from "../chototPaste";
import { LookupCollections } from "../types";

const lookups: LookupCollections = {
  districts: [
    { code: "5", label: "Quận 5" },
    { code: "10", label: "Quận 10" },
    { code: "24", label: "Bình Thạnh" },
  ],
  wards: [
    { code: "501", label: "Phường 3", parent_code: "5" },
    { code: "502", label: "Phường 6", parent_code: "5" },
    { code: "2401", label: "Phường 6", parent_code: "24" },
  ],
  property_types: [
    { code: "1", label: "Nhà mặt tiền" },
    { code: "2", label: "Nhà hẻm" },
  ],
  directions: [],
  legal_statuses: [],
  statuses: [],
  sources: [],
  grades: [],
  road_types: [],
  provinces: [{ code: "79", label: "TP Hồ Chí Minh" }],
};

describe("parseChototListing — tin bot Telegram", () => {
  const message = [
    "Nhà mới",
    "Bán nhà hẻm xe hơi Huỳnh Mẫn Đạt",
    "-----------------------",
    "📍 Địa chỉ: 124 Huỳnh Mẫn Đạt, Phường 3, Quận 5",
    "💰 Giá: 5,2 tỷ",
    "📐 Diện tích: 52 m²",
    "📝 Tóm tắt: Nhà 1 trệt 2 lầu, sổ hồng riêng",
    "➡️ Xem tin gốc: https://www.chotot.com/abc",
  ].join("\n");

  it("tach dung so nha va ten duong", () => {
    const { patch } = parseChototListing(message, lookups);
    expect(patch.address).toBe("124");
    expect(patch.street_name).toBe("Huỳnh Mẫn Đạt");
  });

  it("khop dung ma quan va ma phuong trong quan do", () => {
    const { patch } = parseChototListing(message, lookups);
    expect(patch.district_code).toBe("5");
    expect(patch.ward_code).toBe("501");
  });

  it("doi gia sang don vi ty va dien tich sang so", () => {
    const { patch } = parseChototListing(message, lookups);
    expect(patch.price).toBe(5.2);
    expect(patch.area).toBe(52);
  });

  it("dua tom tat vao dien giai, KHONG dua vao ghi chu", () => {
    const { patch } = parseChototListing(message, lookups);
    expect(patch.description).toContain("sổ hồng riêng");
    expect(patch.note ?? "").toBe("");
  });

  it("khong nham link tin goc thanh tieu de", () => {
    const { patch } = parseChototListing(message, lookups);
    expect(patch.title).toBe("Bán nhà hẻm xe hơi Huỳnh Mẫn Đạt");
  });
});

describe("parseChototListing — tin rao tu do", () => {
  it("hieu dia chi viet lien khong dau phay", () => {
    const { patch } = parseChototListing(
      "Bán nhà 88 Trần Bình Trọng p3 Quận 5 giá 15,5 tỷ, DT 60m2",
      lookups
    );
    expect(patch.address).toBe("88");
    expect(patch.street_name).toBe("Trần Bình Trọng");
    expect(patch.district_code).toBe("5");
    expect(patch.price).toBe(15.5);
    expect(patch.area).toBe(60);
  });

  it("KHONG lay so hem lam so nha", () => {
    const { patch } = parseChototListing("Bán nhà Hẻm 395 Vĩnh Viễn, Quận 10, giá 7 tỷ", lookups);
    expect(patch.address ?? "").toBe("");
    expect(patch.district_code).toBe("10");
  });

  it("doi 'trieu' sang don vi ty", () => {
    const { patch } = parseChototListing("Nhà nhỏ Quận 10, giá 950 triệu", lookups);
    expect(patch.price).toBe(0.95);
  });
});

describe("splitChototMessages", () => {
  it("tach nhieu tin theo dong tieu de cua bot", () => {
    const blocks = splitChototMessages(
      ["Nhà mới", "Tin A", "💰 Giá: 5 tỷ", "Nhà mới", "Tin B", "💰 Giá: 6 tỷ"].join("\n")
    );
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain("Tin A");
    expect(blocks[1]).toContain("Tin B");
  });

  it("mot tin le van tra ve dung mot khoi", () => {
    expect(splitChototMessages("Nhà mới\nTin A\n💰 Giá: 5 tỷ")).toHaveLength(1);
  });
});

describe("parseBatchListings — nguon nha gui qua Zalo", () => {
  it("tach tung can, ket thuc o dong co so dien thoai", () => {
    const text = [
      "40/17/3 Lam Sơn p6 Q Bình Thạnh",
      "5 x 22",
      "Giá 21 tỷ",
      "0764092288 a Hiệp",
      "124 Huỳnh Mẫn Đạt p3 Quận 5",
      "4 x 16",
      "Giá 12 tỷ",
      "0938111222 c Lan",
    ].join("\n");

    const items = parseBatchListings(text, lookups);
    expect(items).toHaveLength(2);
    expect(items[0].patch.street_name).toBe("Lam Sơn");
    expect(items[0].patch.price).toBe(21);
    expect(items[1].patch.street_name).toBe("Huỳnh Mẫn Đạt");
    expect(items[1].patch.price).toBe(12);
  });
});
