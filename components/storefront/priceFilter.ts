// Hàm thuần dùng chung cho bộ lọc giá của trang /danh-muc (không phụ thuộc React).

export const PRICE_STEP = 5000;

export type Bounds = { min: number; max: number };

export const fmtNumber = (n: number) => n.toLocaleString("vi-VN");

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// Giá thấp nhất / cao nhất của danh sách, làm tròn ra bước 5.000₫ để thanh kéo chạm được hai đầu.
export function boundsOf(prices: number[]): Bounds {
  if (!prices.length) return { min: 0, max: 0 };
  return {
    min: Math.floor(Math.min(...prices) / PRICE_STEP) * PRICE_STEP,
    max: Math.ceil(Math.max(...prices) / PRICE_STEP) * PRICE_STEP,
  };
}

// Tên gọi của khoảng giá trên thẻ "Đang chọn" và dòng tóm tắt.
export function priceLabel(lo: number, hi: number, b: Bounds) {
  if (lo === b.min && hi === 500000) return "Dưới 500 nghìn";
  if (lo === b.min && hi === 1000000) return "Dưới 1 triệu";
  if (hi === b.max && lo === 1000000) return "Từ 1 triệu";
  return `${fmtNumber(lo)} – ${fmtNumber(hi)} ₫`;
}

export type Draft = { brands: string[]; lo: number; hi: number };

export function matchProducts<T extends { brand: string; price: number }>(list: T[], d: Draft) {
  return list.filter((p) => (!d.brands.length || d.brands.includes(p.brand)) && p.price >= d.lo && p.price <= d.hi);
}
