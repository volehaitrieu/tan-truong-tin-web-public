import { getProducts, matchProducts } from "@/lib/catalog";
import { normalize, type Product } from "@/lib/mock/store";

// Gợi ý tìm kiếm: ô tìm kiếm hiện 5 dòng một lượt (trình duyệt tự chia), nên máy chủ gửi sẵn tối đa SUGGEST_LIMIT dòng
// cùng tổng số kết quả để "Xem thêm" không phải gọi lại. Giá lấy từ cùng nguồn với trang sản phẩm.
export type SuggestResult = {
  items: { sku: string; name: string; price: number }[];
  total: number;
  industries: { name: string; count: number }[];
};
const SUGGEST_LIMIT = 20;
const MAX_INDUSTRY_CHIPS = 3;
export const NO_SUGGEST: SuggestResult = { items: [], total: 0, industries: [] };

// Mỗi lần gõ dừng là một lượt gọi; đọc cả danh mục từ cơ sở dữ liệu mỗi lượt sẽ làm gợi ý chậm (~0,4–1,2 giây khi thử).
// Nên nhớ tạm danh mục trong bộ nhớ máy chủ 30 giây (giá trong gợi ý có thể cũ tối đa ngần ấy; trang sản phẩm luôn là giá chính xác).
const CATALOG_TTL_MS = 30_000;
let catalogMemo: { at: number; products: Product[] } | null = null;
async function catalog() {
  if (catalogMemo && Date.now() - catalogMemo.at < CATALOG_TTL_MS) return catalogMemo.products;
  const products = await getProducts();
  catalogMemo = { at: Date.now(), products };
  return products;
}

export async function buildSuggest(q: string): Promise<SuggestResult> {
  if (!q.trim() || q.length > 100) return NO_SUGGEST;
  const all = await catalog();
  const found = matchProducts(all, q);
  // Ngành hàng chỉ được gợi ý khi từ khóa (không dấu, ≥ 2 ký tự) nằm trong tên ngành: "ấm", "am sieu" → Ấm siêu tốc.
  const nq = normalize(q).replace(/\s+/g, " ").trim();
  const industries: SuggestResult["industries"] = [];
  if (nq.length >= 2) {
    const counts = new Map<string, number>();
    for (const p of all) {
      const name = p.industry.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    for (const [name, count] of counts) if (normalize(name).includes(nq)) industries.push({ name, count });
    industries.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
  }
  return {
    items: found.slice(0, SUGGEST_LIMIT).map((p) => ({ sku: p.sku, name: p.name, price: p.price })),
    total: found.length,
    industries: industries.slice(0, MAX_INDUSTRY_CHIPS),
  };
}
