// Tham số lọc danh sách Sản phẩm trên URL — dùng được cả ở máy chủ và trình duyệt (không truy cập cơ sở dữ liệu).
export type PriceMode = "goc" | "km" | "ca2";

// Số SP mỗi trang (tham số ?per=). Giá trị lạ → mặc định.
export const PER_PAGE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_PER_PAGE = 50;

// Bộ lọc danh sách Sản phẩm, đọc từ URL. Danh sách và Xuất Excel dùng chung → luôn khớp nhau.
export type ProductFilter = { q?: string; cat?: number; brand?: number; pmin?: number; pmax?: number; pmode?: PriceMode; status?: string };
export type ProductSearchParams = Partial<Record<"q" | "cat" | "brand" | "pmin" | "pmax" | "pmode" | "status" | "page" | "per", string>>;
export const FILTER_KEYS = ["q", "cat", "brand", "pmin", "pmax", "pmode", "status"] as const;

const wholeNum = (s?: string) => (s && Number.isSafeInteger(Number(s)) && Number(s) >= 0 ? Number(s) : undefined);
export function parseProductFilter(sp: ProductSearchParams): ProductFilter {
  return {
    q: sp.q, cat: Number(sp.cat) || undefined, brand: Number(sp.brand) || undefined,
    pmin: wholeNum(sp.pmin), pmax: wholeNum(sp.pmax),
    pmode: (["goc", "km", "ca2"] as const).find((m) => m === sp.pmode), status: sp.status,
  };
}
export const parsePerPage = (s?: string) => PER_PAGE_OPTIONS.find((n) => String(n) === s) ?? DEFAULT_PER_PAGE;

