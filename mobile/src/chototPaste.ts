import { LookupCollections, LookupItem, PropertyCreatePayload } from "./types";

// Tach thong tin tu tin Cho Tot (copy tu Telegram cua bot theo doi) de dien san form Nhap nha.
// Bot gui dang:
//   Nhà mới
//   <Tiêu đề>
//   -----------------------
//   📍 Dia chi: <địa chỉ, có thể kèm quận>
//   💰 Gia: <5,2 tỷ | 950 triệu | Thỏa thuận>
//   📐 Dien tich: <52 m²>
//   📝 Tom tat: <mô tả>
//   ➡️ Xem tin goc (link)
// Parser chay thuan client, khong goi mang — chiu duoc label co/khong dau, co/khong emoji.

export type ChototParseResult = {
  patch: Partial<PropertyCreatePayload>;
  filled: string[];
};

// Mot tin trong danh sach chon (khi dan nhieu tin cung luc)
export type ChototListingOption = {
  title: string;
  subtitle: string;
  patch: Partial<PropertyCreatePayload>;
  filled: string[];
};

// Cac truong parser co the dien — reset ve mac dinh truoc khi ap tin moi,
// tranh tron du lieu 2 tin khac nhau khi dan lien tiep.
export const chototFieldDefaults: Partial<PropertyCreatePayload> = {
  title: "",
  address: "",
  district_code: "",
  ward_code: "",
  street_name: "",
  price: 0,
  area: 0,
  width: 0,
  length: 0,
  floors: 0,
  owner_name: "",
  contact_phone: "",
  description: "",
  note: "",
  direct_owner: false,
  negotiable: false,
};

