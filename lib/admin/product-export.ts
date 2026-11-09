import "server-only";
import { costFromImport, filteredProducts, importPrices } from "@/lib/admin/products";
import type { ProductFilter } from "@/lib/admin/products-params";
import { TEMPLATE_COLUMNS, EXPORT_GROUPS, normalizeExportGroups } from "@/lib/excel/parse-products";
import { htmlToText } from "@/lib/rich-text";
import { isMissingTable } from "@/lib/admin/classifications";
import type { Cell } from "@/lib/excel/write-xlsx";

// Xuất Excel danh sách SP theo đúng bộ lọc đang xem (không lọc = tất cả SP).
// Cột đầu giữ đúng mẫu Nhập Excel để sửa xong nhập lại được; cột thêm ở cuối (Nhập Excel bỏ qua).
// Cột giá nhập chỉ có khi withCost (nơi gọi quyết định: chỉ chủ shop); RLS product_costs vẫn chặn người thiếu quyền view_cost.
const EXTRA_COLUMNS = ["Giá khuyến mãi", "Trạng thái", "Link ảnh"] as const;
const COST_COLUMNS = new Set<string>(["Giá nhập", "Giá nhập + 10%"]);
const BATCH = 1000; // Supabase trả tối đa 1000 dòng mỗi lần

type Row = {
  id: number; sku: string; name: string; unit: string; price: number; sale_price: number | null; is_visible: boolean;
  industry: string | null; spec_line: string | null; description: string | null; usage_guide?: string | null; warranty: string | null; origin: string | null; made_in: string | null;
  category_id: number | null; brand: { name: string } | null;
  inventory: { qty: number; min_qty: number; location: string } | null;
  images: { url: string; sort: number; is_illustration: boolean }[];
};
const COLUMNS = "id, sku, name, unit, price, sale_price, is_visible, industry, spec_line, description, warranty, origin, made_in, category_id, "
  + "brand:brands(name), inventory(qty, min_qty, location), images:product_images(url, sort, is_illustration)";

async function fetchAll(f: ProductFilter, ids: number[] | undefined, withGuide: boolean) {
  const columns = withGuide ? `${COLUMNS}, usage_guide` : COLUMNS;
  const rows: Row[] = [];
  const { db, query } = await filteredProducts(ids ? {} : f, columns);
  if (ids) {
    for (let i = 0; i < ids.length; i += 500) {
      const { data, error } = await db.from("products").select(columns).in("id", ids.slice(i, i + 500)).order("name").order("id");
      if (error) throw error;
      rows.push(...(data as unknown as Row[]));
    }
    rows.sort((a, b) => a.name.localeCompare(b.name, "vi") || a.id - b.id);
    return { db, rows };
  }
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await query.range(from, from + BATCH - 1);
    if (error) throw error;
    rows.push(...(data as unknown as Row[]));
    if (!data || data.length < BATCH) return { db, rows };
  }
}

export async function productExportSheet(f: ProductFilter, withCost: boolean, groups: string[], ids?: number[]): Promise<Cell[][]> {
  const selected = normalizeExportGroups(groups, withCost);
  // Cột Hướng dẫn sử dụng chưa có trong DB (migration chưa chạy) → xuất không có cột đó.
  let fetched: Awaited<ReturnType<typeof fetchAll>>;
  try { fetched = await fetchAll(f, ids, true); } catch (e) {
    if ((e as { code?: string })?.code !== "42703") throw e;
    fetched = await fetchAll(f, ids, false);
  }
  const { db, rows } = fetched;
  const costs = withCost && selected.includes("cost") && rows.length ? await importPrices(db, rows.map((r) => r.id)) : new Map<number, number>();
  const { data: cats, error } = await db.from("categories").select("id, parent_id, name");
  if (error) throw error;
  const catById = new Map((cats ?? []).map((c) => [c.id, c]));
  // Nhiều Phân loại (bảng liên kết): xuất "A; B" sắp theo tiếng Việt để nhập lại được. Bảng chưa có → dùng cách cũ.
  const links = new Map<number, string[]>();
  if (selected.includes("category")) {
    for (let i = 0; i < rows.length; i += 500) {
      const { data, error: linkError } = await db.from("product_classifications").select("product_id, classification_id").in("product_id", rows.slice(i, i + 500).map((r) => r.id));
      if (isMissingTable(linkError)) break;
      if (linkError) throw linkError;
      for (const l of data ?? []) { const name = catById.get(l.classification_id)?.name; if (name) links.set(l.product_id, [...(links.get(l.product_id) ?? []), name]); }
    }
  }
  const allowed = new Set<string>(EXPORT_GROUPS.filter((group) => selected.includes(group.id)).flatMap((group) => [...group.columns]));
  const columns = [...TEMPLATE_COLUMNS, ...EXTRA_COLUMNS].filter((column) => allowed.has(column) && (withCost || !COST_COLUMNS.has(column)));

  const cells = (r: Row): Record<(typeof columns)[number], Cell> => {
    const cost = costs.get(r.id) ?? null;
    // SP gắn vào danh mục con → "Danh mục" là danh mục cha; SP gắn thẳng danh mục cha → để trống "Danh mục con"
    const cat = r.category_id ? catById.get(r.category_id) : undefined;
    const parent = cat?.parent_id ? catById.get(cat.parent_id) : undefined;
    const root = parent?.parent_id ? catById.get(parent.parent_id) : undefined;
    return {
      "Mã hàng hóa": r.sku, "Tên sản phẩm": r.name, "Đơn vị tính": r.unit, "Giá bán": r.price,
      "Giá nhập": cost, "Giá nhập + 10%": cost === null ? null : costFromImport(cost),
      "Ngành hàng": r.industry, "Danh mục": root?.name ?? parent?.name ?? cat?.name ?? null, "Danh mục con": root ? parent?.name ?? null : parent && cat ? cat.name : null,
      "Phân loại": links.has(r.id) ? links.get(r.id)!.sort((a, b) => a.localeCompare(b, "vi")).join("; ") : root ? cat?.name ?? null : null,
      "Thương hiệu": r.brand?.name ?? null, "Vị trí": r.inventory?.location ?? null, "Tồn tối thiểu": r.inventory?.min_qty ?? null,
      "Thông số": r.spec_line, "Mô tả": r.description ? htmlToText(r.description) : null, "Hướng dẫn sử dụng": r.usage_guide ?? null,
      "Bảo hành": r.warranty, "Xuất xứ": r.origin, "Sản xuất tại": r.made_in,
      "Giá khuyến mãi": r.sale_price, "Tồn": r.inventory?.qty ?? 0, "Trạng thái": r.is_visible ? "Hiện" : "Ẩn",
      // Chỉ ảnh thật đã tải lên (bỏ ảnh minh họa), mỗi link một dòng trong ô
      "Link ảnh": r.images.filter((i) => !i.is_illustration).sort((a, b) => a.sort - b.sort).map((i) => i.url).join("\n") || null,
    };
  };
  return [[...columns], ...rows.map((r) => { const c = cells(r); return columns.map((k) => c[k]); })];
}
