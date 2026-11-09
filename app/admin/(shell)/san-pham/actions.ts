"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sanitizeHtml } from "@/lib/rich-text";
import { costFromImport } from "@/lib/admin/products";
import { logEvent } from "@/lib/admin/audit";
import { parseProductFilter, type ProductSearchParams } from "@/lib/admin/products-params";
import type { Cell } from "@/lib/excel/write-xlsx";
import { EXPORT_GROUPS, normalizeExportGroups } from "@/lib/excel/parse-products";

export type SaveInput = {
  id: number; name: string; unit: string; categoryId: number | null; brandId: number | null; spec: string; warranty: string; origin: string; madeIn: string;
  description: string; usageGuide?: string; needTags: string; visible: boolean; min: number; location: string;
  // Chỉ gửi khi người dùng có quyền sửa giá (máy chủ kiểm lại, trigger trong DB chặn thêm lần nữa)
  price?: number; salePrice?: number | null; saleFrom?: string; saleTo?: string; cost?: number | null;
};

const isDate = (s?: string) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMoney = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 2_000_000_000;
const friendly = (m: string) => (/[À-ỹ]/.test(m) ? m : "Không lưu được. Vui lòng kiểm tra lại và thử lại.");
const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export type CreateInput = Omit<SaveInput, "id"> & { sku: string };

export async function createProduct(input: CreateInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  const staff = await requireStaff("edit_products");
  // Thêm sản phẩm luôn phải có giá thật và lưu được tồn tối thiểu/vị trí.
  if (!staff.perms.has("edit_price")) return { ok: false, error: "Bạn cần quyền sửa giá để thêm sản phẩm." };
  if (!staff.perms.has("adjust_stock")) return { ok: false, error: "Bạn cần quyền điều chỉnh tồn kho để lưu vị trí và tồn tối thiểu." };
  const sku = String(input.sku ?? "").trim().toUpperCase();
  const name = String(input.name ?? "").trim();
  if (!/^[A-Z0-9][A-Z0-9-]{1,40}$/.test(sku)) return { ok: false, error: "SKU chỉ gồm chữ in hoa, số và dấu gạch ngang (2–41 ký tự)." };
  if (name.length < 2 || name.length > 200) return { ok: false, error: "Tên sản phẩm cần từ 2 đến 200 ký tự." };
  if (typeof input.visible !== "boolean" || (input.categoryId !== null && (!Number.isSafeInteger(input.categoryId) || input.categoryId <= 0)) || (input.brandId !== null && (!Number.isSafeInteger(input.brandId) || input.brandId <= 0))) return { ok: false, error: "Danh mục, thương hiệu hoặc trạng thái sản phẩm không hợp lệ." };
  if (!isMoney(input.price) || (input.salePrice != null && !isMoney(input.salePrice)) || !isDate(input.saleFrom) || !isDate(input.saleTo)) return { ok: false, error: "Giá hoặc ngày khuyến mãi không hợp lệ." };
  if (input.salePrice != null && input.salePrice >= (input.price as number)) return { ok: false, error: "Giá khuyến mãi phải thấp hơn giá bán." };
  if (!Number.isInteger(input.min) || input.min < 0 || input.min > 100000) return { ok: false, error: "Tồn tối thiểu không hợp lệ." };
  if (input.cost != null && (!staff.perms.has("view_cost") || !isMoney(input.cost))) return { ok: false, error: "Giá nhập không hợp lệ hoặc bạn không có quyền xem giá nhập." };

  const db = await createClient();
  const { data, error } = await db.from("products").insert({
    sku, name, slug: slugify(sku), unit: String(input.unit ?? "").trim().slice(0, 30) || "Cái",
    price: input.price, sale_price: input.salePrice ?? null, sale_from: input.saleFrom || null, sale_to: input.saleTo || null,
    category_id: input.categoryId, brand_id: input.brandId,
    spec_line: String(input.spec ?? "").replace(/\r/g, "").trim().slice(0, 3000) || null,
    warranty: String(input.warranty ?? "").trim().slice(0, 100) || null, origin: String(input.origin ?? "").trim().slice(0, 100) || null,
    made_in: String(input.madeIn ?? "").trim().slice(0, 100) || null, description: sanitizeHtml(String(input.description ?? "")) || null,
    usage_guide: String(input.usageGuide ?? "").replace(/\r/g, "").trim().slice(0, 3000) || null,
    need_tags: String(input.needTags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10), is_visible: !!input.visible,
  }).select("id").single();
  if (error || !data) return { ok: false, error: error?.code === "23505" ? "SKU này đã tồn tại. Hãy nhập mã khác." : friendly(error?.message ?? "") };

  const inv = await db.from("inventory").update({ min_qty: input.min, location: String(input.location ?? "").trim().slice(0, 40) || "Kho 1" }).eq("product_id", data.id).select("product_id");
  if (inv.error || !inv.data?.length) return { ok: false, id: data.id, error: "Đã tạo sản phẩm, nhưng chưa lưu được vị trí/tồn tối thiểu. Mở lại sản phẩm để cập nhật." };
  if (input.cost != null) {
    const c = await db.from("product_costs").upsert({ product_id: data.id, import_price: input.cost, cost_price: costFromImport(input.cost) });
    if (c.error) return { ok: false, id: data.id, error: "Đã tạo sản phẩm, nhưng chưa lưu được giá nhập. Mở lại sản phẩm để cập nhật." };
  }
  revalidatePath("/admin/san-pham");
  revalidatePath("/", "layout");
  return { ok: true, id: data.id };
}