function stripAccents(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

// "5,2" / "5.2" / "1.250" -> so thap phan kieu Viet
function parseViNumber(raw: string): number {
  let s = raw.trim();
  if (!s) return 0;
  if (s.includes(".") && s.includes(",")) {
    // "1.250,5" — cham la phan nghin
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  } else if (s.includes(".")) {
    // "1.250" (nhom nghin) vs "5.2" (thap phan): nhom 3 chu so sau cham -> nghin
    const m = s.match(/^\d{1,3}(\.\d{3})+$/);
    if (m) s = s.replace(/\./g, "");
  }
  const value = Number(s);
  return Number.isFinite(value) ? value : 0;
}

// Gia text -> ty dong. "5,2 tỷ" -> 5.2; "950 triệu" -> 0.95; "5 tỷ 200 triệu" -> 5.2
function parsePriceToTy(raw: string): { price: number; negotiable: boolean } {
  const norm = stripAccents(raw);
  if (!norm || norm.includes("thoa thuan")) {
    return { price: 0, negotiable: norm.includes("thoa thuan") };
  }
  let price = 0;
  const ty = norm.match(/([\d.,]+)\s*(?:ty|ti\b)/);
  if (ty) price += parseViNumber(ty[1]);
  const trieu = norm.match(/([\d.,]+)\s*(?:trieu|tr\b)/);
  if (trieu) price += parseViNumber(trieu[1]) / 1000;
  if (!ty && !trieu) {
    // So tran: >= 100 trieu coi la dong -> doi sang ty
    const bare = norm.match(/([\d.,]+)/);
    if (bare) {
      const value = parseViNumber(bare[1]);
      price = value >= 100_000_000 ? value / 1_000_000_000 : value;
    }
  }
  return { price: Math.round(price * 1000) / 1000, negotiable: false };
}

// Bo tien to loai don vi hanh chinh de so khop: "Quận 10"/"Q.10" -> "10", "Phường 12"/"P.12" -> "12"
function adminKey(label: string): string {
  return stripAccents(label)
    .replace(/^(quan|huyen|thanh pho|tp|q|h)\s*\.?\s*/, "")
    .replace(/^(phuong|xa|thi tran|tt|p)\s*\.?\s*/, "")
    .replace(/^0+(\d)/, "$1")
    .trim();
}

function matchLookup(items: LookupItem[], rawName: string): LookupItem | null {
  const key = adminKey(rawName);
  if (!key) return null;
  let found = items.find((item) => adminKey(item.label) === key) ?? null;
  if (!found && key.length >= 3) {
    found = items.find((item) => {
      const itemKey = adminKey(item.label);
      return itemKey.length >= 3 && (itemKey.includes(key) || key.includes(itemKey));
    }) ?? null;
  }
  return found;
}

// Lay gia tri sau label (khong dau, bo emoji): "📍 Dia chi: 123 Ba Vì" -> "123 Ba Vì"
function labelValue(lines: string[], labelPattern: RegExp): string {
  for (const line of lines) {
    const norm = stripAccents(line).replace(/^[^a-z0-9]+/, "");
    const m = norm.match(labelPattern);
    if (m) {
      const idx = line.toLowerCase().indexOf(":");
      if (idx >= 0) return line.slice(idx + 1).trim();
    }
  }
  return "";
}

// Tin tu do (khong phai format bot) hay viet dia chi ngay tren 1 dong:
// "124 Huỳnh Mẫn Đạt p3 Quận 5". Tim dong co dau hieu quan/huyen roi chen
// dau phay truoc P./Phường/Q./Quận de dung lai bo tach dia chi co san.
function findFreeformAddressLine(lines: string[], lookups: LookupCollections): string {
  const districtNameKeys = lookups.districts
    .map((d) => adminKey(d.label))
    .filter((k) => k.length >= 4 && !/^\d+$/.test(k));
  for (const line of lines) {
    const norm = stripAccents(line).replace(/^[^a-z0-9]+/, "");
    if (!norm || /^https?:\/\//.test(norm)) continue;
    if (/^(gia|dien tich|tom tat|chu nha|nguoi dang|xem tin goc)\b/.test(norm)) continue;
    const hasDistrictToken = /\b(?:quan|q)\.?\s*\d{1,2}\b/.test(norm) || /\bhuyen\s/.test(norm);
    const hasDistrictName = districtNameKeys.some((k) => norm.includes(k));
    if (!hasDistrictToken && !hasDistrictName) continue;
    return line
      .replace(/\s+(?=(?:p|phường|phuong|xã|xa)\.?\s*\d)/gi, ", ")
      .replace(/\s+(?=(?:phường|phuong)\s+\p{L})/giu, ", ")
      .replace(/\s+(?=(?:q|quận|quan)\.?\s*\d)/gi, ", ")
      .replace(/\s+(?=(?:quận|quan|huyện|huyen)\s+\p{L})/giu, ", ");
  }
  return "";
}

export function parseChototListing(
  text: string,
  lookups: LookupCollections
): ChototParseResult {
  const patch: Partial<PropertyCreatePayload> = {};
  const filled: string[] = [];
  const rawLines = (text || "").split(/\r?\n/).map((line) => line.trim());
  const lines = rawLines.filter(Boolean);
  const normFull = stripAccents(text || "");

  // --- Tieu de: dong dau tien khong phai header/label/separator/link
  const isNoise = (line: string): boolean => {
    const norm = stripAccents(line).replace(/^[^a-z0-9]+/, "");
    return (
      !norm ||
      /^-{3,}/.test(line.trim()) ||
      norm === "nha moi" ||
      norm === "tin moi" ||
      /^(dia chi|gia|dien tich|tom tat|xem tin goc)\b/.test(norm) ||
      /^https?:\/\//.test(norm)
    );
  };
  const titleLine = lines.find((line) => !isNoise(line));
  if (titleLine) {
    patch.title = titleLine;
    filled.push("tiêu đề");
  }

  // --- Dia chi: uu tien dong "Dia chi:" cua bot; tin tu do thi tim dong
  // dang "124 Huỳnh Mẫn Đạt p3 Quận 5"
  const labeledAddress = labelValue(lines, /^dia chi\s*:/);
  const addressText = labeledAddress || findFreeformAddressLine(lines, lookups);
  if (addressText) {
    const parts = addressText
      .split(",")
      .map((p) => p.trim())
      .filter((p) => {
        const norm = stripAccents(p);
        return norm && !/(ho chi minh|tp\.? ?hcm|hcm|sai gon|viet nam)$/.test(norm);
      });

    let districtItem: LookupItem | null = null;
    let wardPart = "";
    const otherParts: string[] = [];

    for (const part of parts) {
      const norm = stripAccents(part);
      if (/^(phuong|p\.|p |xa |thi tran|tt\.?)/.test(norm) || /^p\d+$/.test(norm.replace(/\s/g, ""))) {
        wardPart = part;
        continue;
      }
      if (/^(quan|q\.|q |huyen|h\.)/.test(norm)) {
        // "Quận 5 giá 15,5 tỷ" -> chi lay token "quan 5" de khop ma
        const numToken = norm.match(/^(?:quan|q)\.?\s*(\d{1,2})\b/);
        districtItem = matchLookup(lookups.districts, numToken ? numToken[1] : part) ?? districtItem;
        continue;
      }
      // Phan khong co tien to: thu khop ten quan (VD "Bình Chánh")
      const asDistrict = matchLookup(lookups.districts, part);
      if (asDistrict && !districtItem && otherParts.length > 0) {
        districtItem = asDistrict;
        continue;
      }
      otherParts.push(part);
    }

    if (districtItem) {
      patch.district_code = districtItem.code;
      filled.push(`quận (${districtItem.label})`);
      const wardsInDistrict = lookups.wards.filter(
        (w) => w.parent_code === districtItem?.code
      );
      // Uu tien phan co tien to "Phường/Xã"; khong co thi thu cac phan sau phan dau
      // (phan dau la so nha + duong) — VD "Đường Quách Điêu, Vĩnh Lộc A, Bình Chánh"
      const wardCandidates = wardPart ? [wardPart] : otherParts.slice(1);
      for (const candidate of wardCandidates) {
        const candNorm = stripAccents(candidate);
        const numToken = candNorm.match(/^(?:phuong|p)\.?\s*(\d{1,2})\b/);
        const wardItem = matchLookup(wardsInDistrict, numToken ? numToken[1] : candidate);
        if (wardItem) {
          patch.ward_code = wardItem.code;
          filled.push(`phường (${wardItem.label})`);
          break;
        }
      }
    }

    // So nha + duong: phan dau tien con lai
    if (otherParts.length > 0) {
      const streetAddress = otherParts[0];
      // "Số nhà / Địa chỉ" CHI nhan so nha that (VD "123/45"). "Hẻm 395 Vĩnh Viễn"
      // khong co so nha -> de trong cho nguoi dung tu dien.
      let houseNumberValue = streetAddress.match(/^(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)*)\s+/)?.[1] ?? "";
      let streetSource = streetAddress;
      if (!houseNumberValue) {
        // So nha nam giua cau: "Bán nhà 88 Trần Bình Trọng" -> 88 + Trần Bình Trọng.
        // Khong tinh so hem/ngo/khu/lo ("Hẻm 395 Vĩnh Viễn" van khong co so nha).
        const mid = streetAddress.match(/(?:^|\s)(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)*)\s+(\p{Lu}.+)$/u);
        if (mid && typeof mid.index === "number") {
          const beforeToken = stripAccents(
            streetAddress.slice(0, mid.index).trim().split(/\s+/).pop() ?? ""
          );
          if (!["hem", "ngo", "khu", "lo", "so", "sn"].includes(beforeToken)) {
            houseNumberValue = mid[1];
            streetSource = `${mid[1]} ${mid[2]}`;
          }
        }
      }
      if (houseNumberValue) {
        patch.address = houseNumberValue;
        filled.push(`số nhà (${houseNumberValue})`);
      }
      // Ten duong = bo so nha dau chuoi + bo tien to "Đường"/"Hẻm 395" —
      // danh muc duong Landsoft chi luu ten tran (VD "Vĩnh Viễn")
      const street = streetSource
        .replace(/^[\d/\-]+[a-zA-Z]?\s+/, "")
        .replace(/^(hẻm|hem|Hẻm|Hem)\s+[\d/\-]+\s+/i, "")
        .replace(/^(đường|duong|Đường|Duong)\s+/i, "")
        .trim();
      if (street) {
        patch.street_name = street;
        filled.push(`đường (${street})`);
      }
    }
  }

  // --- Gia: uu tien dong "Gia:"; tin tu do thi tim "giá 15,5 tỷ" / "15,5 tỷ"
  let priceText = labelValue(lines, /^gia\s*:/);
  if (!priceText) {
    const withWord = normFull.match(/gia[^\d\n]{0,12}([\d.,]+\s*(?:ty|ti|trieu)\b(?:[^\n]{0,25}?(?:trieu|thoa thuan))?)/);
    const bare = normFull.match(/\b([\d.,]+\s*(?:ty|ti))\b/);
    priceText = withWord?.[1] ?? bare?.[1] ?? "";
  }
  if (priceText) {
    const { price, negotiable } = parsePriceToTy(priceText);
    if (price > 0) {
      patch.price = price;
      filled.push(`giá (${price} tỷ)`);
    }
    if (negotiable) {
      patch.negotiable = true;
      filled.push("thương lượng");
    }
  }

  // --- Dien tich: uu tien dong "Dien tich:"; tin tu do thi tim "DT 52m2" / "52 m²"
  let areaText = labelValue(lines, /^dien tich\s*:/);
  if (!areaText) {
    const withWord = normFull.match(/(?:dien tich|dtcn|dtsd|\bdt)\W{0,8}([\d.,]+)\s*m/);
    const bare = normFull.match(/([\d.,]+)\s*m[²2](?!\w)/);
    const found = withWord?.[1] ?? bare?.[1];
    if (found) areaText = `${found} m²`;
  }
  if (areaText) {
    const m = areaText.match(/([\d.,]+)/);
    if (m) {
      const area = parseViNumber(m[1]);
      if (area > 0) {
        patch.area = area;
        filled.push(`diện tích (${area} m²)`);
      }
    }
  }

  // --- Tom tat / mo ta: tu sau label den truoc link "Xem tin goc"
  const startIdx = rawLines.findIndex((line) =>
    /^tom tat\s*:?/.test(stripAccents(line).replace(/^[^a-z0-9]+/, ""))
  );
  if (startIdx >= 0) {
    const firstLine = rawLines[startIdx];
    const colonIdx = firstLine.indexOf(":");
    const descLines: string[] = [];
    const inline = colonIdx >= 0 ? firstLine.slice(colonIdx + 1).trim() : "";
    if (inline) descLines.push(inline);
    for (let i = startIdx + 1; i < rawLines.length; i += 1) {
      const norm = stripAccents(rawLines[i]).replace(/^[^a-z0-9]+/, "");
      if (/^xem tin goc/.test(norm) || /^https?:\/\//.test(norm)) break;
      descLines.push(rawLines[i]);
    }
    const description = descLines.join("\n").trim();
    if (description) {
      patch.description = description;
      filled.push("diễn giải");
    }
  }

  // Tin tu do (khong co "Tom tat:" va "Dia chi:"): dua TOAN BO noi dung tin
  // vao Diễn giải de khong sot chu thich nao
  if (!patch.description && !labeledAddress) {
    const contentLines = rawLines.filter((line) => {
      const norm = stripAccents(line).replace(/^[^a-z0-9]+/, "");
      if (!norm || /^https?:\/\//.test(norm)) return false;
      if (TELEGRAM_MSG_HEADER.test(line.trim())) return false;
      return norm !== "nha moi" && norm !== "tin moi";
    });
    if (contentLines.length >= 2) {
      patch.description = contentLines.join("\n").trim();
      filled.push("diễn giải (toàn bộ tin)");
    }
  }

  // --- Trich them tu toan van (mo ta + tieu de)
  const scanText = normFull;

  // Chu nha: uu tien dong "👤 Chủ nhà: ..." bot gui; khong co thi bat
  // "chị Liên"/"anh Tùng"... trong mo ta (chu dau ten viet hoa)
  const ownerLabeled = labelValue(lines, /^(chu nha|nguoi dang)\s*:/);
  if (ownerLabeled) {
    patch.owner_name = ownerLabeled;
    filled.push(`chủ nhà (${ownerLabeled})`);
  } else {
    const honorific = (text || "").match(
      /\b(anh|chị|cô|chú|bác|Anh|Chị|Cô|Chú|Bác)\s+(\p{Lu}\p{Ll}+(?:\s+\p{Lu}\p{Ll}+){0,2})/u
    );
    if (honorific) {
      const owner = `${honorific[1][0].toUpperCase()}${honorific[1].slice(1)} ${honorific[2]}`;
      patch.owner_name = owner;
      filled.push(`chủ nhà (${owner})`);
    }
  }

  // SDT: 09xx..., 03x, 07x... 10 so
  const phoneMatch = (text || "").match(/(?:^|[^\d])(0\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3,4})(?:[^\d]|$)/);
  if (phoneMatch) {
    const digits = phoneMatch[1].replace(/\D/g, "");
    if (/^0\d{9,10}$/.test(digits)) {
      // Giu nguyen format nhu trong tin (ke ca dau cham) — giong Landsoft luu SDT
      patch.contact_phone = phoneMatch[1].trim();
      filled.push("SĐT");
    }
  }

  // Loai BDS: dia chi/tin co "hẻm"/"HXH" -> Nhà hẻm; "mặt tiền"/"MT" -> Mặt tiền
  const addrNorm = stripAccents(addressText);
  const typeSignal = /\bhem\b|hxh/.test(addrNorm)
    ? "hem"
    : /mat tien|\bmt\b/.test(scanText)
      ? "mat tien"
      : /\bhem\b|hxh/.test(scanText)
        ? "hem"
        : "";
  if (typeSignal) {
    const typeItem = lookups.property_types.find((t) =>
      stripAccents(t.label).includes(typeSignal)
    );
    if (typeItem) {
      patch.property_type_code = typeItem.code;
      filled.push(`loại BĐS (${typeItem.label})`);
    }
  }

  // Ngang x dai: "4x13", "4 x 13.5", "4m x 13m"
  const dims = scanText.match(/(\d+(?:[.,]\d+)?)\s*m?\s*x\s*(\d+(?:[.,]\d+)?)\s*m?\b/);
  if (dims) {
    const width = parseViNumber(dims[1]);
    const length = parseViNumber(dims[2]);
    if (width > 0 && width < 100 && length > 0 && length < 200) {
      patch.width = width;
      patch.length = length;
      filled.push(`ngang×dài (${width}×${length})`);
    }
  }

  // So tang: "3 tang" | "1 tret 2 lau" -> 3
  const lau = scanText.match(/(\d+)\s*lau/);
  const tang = scanText.match(/(\d+)\s*tang/);
  if (tang) {
    patch.floors = Number(tang[1]);
    filled.push(`số tầng (${patch.floors})`);
  } else if (lau) {
    patch.floors = Number(lau[1]) + (scanText.includes("tret") ? 1 : 0);
    filled.push(`số tầng (${patch.floors})`);
  }

  if (scanText.includes("chinh chu")) {
    patch.direct_owner = true;
    filled.push("chính chủ");
  }
  if (scanText.includes("thuong luong") && !patch.negotiable) {
    patch.negotiable = true;
    filled.push("thương lượng");
  }

  // Ban hay cho thue. Chi nhan "thue" khi tin RO RANG la tin cho thue:
  // gia theo thang, hoac tieu de bat dau bang "cho thuê". Mo ta kieu
  // "nhà đang cho thuê 5tr/tháng" van la tin BAN (nha ban kem khach thue).
  const titleNorm = stripAccents(patch.title ?? "");
  const priceNorm = stripAccents(priceText);
  patch.listing_type =
    /\/thang\b/.test(priceNorm) || /(trieu|tr)\s*\/?\s*thang/.test(priceNorm) || /^(cho thue|cần cho thue|can cho thue)/.test(titleNorm)
      ? "thue"
      : "ban";

  // Moi thong tin chu thich cua tin deu nam o "Diễn giải" (patch.description).
  // "Ghi chú ban đầu" de trong cho nguoi dung tu ghi — khong dien link/lap lai.

  // Nguon tin: luon chon "Khảo sát thực tế" theo quy trinh cua nguoi dung
  const source = lookups.sources.find((s) => stripAccents(s.label).includes("khao sat"));
  if (source) {
    patch.source_code = source.code;
    filled.push(`nguồn tin (${source.label})`);
  }

  // Khong nhan ra gi dang ke -> coi nhu that bai. Rieng tieu de khong du:
  // van ban bat ky cung co "dong dau tien".
  const meaningful = filled.some((f) =>
    ["số nhà", "đường", "giá", "diện tích", "quận"].some((k) => f.startsWith(k))
  );
  if (!meaningful) {
    return { patch: {}, filled: [] };
  }

  return { patch, filled };
}

// Dong header Telegram chen giua cac tin khi copy nhieu tin:
// "Ten Bot, [02.07.26 11:30]" / "Bot Nha, [Jul 2, 2026 at 11:30]"
const TELEGRAM_MSG_HEADER = /^\S.{0,80}, \[.{6,40}\]$/;

// Tach van ban dan vao thanh tung tin rieng. Ranh gioi: header Telegram
// hoac dong "Nhà mới"/"Tin mới" ma bot luon dat dau moi tin.
export function splitChototMessages(text: string): string[] {
  const lines = (text || "").split(/\r?\n/);
  const blocks: string[][] = [];
  let current: string[] = [];
  const flush = () => {
    if (current.some((line) => line.trim())) {
      blocks.push(current);
    }
    current = [];
  };
  for (const line of lines) {
    const trimmed = line.trim();
    const norm = stripAccents(trimmed).replace(/^[^a-z0-9]+/, "");
    const isTelegramHeader = TELEGRAM_MSG_HEADER.test(trimmed);
    const isBotHeader = norm === "nha moi" || norm === "tin moi";
    if (isTelegramHeader || isBotHeader) {
      flush();
      continue; // bo dong ranh gioi, khong dua vao noi dung tin
    }
    current.push(line);
  }
  flush();
  return blocks.map((block) => block.join("\n"));
}

// Parse van ban co the chua NHIEU tin -> danh sach tin hop le de nguoi dung chon.
export function parseChototMulti(
  text: string,
  lookups: LookupCollections
): ChototListingOption[] {
  const options: ChototListingOption[] = [];
  const seen = new Set<string>();
  for (const block of splitChototMessages(text)) {
    const result = parseChototListing(block, lookups);
    if (result.filled.length === 0) continue;

    const patch = result.patch;
    const districtLabel = patch.district_code
      ? lookups.districts.find((d) => d.code === patch.district_code)?.label
      : undefined;
    const subtitleParts: string[] = [];
    const place = [patch.address, patch.street_name].filter(Boolean).join(" ");
    if (place) subtitleParts.push(place);
    if (districtLabel) subtitleParts.push(districtLabel);
    if (patch.price) subtitleParts.push(`${patch.price} tỷ`);
    if (patch.area) subtitleParts.push(`${patch.area} m²`);

    const title = patch.title?.trim() || place || "Tin không tiêu đề";
    // Bo tin trung (copy chong lan nhau)
    const dedupKey = stripAccents(`${title}|${place}|${patch.price ?? ""}`);
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    options.push({
      title,
      subtitle: subtitleParts.join(" · "),
      patch,
      filled: result.filled,
    });
  }
  return options;
}
