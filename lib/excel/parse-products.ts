// Chuyển dòng Excel → sản phẩm cần nhập. Dùng chung trình duyệt (xem trước) và server (kiểm lại).
// Hỗ trợ 2 mẫu: DMHH (KHO XHD, giá đồng) và file quạt Import_SanPham (giá nghìn đồng).

export type ImportRow = {
  line: number; sku: string; name: string; unit: string; price: number; cost: number | null; minQty: number | null;
  sub: string | null; classifications: string[] | null; industry: string | null; brand: string | null; spec: string | null; attributes: Record<string, string>;
  warranty: string | null; origin: string | null; errors: string[];
  // Chỉ mẫu chuẩn TTT: vị trí, tồn (số hàng đang có; null = ô trống, giữ nguyên), sản xuất tại, mô tả (chữ thường, mỗi dòng một đoạn), ô gốc để xuất lại file lỗi
  usageGuide?: string | null; location?: string | null; qty?: number | null; madeIn?: string | null; description?: string | null; raw?: Record<string, string>;
};

// Số tồn tối đa mỗi lần đặt: khớp giới hạn của hàm adjust_stock trong cơ sở dữ liệu (±100.000).
export const MAX_STOCK = 100_000;

// Cột của file Excel mẫu (mẫu chuẩn TTT). Giá tính bằng đồng.
export const TEMPLATE_COLUMNS = [
  "Mã hàng hóa", "Tên sản phẩm", "Đơn vị tính", "Giá bán", "Giá nhập", "Giá nhập + 10%", "Ngành hàng", "Danh mục", "Danh mục con", "Phân loại", "Thương hiệu",
  "Vị trí", "Tồn", "Tồn tối thiểu", "Thông số", "Mô tả", "Hướng dẫn sử dụng", "Bảo hành", "Xuất xứ", "Sản xuất tại",
] as const;
export const TEMPLATE_SHEET = "SanPham";

export const EXPORT_GROUPS = [
  { id: "basic", name: "Cơ bản", columns: ["Mã hàng hóa", "Tên sản phẩm", "Đơn vị tính", "Giá bán"] },
  { id: "cost", name: "Giá nhập", columns: ["Giá nhập", "Giá nhập + 10%"] },
  { id: "category", name: "Phân nhóm", columns: ["Ngành hàng", "Danh mục", "Danh mục con", "Phân loại", "Thương hiệu"] },
  { id: "stock", name: "Kho", columns: ["Tồn", "Tồn tối thiểu", "Vị trí"] },
  { id: "info", name: "Thông tin", columns: ["Thông số", "Mô tả", "Hướng dẫn sử dụng", "Bảo hành", "Xuất xứ", "Sản xuất tại"] },
  { id: "extra", name: "Khác", columns: ["Giá khuyến mãi", "Trạng thái", "Link ảnh"] },
] as const;

export function normalizeExportGroups(groups: readonly string[], withCost: boolean): string[] {
  return EXPORT_GROUPS.filter((group) => (group.id === "basic" || groups.includes(group.id)) && (withCost || group.id !== "cost")).map((group) => group.id);
}

// Phân loại: một ô, nhiều tên ngăn bằng dấu ";" (chủ shop chốt 07/11). Ô trống = null (giữ nguyên);
// ô chỉ có dấu ";" = [] (báo lỗi). Bỏ tên trùng không phân biệt hoa/thường, giữ dấu tiếng Việt.
export const MAX_CLASSIFICATIONS = 20;
export function splitClassifications(cell: string | null | undefined): string[] | null {
  const text = String(cell ?? "").trim();
  if (!text) return null;
  const seen = new Set<string>();
  const names: string[] = [];
  for (const part of text.split(";")) {
    const name = part.replace(/\s+/g, " ").trim();
    const key = name.toLocaleLowerCase("vi");
    if (name && !seen.has(key)) { seen.add(key); names.push(name); }
  }
  return names;
}

export const plain = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/\s+/g, " ").trim();