const imageBucket = "product-images";
function imagePathForProduct(productId: number, path: string) {
  return Number.isSafeInteger(productId) && productId > 0 && new RegExp(`^${productId}/[0-9a-f-]{36}\\.(jpg|png|webp|heic|heif)$`, "i").test(path);
}

export async function registerProductImage(productId: number, path: string): Promise<{ ok: boolean; image?: { id: number; url: string; sort: number; is_illustration: false }; error?: string }> {
  await requireStaff("edit_products");
  if (!imagePathForProduct(productId, path)) return { ok: false, error: "Ảnh không hợp lệ." };
  const db = await createClient();
  const fileName = path.split("/").at(-1)!;
  const { data: files } = await db.storage.from(imageBucket).list(String(productId), { search: fileName, limit: 10 });
  if (!files?.some((file) => file.name === fileName)) return { ok: false, error: "Không tìm thấy ảnh đã tải lên. Hãy thử lại." };
  const { data: current } = await db.from("product_images").select("id, sort, is_illustration").eq("product_id", productId).order("sort");
  if ((current ?? []).filter((image) => !image.is_illustration).length >= 10) {
    await db.storage.from(imageBucket).remove([path]);
    return { ok: false, error: "Mỗi sản phẩm tối đa 10 ảnh." };
  }
  // A real photo should become the cover before any imported placeholder illustration.
  const sort = (current ?? []).filter((image) => !image.is_illustration).length;
  for (const image of (current ?? []).filter((item) => item.sort >= sort).sort((a, b) => b.sort - a.sort)) {
    const shifted = await db.from("product_images").update({ sort: image.sort + 1 }).eq("id", image.id).eq("product_id", productId);
    if (shifted.error) {
      await db.storage.from(imageBucket).remove([path]);
      return { ok: false, error: friendly(shifted.error.message) };
    }
  }
  const { data: publicData } = db.storage.from(imageBucket).getPublicUrl(path);
  const { data, error } = await db.from("product_images").insert({ product_id: productId, url: publicData.publicUrl, sort }).select("id, url, sort").single();
  if (error || !data) {
    await db.storage.from(imageBucket).remove([path]);
    return { ok: false, error: friendly(error?.message ?? "") };
  }
  // Replace the import placeholder once a real product photo is available.
  await db.from("product_images").delete().eq("product_id", productId).eq("is_illustration", true);
  revalidatePath("/admin/san-pham");
  revalidatePath("/", "layout");
  return { ok: true, image: { ...data, is_illustration: false } };
}

