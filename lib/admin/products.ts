import "server-only";
import { createClient } from "@/lib/supabase/server";
import { firstImage } from "@/components/admin/ProductCell";
import type { ProductFilter } from "@/lib/admin/products-params";
export type { PriceMode } from "@/lib/admin/products-params";

export type ProductRow = {
  id: number; sku: string; name: string; cat: string; brand: string; price: number; salePrice: number | null;
  stock: number; min: number; location: string; visible: boolean; cost: number | null; image: string | null;
};
export type Option = { id: number; name: string };
export type BrandOption = Option & { count: number };

// Giá vốn dùng tính lãi = giá nhập + 10% chi phí
export const costFromImport = (importPrice: number) => Math.round(importPrice * 1.1);

// Bỏ ký tự đặc biệt của bộ lọc PostgREST khỏi chuỗi tìm kiếm
const cleanQuery = (q: string) => q.replace(/[,()%*\\]/g, " ").trim().slice(0, 80);
const money = (n?: number) => (n !== undefined && Number.isSafeInteger(n) && n >= 0 ? n : undefined);

// Truy vấn SP đã áp bộ lọc, sắp theo tên. `columns`: các cột cần lấy (chuỗi select của Supabase).
export async function filteredProducts(f: ProductFilter, columns: string) {
  const db = await createClient();
  let query = db.from("products").select(columns, { count: "exact" }).order("name").order("id");
  const q = cleanQuery(f.q ?? "");
  if (q) {
    const plain = q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
    query = query.ilike("search_text", `%${plain}%`);
  }
  if (f.cat) query = query.eq("category_id", f.cat);
  if (f.brand) query = query.eq("brand_id", f.brand);
  // Khoảng giá: theo giá gốc, giá khuyến mãi (bỏ SP không có KM), hoặc một trong hai
  const lo = money(f.pmin), hi = money(f.pmax);
  if (lo !== undefined || hi !== undefined) {
    const cond = (col: string) => [lo !== undefined && `${col}.gte.${lo}`, hi !== undefined && `${col}.lte.${hi}`].filter(Boolean).join(",");
    if (f.pmode === "km") query = query.not("sale_price", "is", null).or(`and(${cond("sale_price")})`);
    else if (f.pmode === "ca2") query = query.or(`and(${cond("price")}),and(${cond("sale_price")})`);
    else query = query.or(`and(${cond("price")})`);
  }
  if (f.status === "show") query = query.eq("is_visible", true);
  if (f.status === "hide") query = query.eq("is_visible", false);
  return { db, query };
}

// Giá nhập theo SP (chỉ gọi khi người xem có quyền view_cost)
export async function importPrices(db: Awaited<ReturnType<typeof createClient>>, ids: number[]) {
  const costs = new Map<number, number>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await db.from("product_costs").select("product_id, cost_price, import_price").in("product_id", ids.slice(i, i + 500));
    if (error) throw error;
    for (const x of data ?? []) costs.set(x.product_id, x.import_price ?? x.cost_price);
  }
  return costs;
}

export async function listProducts(f: ProductFilter, opts: { page: number; perPage: number; withCost: boolean }) {
  const { db, query } = await filteredProducts(f, "id, sku, name, price, sale_price, is_visible, category:categories(name), brand:brands(name), inventory(qty, min_qty, location), images:product_images(url, sort)");
  const page = Math.max(1, opts.page);
  const { data, count, error } = await query.range((page - 1) * opts.perPage, page * opts.perPage - 1);
  // Trang vượt quá số trang (link cũ, hoặc vừa xóa hết SP ở trang cuối) → Supabase báo PGRST103; hiện trang cuối thay vì lỗi.
  if (error?.code === "PGRST103" && page > 1) {
    const { count: total } = await (await filteredProducts(f, "id")).query.range(0, 0);
    const last = Math.max(1, Math.ceil((total ?? 0) / opts.perPage));
    if (last < page) return listProducts(f, { ...opts, page: last });
  }
  if (error) throw error;
  type R = { id: number; sku: string; name: string; price: number; sale_price: number | null; is_visible: boolean; category: { name: string } | null; brand: { name: string } | null; inventory: { qty: number; min_qty: number; location: string } | null; images: { url: string; sort: number }[] };
  const rows = data as unknown as R[];
  const costs = opts.withCost && rows.length ? await importPrices(db, rows.map((r) => r.id)) : new Map<number, number>();
  const items: ProductRow[] = rows.map((r) => ({
    id: r.id, sku: r.sku, name: r.name, cat: r.category?.name ?? "", brand: r.brand?.name ?? "", price: r.price, salePrice: r.sale_price,
    stock: r.inventory?.qty ?? 0, min: r.inventory?.min_qty ?? 0, location: r.inventory?.location ?? "", visible: r.is_visible,
    cost: costs.get(r.id) ?? null, image: firstImage(r.images),
  }));
  const total = count ?? items.length;
  return { items, total, page, perPage: opts.perPage, pages: Math.max(1, Math.ceil(total / opts.perPage)) };
}

