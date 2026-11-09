// So sánh sản phẩm: các hàm thuần (không đọc trình duyệt, không gọi máy chủ) để dễ kiểm thử.
// Chỉ lưu MÃ HÀNG; giá, tồn kho, thông số luôn lấy từ máy chủ khi vẽ trang.
import type { Product } from "@/lib/mock/store";

export const MAX_COMPARE = 3;
export const STORAGE_KEY = "ttt-compare-v1";
// Cùng quy tắc với getProduct() ở lib/catalog.ts
export const SKU_RE = /^[A-Za-z0-9-]{2,42}$/;

export type ComparableProduct = Pick<Product, "sku" | "cat" | "sub" | "specs">;

const sameSku = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Danh sách hợp lệ: đúng kiểu + đúng regex, bỏ trùng (không phân biệt hoa/thường), giữ thứ tự, tối đa 3.
export function normalizeSkus(input: unknown, max = MAX_COMPARE): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== "string" || !SKU_RE.test(item)) continue;
    if (out.some((sku) => sameSku(sku, item))) continue;
    out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

// ?sku=A,B hoặc ?sku=A&sku=B (hoặc trộn); mọi thứ khác bị bỏ.
export function parseSkuParam(value: unknown): string[] {
  const parts = (Array.isArray(value) ? value : [value]).flatMap((v) => (typeof v === "string" ? v.split(",") : []));
  return normalizeSkus(parts.map((v) => v.trim()));
}

export function compareHref(skus: string[]): string {
  const list = normalizeSkus(skus);
  return list.length ? `/so-sanh?sku=${list.map(encodeURIComponent).join(",")}` : "/so-sanh";
}

export type AddResult = { list: string[]; status: "added" | "exists" | "full" | "invalid" };

export function addSku(list: string[], sku: unknown): AddResult {
  const current = normalizeSkus(list);
  if (typeof sku !== "string" || !SKU_RE.test(sku)) return { list: current, status: "invalid" };
  if (current.some((item) => sameSku(item, sku))) return { list: current, status: "exists" };
  if (current.length >= MAX_COMPARE) return { list: current, status: "full" };
  return { list: [...current, sku], status: "added" };
}

export function removeSku(list: string[], sku: string): string[] {
  return normalizeSkus(list).filter((item) => !sameSku(item, sku));
}

export const hasSku = (list: string[], sku: string) => list.some((item) => sameSku(item, sku));

// Đọc từ sessionStorage: JSON hỏng, null, sai cấu trúc, phiên bản lạ → danh sách rỗng.
export function parseStored(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || (data as { version?: unknown }).version !== 1) return [];
    return normalizeSkus((data as { skus?: unknown }).skus);
  } catch {
    return [];
  }
}

export const serializeStored = (skus: string[]) => JSON.stringify({ version: 1, skus: normalizeSkus(skus) });

// ---- Bảng so sánh ----

// Chuẩn hóa để so sánh: Unicode NFC, hạ chữ, gộp khoảng trắng. GIỮ dấu tiếng Việt, không đổi đơn vị.
export const normText = (s: string) => s.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/g, " ").trim();

// "Chưa rõ" có thật trong dữ liệu sản phẩm hiện tại (vd. Xuất xứ) → cũng là thiếu thông tin, không phải một giá trị để so.
const MISSING = new Set(["", "-", "—", "đang cập nhật", "chưa có thông tin", "chưa rõ"]);
export const isMissing = (value: unknown) => typeof value !== "string" || MISSING.has(normText(value));

// Nhãn không đưa vào phần thông số: đã có hàng riêng ở bảng (thương hiệu, đơn vị tính, bảo hành) hoặc chủ shop yêu cầu bỏ (hẹn giờ, 08/11).
const FIXED_LABELS = new Set(["thương hiệu", "đơn vị tính", "bảo hành", "hẹn giờ"]);

export type SpecRow = {
  label: string;
  /** Mỗi sản phẩm: các giá trị đã biết (đã bỏ trùng), hoặc null nếu thiếu. */
  cells: (string[] | null)[];
  /** Khác nhau chỉ khi có ít nhất HAI sản phẩm có giá trị đã biết và các giá trị đó khác nhau. */
  differs: boolean;
};

export function buildSpecRows(products: ComparableProduct[]): SpecRow[] {
  const labels: { key: string; label: string }[] = [];
  for (const product of products) {
    for (const [label] of product.specs) {
      const key = normText(label);
      if (!key || FIXED_LABELS.has(key) || labels.some((item) => item.key === key)) continue;
      labels.push({ key, label: label.trim() });
    }
  }
  return labels.map(({ key, label }) => {
    const cells = products.map((product) => {
      const seen = new Set<string>();
      const values: string[] = [];
      for (const [name, value] of product.specs) {
        if (normText(name) !== key || isMissing(value)) continue;
        const norm = normText(value);
        if (seen.has(norm)) continue;
        seen.add(norm);
        values.push(value.trim());
      }
      return values.length ? values : null;
    });
    const known = cells.filter((cell): cell is string[] => cell !== null).map((cell) => cell.map(normText).sort().join("\u0000"));
    return { label, cells, differs: known.length >= 2 && new Set(known).size > 1 };
  });
}

// Khác loại = các món đã biết Danh mục + Danh mục con mà không cùng một cặp. Thiếu Danh mục con thì không đủ căn cứ.
export function mixedKinds(products: ComparableProduct[]): boolean {
  const keys = products.filter((p) => !isMissing(p.sub) && !isMissing(p.cat)).map((p) => `${normText(p.cat)}|${normText(p.sub)}`);
  return new Set(keys).size > 1;
}