function storagePathFromPublicUrl(url: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  try {
    const candidate = new URL(url);
    const root = new URL(base);
    const prefix = "/storage/v1/object/public/product-images/";
    if (candidate.origin !== root.origin || !candidate.pathname.startsWith(prefix)) return null;
    return decodeURIComponent(candidate.pathname.slice(prefix.length));
  } catch { return null; }
}

export async function removeProductImage(productId: number, imageId: number): Promise<{ ok: boolean; error?: string; warning?: string }> {
  await requireStaff("edit_products");
  if (!Number.isSafeInteger(productId) || productId <= 0 || !Number.isSafeInteger(imageId) || imageId <= 0) return { ok: false, error: "Ảnh không hợp lệ." };
  const db = await createClient();
  const { data: image, error: findError } = await db.from("product_images").select("id, url").eq("id", imageId).eq("product_id", productId).maybeSingle();
  if (findError || !image) return { ok: false, error: "Không tìm thấy ảnh." };
  const { error } = await db.from("product_images").delete().eq("id", imageId).eq("product_id", productId);
  if (error) return { ok: false, error: friendly(error.message) };
  const path = storagePathFromPublicUrl(image.url);
  let warning: string | undefined;
  if (path && imagePathForProduct(productId, path)) {
    const { error: storageError } = await db.storage.from(imageBucket).remove([path]);
    if (storageError) warning = "Ảnh đã được gỡ khỏi sản phẩm nhưng chưa xóa được tệp trong kho ảnh.";
  }
  const { data: remaining } = await db.from("product_images").select("id").eq("product_id", productId).order("sort");
  for (const [sort, row] of (remaining ?? []).entries()) await db.from("product_images").update({ sort }).eq("id", row.id).eq("product_id", productId);
  revalidatePath("/admin/san-pham");
  revalidatePath("/", "layout");
  return { ok: true, warning };
}