export const toSku = (raw: string) =>
  plain(raw).toUpperCase().replace(/\s/g, "-").replace(/[^A-Z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

const num = (v: string) => {
  const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

// Xếp danh mục con theo từ khóa trong tên (không dấu). Luật cụ thể đứng trước.
const RULES: [RegExp, string][] = [
  [/^(ong nhua|ong pvc|ong ppr|ong hdpe)/, "ong-pvc"],
  [/^(van |co (pvc|ren|nhua)|te (pvc|nhua)|noi (ren|pvc)|ba chac|kep ong)/, "van-co-noi"],
  [/^(bang tan|keo dan ong|keo pvc)/, "bang-tan-keo"],
  [/^cong tac/, "cong-tac"],
  [/^(o cam|o day)/, "o-cam"],
  [/^(cb |aptomat|cau dao|bo ngat mach)/, "cb-aptomat"],
  [/^(day dien|day don).*(2x|2 x| doi)/, "day-doi"],
  [/^(day dien|day don)/, "day-don"],
  [/^cap (dien|dong)/, "cap-dien"],
  [/^(bong den|bong led)/, "bong-led"],
  [/^(den tuyp|bo den tuyp|tuyp led)/, "den-tuyp"],
  [/^(den op|den tran|den ban)/, "den-op-tran"],
  [/^quat (treo|dao treo)/, "quat-treo-tuong"],
  [/^quat dung/, "quat-dung"],
  [/^quat lung/, "quat-lung"],
  [/^quat san/, "quat-san"],
  [/^quat ban/, "quat-ban"],
  [/^quat tran/, "quat-tran"],
  [/^quat hop/, "quat-hop"],
  [/^quat (hut|thong gio)/, "quat-hut"],
  [/^(may khoan|pin may khoan|mui khoan)/, "may-khoan"],
  [/^(kem |kim |co le|mo let)/, "kim-co-le"],
  [/^(tua vit|tuoc no vit)/, "tua-vit"],
  [/^(bu ?long|oc vit|dinh |vit |tac ke)/, "vit-bulong"],
  [/^keo /, "keo-dan"],
  [/^bang keo/, "bang-keo"],
  [/^(binh dun|am dun|am sieu toc)/, "am-binh-dun"],
  [/^(noi |chao |bep )/, "do-bep"],
  [/^(choi (?!than)|ban chai|cay lau|xo )/, "ve-sinh"],
];
export const guessSub = (name: string) => RULES.find(([rx]) => rx.test(plain(name)))?.[1] ?? null;

const FAN_SUB: Record<string, string> = {
  "quạt treo tường": "quat-treo-tuong", "quạt đứng": "quat-dung", "quạt lửng": "quat-lung", "quạt sàn": "quat-san",
  "quạt bàn": "quat-ban", "quạt trần": "quat-tran", "quạt hộp": "quat-hop", "quạt hút / thông gió": "quat-hut",
};

// Chủ shop chốt 07/11: Bảo hành, Xuất xứ, Sản xuất tại có thể ghi ngay trong cột Thông số
// (dòng "Bảo hành: 12 tháng"…). Tách 3 dòng đó ra trường riêng; phần còn lại vẫn là thông số.
const SERVICE_LINES = { "bao hanh": "warranty", "xuat xu": "origin", "san xuat tai": "madeIn" } as const;
export function splitServiceLines(spec: string): { spec: string; warranty: string | null; origin: string | null; madeIn: string | null } {
  const found: { warranty: string | null; origin: string | null; madeIn: string | null } = { warranty: null, origin: null, madeIn: null };
  const kept: string[] = [];
  for (const line of spec.split(/\r?\n/)) {
    const i = line.indexOf(":");
    const key = i > 0 ? SERVICE_LINES[plain(line.slice(0, i).replace(/^[-•*·\s]+/, "")) as keyof typeof SERVICE_LINES] : undefined;
    const value = i > 0 ? line.slice(i + 1).trim() : "";
    if (key && value) found[key] = value; else kept.push(line);
  }
  return { spec: kept.join("\n").trim(), ...found };
}

export function detectAndParse(
  sheets: Record<string, string[][]>, brands: string[], subs: { slug: string; name: string; parent?: string; parent_id?: number | null }[] = [],
): { format: string; rows: ImportRow[] } {
  // Mẫu chuẩn TTT (file mẫu tải từ web): có cột "Mã hàng hóa" + "Tên sản phẩm" + "Giá bán"
  const tplName = Object.keys(sheets).find((n) => {
    const h = (sheets[n][0] ?? []).map(plain);
    return h.includes("ma hang hoa") && h.includes("ten san pham") && h.includes("gia ban");
  });
  if (tplName) {
    const rows = sheets[tplName];
    const h = rows[0].map(plain);
    const subByName = new Map(subs.flatMap((s) => [[plain(s.name), s.slug], [s.slug, s.slug]]));
    return {
      format: "Mẫu chuẩn Tân Trường Tín (giá tính bằng đồng)",
      rows: rows.slice(1).map((r, i) => ({ r, line: i + 2 })).filter(({ r }) => r.some((c) => c)).map(({ r, line }) => {
        const raw = Object.fromEntries(TEMPLATE_COLUMNS.map((c) => [c, h.indexOf(plain(c)) >= 0 ? r[h.indexOf(plain(c))] ?? "" : ""]));
        const g = (c: (typeof TEMPLATE_COLUMNS)[number]) => raw[c].trim();
        const opt = (c: (typeof TEMPLATE_COLUMNS)[number]) => g(c) || null;
        const cat = g("Danh mục con") || g("Danh mục");
        const sub = cat ? subByName.get(plain(cat)) ?? null : null;
        // The fan workbook stores price and cost in thousands of đồng while
        // the kettle workbook and the standard template store full đồng.
        const service = splitServiceLines(g("Thông số"));
        const scale = plain(g("Ngành hàng")) === "quat" && num(g("Giá bán")) > 0 && num(g("Giá bán")) < 100_000 ? 1_000 : 1;
        const row = finish({
          line, sku: toSku(g("Mã hàng hóa")), name: g("Tên sản phẩm"), unit: g("Đơn vị tính") || "Cái", price: num(g("Giá bán")) * scale,
          cost: g("Giá nhập") ? num(g("Giá nhập")) * scale : null, minQty: g("Tồn tối thiểu") ? num(g("Tồn tối thiểu")) : null,
          sub, classifications: splitClassifications(g("Phân loại")), industry: opt("Ngành hàng"), brand: opt("Thương hiệu"), spec: service.spec || null, attributes: {}, warranty: opt("Bảo hành") ?? service.warranty, origin: opt("Xuất xứ") ?? service.origin,
          location: opt("Vị trí"), qty: g("Tồn") ? Number(g("Tồn").replace(/\s/g, "").replace(",", ".")) : null, madeIn: opt("Sản xuất tại") ?? service.madeIn, description: opt("Mô tả"), usageGuide: opt("Hướng dẫn sử dụng"), raw, errors: [],
        }, subs.find((item) => item.slug === sub)?.parent_id === null || subs.find((item) => item.slug === sub)?.parent === "");
        if (cat && !sub) row.errors.push(`Không tìm thấy danh mục “${cat}”`);
        if (row.minQty !== null && (!Number.isSafeInteger(row.minQty) || row.minQty < 0)) row.errors.push("Tồn tối thiểu không phải số");
        return row;
      }),
    };
  }

  const brandOf = (name: string) => brands.find((b) => new RegExp(`(^|\\s)${plain(b).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(plain(name))) ?? null;

  // Mẫu DMHH (chỉ đọc sheet DMHH)
  const dmhh = sheets["DMHH"];
  if (dmhh) {
    const head = dmhh.findIndex((r) => r.some((c) => plain(c) === "ma hang hoa"));
    if (head < 0) throw new Error("Sheet DMHH thiếu cột “Mã hàng hóa”.");
    const h = dmhh[head].map(plain);
    const at = (k: string) => h.indexOf(k);
    const iCode = at("ma hang hoa"), iName = at("ten hang hoa"), iUnit = at("don vi tinh"), iPrice = at("don gia");
    return {
      format: "DMHH (giá tính bằng đồng)",
      rows: dmhh.slice(head + 1).filter((r) => r[iName] || r[iCode]).map((r, i) => {
        const name = r[iName] ?? "";
        return finish({
          line: head + i + 2, sku: toSku(r[iCode] || name), name, unit: r[iUnit] || "Cái", price: num(r[iPrice]), cost: null, minQty: null,
          sub: guessSub(name), classifications: null, industry: null, brand: brandOf(name), spec: null, attributes: {}, warranty: null, origin: null, errors: [],
        });
      }),
    };
  }

  // Mẫu quạt (sheet có cột SKU + Giá bán, giá nghìn đồng)
  const fanName = Object.keys(sheets).find((n) => {
    const headers = (sheets[n][0] ?? []).map(plain);
    return headers.includes("sku") && headers.includes("gia ban");
  });
  if (fanName) {
    const rows = sheets[fanName];
    const h = rows[0];
    const g = (r: string[], k: string) => {
      const index = h.findIndex((cell) => plain(cell) === plain(k));
      return index >= 0 ? r[index] ?? "" : "";
    };
    return {
      format: "File quạt (giá tính bằng nghìn đồng)",
      rows: rows.slice(1).filter((r) => g(r, "Tên sản phẩm")).map((r, i) => {
        const cat = (g(r, "Danh mục con") || g(r, "Danh mục")).split(">").pop()?.trim().toLowerCase() ?? "";
        const name = g(r, "Tên sản phẩm");
        const attributes = Object.fromEntries(Object.entries({
          loai: g(r, "Loại / kiểu"), sai_canh: g(r, "Sải cánh"), so_canh: g(r, "Số cánh"), cong_suat: g(r, "Công suất"),
          luu_luong: g(r, "Lưu lượng gió"), toc_do: g(r, "Tốc độ gió"), dieu_khien: g(r, "Điều khiển"), dien_ap: g(r, "Điện áp"),
        }).filter(([, v]) => v));
        return finish({
          line: i + 2, sku: toSku(g(r, "SKU")), name, unit: g(r, "Đơn vị") || "cái",
          price: num(g(r, "Giá bán")) * 1000, cost: g(r, "Giá nhập") ? num(g(r, "Giá nhập")) * 1000 : null,
          minQty: g(r, "Ngưỡng tối thiểu") ? num(g(r, "Ngưỡng tối thiểu")) : null,
          sub: subs.find((item) => plain(item.name) === plain(cat))?.slug ?? FAN_SUB[cat] ?? guessSub(name), classifications: null, industry: g(r, "Ngành hàng") || null, brand: g(r, "Thương hiệu") || brandOf(name),
          spec: [g(r, "Sải cánh"), g(r, "Công suất"), g(r, "Điều khiển")].filter(Boolean).join(" · ").slice(0, 120) || null,
          attributes, warranty: g(r, "Bảo hành") || null, origin: g(r, "Xuất xứ") || null, errors: [],
        });
      }),
    };
  }
  throw new Error("Không nhận ra mẫu file. Cần sheet “DMHH” hoặc sheet có cột “SKU” và “Giá bán”.");
}

// Kiểm lỗi 1 dòng (dùng cả ở server)
export function finish(r: ImportRow, subIsRoot = false): ImportRow {
  const e: string[] = [];
  if (r.classifications) {
    if (!r.classifications.length) e.push("Ô Phân loại không có tên nào (chỉ có dấu ;).");
    if (r.classifications.length > MAX_CLASSIFICATIONS) e.push(`Tối đa ${MAX_CLASSIFICATIONS} Phân loại cho một sản phẩm.`);
    if (r.classifications.some((name) => name.length > 80)) e.push("Tên Phân loại dài quá 80 ký tự.");
    if (r.classifications.length && (!r.sub || subIsRoot)) e.push("Có Phân loại thì phải có Danh mục con.");
  }
  if (r.usageGuide && r.usageGuide.length > 3000) e.push("Hướng dẫn sử dụng quá dài (tối đa 3.000 ký tự).");
  if (!r.sku || r.sku.length < 2) e.push("Thiếu mã hàng hóa");
  if (!r.name || r.name.length < 2) e.push("Thiếu tên");
  if (r.name.length > 200) e.push("Tên quá dài");
  if (!Number.isSafeInteger(r.price) || r.price <= 0) e.push(Number.isNaN(r.price) ? "Giá bán không phải số" : "Giá bán bằng 0");
  else if (r.price > 500_000_000) e.push("Giá quá lớn");
  if (r.cost !== null && (!Number.isSafeInteger(r.cost) || r.cost < 0)) e.push("Giá nhập không phải số");
  if (r.qty != null && (!Number.isSafeInteger(r.qty) || r.qty < 0 || r.qty > MAX_STOCK)) e.push("Tồn phải là số nguyên từ 0 đến 100.000");
  if (!r.unit || r.unit.length > 20) e.push("Đơn vị lạ");
  r.unit = r.unit ? r.unit.charAt(0).toUpperCase() + r.unit.slice(1).toLowerCase() : r.unit;
  return { ...r, errors: e };
}

export function markDuplicates(rows: ImportRow[]) {
  const seen = new Map<string, number>();
  for (const r of rows) {
    if (!r.sku) continue;
    if (seen.has(r.sku)) r.errors.push(`SKU trùng dòng ${seen.get(r.sku)}`);
    else seen.set(r.sku, r.line);
  }
  return rows;
}