export async function listOptions() {
  const db = await createClient();
  const [c, b] = await Promise.all([
    db.from("categories").select("id, name, parent_id").order("sort").order("name"),
    db.from("brands").select("id, name, products(count)").order("name"),
  ]);
  const brands = ((b.data ?? []) as unknown as { id: number; name: string; products: { count: number }[] }[])
    .map((x) => ({ id: x.id, name: x.name, count: x.products[0]?.count ?? 0 }));
  // Bỏ Phân loại (cấp 3) khỏi danh sách Danh mục: Phân loại gắn qua Nhập Excel (bảng liên kết), không qua ô Danh mục.
  const cats = (c.data ?? []) as { id: number; name: string; parent_id: number | null }[];
  const byId = new Map(cats.map((x) => [x.id, x]));
  const level2OrRoot = cats.filter((x) => x.parent_id === null || byId.get(x.parent_id)?.parent_id === null);
  return { categories: level2OrRoot.map(({ id, name }) => ({ id, name })) as Option[], brands: brands as BrandOption[] };
}

export type ProductDetail = {
  id: number; sku: string; name: string; unit: string; price: number; salePrice: number | null; saleFrom: string; saleTo: string;
  categoryId: number | null; brandId: number | null; spec: string; warranty: string; origin: string; madeIn: string; description: string; usageGuide: string;
  needTags: string; visible: boolean; stock: number; min: number; location: string; cost: number | null; updatedAt: string;
  images: ProductImage[];
  classifications: string[]; // chỉ xem trong form (mẫu F1); đổi qua Nhập Excel
};

export type ProductImage = { id: number; url: string; sort: number; is_illustration: boolean };

export async function getProductDetail(id: number, withCost: boolean): Promise<ProductDetail | null> {
  const db = await createClient();
  const { data } = await db
    .from("products")
    .select("id, sku, name, unit, price, sale_price, sale_from, sale_to, category_id, brand_id, spec_line, warranty, origin, made_in, description, usage_guide, need_tags, is_visible, updated_at, inventory(qty, min_qty, location), images:product_images(id, url, sort, is_illustration)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const d = data as unknown as {
    id: number; sku: string; name: string; unit: string; price: number; sale_price: number | null; sale_from: string | null; sale_to: string | null;
    category_id: number | null; brand_id: number | null; spec_line: string | null; warranty: string | null; origin: string | null; made_in: string | null;
    description: string | null; usage_guide: string | null; need_tags: string[]; is_visible: boolean; updated_at: string; inventory: { qty: number; min_qty: number; location: string } | null; images: ProductImage[] | null;
  };
  let cost: number | null = null;
  if (withCost) {
    const { data: c } = await db.from("product_costs").select("cost_price, import_price").eq("product_id", id).maybeSingle();
    cost = c ? c.import_price ?? c.cost_price : null;
  }
  // Phân loại đang gắn (bảng chưa có → danh sách rỗng, form vẫn mở được).
  const { data: links } = await db.from("product_classifications").select("category:categories(name)").eq("product_id", id);
  const classifications = ((links ?? []) as unknown as { category: { name: string } | null }[])
    .map((l) => l.category?.name).filter((n): n is string => !!n).sort((a, b) => a.localeCompare(b, "vi"));
  return {
    id: d.id, sku: d.sku, name: d.name, unit: d.unit, price: d.price, salePrice: d.sale_price, saleFrom: d.sale_from ?? "", saleTo: d.sale_to ?? "",
    categoryId: d.category_id, brandId: d.brand_id, spec: d.spec_line ?? "", warranty: d.warranty ?? "", origin: d.origin ?? "", madeIn: d.made_in ?? "",
    description: d.description ?? "", usageGuide: d.usage_guide ?? "", needTags: d.need_tags.join(", "), visible: d.is_visible, stock: d.inventory?.qty ?? 0, min: d.inventory?.min_qty ?? 0,
    location: d.inventory?.location ?? "Kho 1",
    cost, classifications, images: [...(d.images ?? [])].sort((a, b) => a.sort - b.sort), updatedAt: new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(d.updated_at)),
  };
}