export async function reorderProductImages(productId: number, imageIds: number[]): Promise<{ ok: boolean; error?: string }> {
  await requireStaff("edit_products");
  if (!Number.isSafeInteger(productId) || productId <= 0 || !Array.isArray(imageIds) || imageIds.length > 10 || !imageIds.every(Number.isSafeInteger) || new Set(imageIds).size !== imageIds.length) return { ok: false, error: "Thứ tự ảnh không hợp lệ." };
  const db = await createClient();
  const { data, error } = await db.from("product_images").select("id").eq("product_id", productId).order("sort");
  if (error || !data || data.length !== imageIds.length || !data.every((row) => imageIds.includes(row.id))) return { ok: false, error: "Danh sách ảnh đã thay đổi. Hãy tải lại trang." };
  for (const [sort, id] of imageIds.entries()) {
    const result = await db.from("product_images").update({ sort }).eq("product_id", productId).eq("id", id);
    if (result.error) return { ok: false, error: friendly(result.error.message) };
  }
  revalidatePath("/admin/san-pham");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveProduct(input: SaveInput): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff("edit_products");
  const name = String(input.name ?? "").trim();
  if (!Number.isInteger(input.id) || name.length < 2 || name.length > 200) return { ok: false, error: "Tên sản phẩm cần từ 2 đến 200 ký tự." };
  if (!Number.isInteger(input.min) || input.min < 0 || input.min > 100000) return { ok: false, error: "Tồn tối thiểu không hợp lệ." };

  const patch: Record<string, unknown> = {
    name, unit: String(input.unit ?? "").trim().slice(0, 30) || "Cái", category_id: input.categoryId, brand_id: input.brandId,
    spec_line: String(input.spec ?? "").replace(/\r/g, "").trim().slice(0, 3000) || null, made_in: String(input.madeIn ?? "").trim().slice(0, 100) || null, warranty: String(input.warranty ?? "").trim().slice(0, 100) || null,
    origin: String(input.origin ?? "").trim().slice(0, 100) || null, description: sanitizeHtml(String(input.description ?? "")) || null,
    usage_guide: String(input.usageGuide ?? "").replace(/\r/g, "").trim().slice(0, 3000) || null,
    need_tags: String(input.needTags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10), is_visible: !!input.visible,
  };
  const wantsPrice = input.price !== undefined;
  if (wantsPrice) {
    if (!staff.perms.has("edit_price")) return { ok: false, error: "Bạn không có quyền sửa giá bán." };
    if (!isMoney(input.price) || (input.salePrice != null && !isMoney(input.salePrice)) || !isDate(input.saleFrom) || !isDate(input.saleTo))
      return { ok: false, error: "Giá hoặc ngày khuyến mãi không hợp lệ." };
    if (input.salePrice != null && input.salePrice >= (input.price as number)) return { ok: false, error: "Giá khuyến mãi phải thấp hơn giá bán." };
    if (input.cost != null && !isMoney(input.cost)) return { ok: false, error: "Giá nhập không hợp lệ." };
    Object.assign(patch, { price: input.price, sale_price: input.salePrice ?? null, sale_from: input.saleFrom || null, sale_to: input.saleTo || null });
  }
  const db = await createClient();
  const { data: updated, error } = await db.from("products").update(patch).eq("id", input.id).select("id");
  if (error) return { ok: false, error: friendly(error.message) };
  // RLS chặn thì update trả 0 dòng mà không báo lỗi — phải kiểm số dòng.
  if (!updated?.length) return { ok: false, error: "Không lưu được sản phẩm. Có thể bạn không có quyền hoặc sản phẩm đã bị xóa." };
  // Vị trí/tồn tối thiểu chỉ ghi khi có quyền điều chỉnh tồn (policy inventory_min_update).
  if (staff.perms.has("adjust_stock")) {
    const inv = await db.from("inventory").update({ min_qty: input.min, location: String(input.location ?? "").trim().slice(0, 40) || "Kho 1" }).eq("product_id", input.id).select("product_id");
    if (inv.error) return { ok: false, error: friendly(inv.error.message) };
    if (!inv.data?.length) return { ok: false, error: "Đã lưu thông tin, nhưng chưa lưu được vị trí/tồn tối thiểu." };
  }
  if (wantsPrice && input.cost != null) {
    const c = await db.from("product_costs").upsert({ product_id: input.id, import_price: input.cost, cost_price: costFromImport(input.cost) });
    if (c.error) return { ok: false, error: friendly(c.error.message) };
  }
  revalidatePath("/admin/san-pham");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteProduct(id: number): Promise<{ ok: boolean; error?: string }> {
  await requireStaff("edit_products");
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: "Sản phẩm không hợp lệ." };

  const db = await createClient();
  const { data: product, error: productError } = await db.from("products").select("id").eq("id", id).maybeSingle();
  if (productError) return { ok: false, error: "Không kiểm tra được sản phẩm. Vui lòng thử lại." };
  if (!product) return { ok: false, error: "Sản phẩm không còn tồn tại." };

  const { data: linkedOrders, error: orderError } = await db.from("order_items").select("id").eq("product_id", id).limit(1);
  if (orderError) return { ok: false, error: "Không kiểm tra được lịch sử đơn hàng. Chưa xóa sản phẩm." };
  if (linkedOrders?.length) return { ok: false, error: "Sản phẩm đã có trong đơn hàng nên không thể xóa. Bạn có thể ẩn sản phẩm thay thế." };

  const { data: images, error: imagesError } = await db.from("product_images").select("url").eq("product_id", id);
  if (imagesError) return { ok: false, error: "Không kiểm tra được ảnh sản phẩm. Chưa xóa sản phẩm." };

  const { data: deleted, error } = await db.from("products").delete().eq("id", id).select("id").maybeSingle();
  if (error) return { ok: false, error: error.code === "23503"
    ? "Sản phẩm đang được dữ liệu khác sử dụng nên chưa thể xóa."
    : friendly(error.message) };
  if (!deleted) return { ok: false, error: "Không xóa được sản phẩm. Hãy tải lại trang rồi thử lại." };

  const storedPaths = (images ?? []).map((image) => storagePathFromPublicUrl(image.url)).filter((path): path is string => !!path && imagePathForProduct(id, path));
  if (storedPaths.length) await db.storage.from(imageBucket).remove(storedPaths);

  revalidatePath("/admin/san-pham");
  revalidatePath("/", "layout");
  return { ok: true };
}

