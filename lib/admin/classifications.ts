import "server-only";
import { plain } from "@/lib/excel/parse-products";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;
export type CatRow = { id: number; slug: string; name: string; parent_id: number | null };

export const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const PERMISSION_ERROR = "Bạn chưa có quyền tạo hoặc gắn Phân loại (cần quyền sửa sản phẩm).";
export const NOT_READY_ERROR = "Hệ thống chưa được cập nhật để lưu nhiều Phân loại. Liên hệ người quản trị kỹ thuật trước khi nhập cột Phân loại.";

// Bảng liên kết chưa có (migration 20261107000100 chưa chạy) → báo rõ, không làm hỏng phần nhập khác.
export const isMissingTable = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === "42P01" || error.code === "PGRST205" || error.code === "PGRST200" || /product_classifications/.test(error.message ?? ""));

// Tìm (hoặc tạo dưới đúng Danh mục con) các Phân loại theo tên. Tạo qua RLS (categories_write), không service-role;
// xử lý trùng slug kể cả khi hai lần nhập chạy đồng thời. Trả id theo đúng thứ tự tên.
export async function ensureClassifications(
  db: Db, cats: Map<number, CatRow>, usedSlugs: Set<string>, parent: CatRow, names: string[], canCreate: boolean,
): Promise<{ ok: true; ids: number[]; created: number } | { ok: false; error: string }> {
  const ids: number[] = [];
  let created = 0;
  for (const name of names) {
    const found = [...cats.values()].find((c) => c.parent_id === parent.id && plain(c.name) === plain(name));
    if (found) { ids.push(found.id); continue; }
    if (!canCreate) return { ok: false, error: PERMISSION_ERROR };
    const base = slugify(`${parent.slug}-${name}`) || `${parent.slug}-phan-loai`;
    let id: number | null = null;
    for (let suffix = 1; suffix <= 200 && id === null; suffix++) {
      const slug = suffix === 1 ? base : `${base}-${suffix}`;
      if (usedSlugs.has(slug)) continue;
      const { data, error } = await db.from("categories").insert({ parent_id: parent.id, name, slug }).select("id, parent_id, name, slug").single();
      if (error?.code === "23505") {
        const { data: siblings } = await db.from("categories").select("id, parent_id, name, slug").eq("parent_id", parent.id);
        const existing = siblings?.find((c) => plain(c.name) === plain(name));
        if (existing) { cats.set(existing.id, existing); id = existing.id; break; }
        usedSlugs.add(slug);
        continue;
      }
      if (error || !data) return { ok: false, error: error?.code === "42501" ? PERMISSION_ERROR : "Không tạo được Phân loại mới. Vui lòng thử lại." };
      cats.set(data.id, data);
      usedSlugs.add(slug);
      created++;
      id = data.id;
    }
    if (id === null) return { ok: false, error: "Không tạo được mã Phân loại không trùng. Vui lòng kiểm tra danh mục." };
    ids.push(id);
  }
  return { ok: true, ids, created };
}

// Gắn Danh mục con + thay toàn bộ Phân loại trong một giao dịch DB (hàm set_product_classifications).
export async function setClassifications(db: Db, productId: number, categoryId: number, ids: number[]): Promise<string | null> {
  const { error } = await db.rpc("set_product_classifications", { p_product_id: productId, p_category_id: categoryId, p_classification_ids: ids });
  if (!error) return null;
  if (error.code === "42501") return PERMISSION_ERROR;
  if (error.code === "PGRST202" || isMissingTable(error)) return NOT_READY_ERROR;
  return /[À-ỹ]/.test(error.message) ? error.message : "Không ghi được Phân loại.";
}

// Payload của dòng chờ "classifications" trong import_changes.new_value.
export type ClassificationChange = { sub: string; names: string[] };
export function parseClassificationChange(v: string): ClassificationChange | null {
  try {
    const x = JSON.parse(v) as unknown;
    if (x && typeof x === "object" && typeof (x as ClassificationChange).sub === "string" && Array.isArray((x as ClassificationChange).names)
      && (x as ClassificationChange).names.every((n) => typeof n === "string" && n.length > 0 && n.length <= 80) && (x as ClassificationChange).names.length <= 20)
      return { sub: (x as ClassificationChange).sub, names: (x as ClassificationChange).names };
  } catch { /* dữ liệu hỏng → null */ }
  return null;
}