// Xem nhanh 1 SP (khung chi tiết ở danh sách Sản phẩm) — không có giá nhập/tồn
export async function getProductPreview(id: number) {
  await requireStaff();
  if (!Number.isSafeInteger(id)) return null;
  const { getPreviews } = await import("@/lib/admin/preview");
  return (await getPreviews([id]))[0] ?? null;
}

// Dữ liệu để vẽ ảnh báo giá cho nhiều SP (tối đa 200)
export async function getProductPreviews(ids: number[]) {
  await requireStaff();
  if (!Array.isArray(ids)) return [];
  const { getPreviews } = await import("@/lib/admin/preview");
  return getPreviews(ids.map(Number));
}

// Xuất Excel theo đúng bộ lọc đang xem trên trang Sản phẩm (tham số URL); cột giá nhập chỉ có khi chủ shop xuất
export async function getExportOptions() {
  const staff = await requireStaff();
  return { withCost: staff.role === "owner" };
}

export async function exportProducts(sp: ProductSearchParams, options: { ids?: number[]; groups: string[] }): Promise<{ ok: true; rows: Cell[][] } | { ok: false; error: string }> {
  const staff = await requireStaff();
  // Giá nhập chỉ xuất ra file cho chủ shop; nhân viên có quyền xem giá nhập vẫn chỉ xem trên màn hình
  const withCost = staff.role === "owner";
  if (!options || !Array.isArray(options.groups) || options.groups.length > EXPORT_GROUPS.length || options.groups.some((id) => typeof id !== "string" || !EXPORT_GROUPS.some((group) => group.id === id))) return { ok: false, error: "Nhóm cột xuất không hợp lệ." };
  if (options.ids !== undefined && (!Array.isArray(options.ids) || !options.ids.length || options.ids.length > 5000 || !options.ids.every((id) => Number.isSafeInteger(id) && id > 0))) return { ok: false, error: "Danh sách sản phẩm không hợp lệ (tối đa 5.000 sản phẩm)." };
  const ids = options.ids ? [...new Set(options.ids)] : undefined;
  const groups = normalizeExportGroups(options.groups, withCost);
  const filter = parseProductFilter(sp ?? {});
  let rows: Cell[][];
  try {
    const { productExportSheet } = await import("@/lib/admin/product-export");
    rows = await productExportSheet(filter, withCost, groups, ids);
  } catch {
    return { ok: false, error: "Không đọc được danh sách sản phẩm để xuất. Vui lòng thử lại." };
  }
  // Mỗi lần xuất phải có trong nhật ký; không ghi được thì không trả file.
  // Chữ tìm cắt 80 ký tự như lúc tìm thật, để chi tiết nhật ký không vượt giới hạn trong DB.
  const logged = await logEvent(await createClient(), "export:products", `${rows.length - 1} SP`, { filter: ids ? undefined : { ...filter, q: filter.q?.slice(0, 80) }, with_cost: withCost && groups.includes("cost"), by_ids: !!ids, groups });
  if (!logged) return { ok: false, error: "Không ghi được nhật ký xuất file. Vui lòng thử lại." };
  return { ok: true, rows };
}
