import "server-only";
import { createClient } from "@/lib/supabase/server";
import { firstImage } from "@/components/admin/ProductCell";

export type StockRow = { id: number; sku: string; name: string; cat: string; unit: string; stock: number; min: number; image: string | null };
export type MovementRow = { id: number; when: string; who: string; what: string; delta: number; why: string };

export async function listStock(): Promise<StockRow[]> {
  const db = await createClient();
  const { data, error } = await db
    .from("products")
    .select("id, sku, name, unit, category:categories(name), inventory(qty, min_qty), images:product_images(url, sort)")
    .order("name")
    .limit(5000);
  if (error) throw error;
  type R = { id: number; sku: string; name: string; unit: string; category: { name: string } | null; inventory: { qty: number; min_qty: number } | null; images: { url: string; sort: number }[] };
  return (data as unknown as R[]).map((r) => ({
    id: r.id, sku: r.sku, name: r.name, unit: r.unit.toLowerCase(), cat: r.category?.name ?? "",
    stock: r.inventory?.qty ?? 0, min: r.inventory?.min_qty ?? 0, image: firstImage(r.images),
  }));
}

export async function listMovements(limit = 50): Promise<MovementRow[]> {
  const db = await createClient();
  const { data } = await db
    .from("inventory_movements")
    .select("id, delta, reason, note, created_at, created_by, product:products(name)")
    .order("created_at", { ascending: false })
    .limit(limit);
  type R = { id: number; delta: number; reason: string; note: string | null; created_at: string; created_by: string | null; product: { name: string } | null };
  const rows = (data ?? []) as unknown as R[];
  // Tên người làm (chỉ ai có quyền quản lý nhân viên mới đọc được hồ sơ người khác; còn lại hiện "Nhân viên")
  const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const name = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const fmt = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return rows.map((r) => ({
    id: r.id, when: fmt.format(new Date(r.created_at)), who: r.created_by ? name.get(r.created_by) ?? "Nhân viên" : "Hệ thống",
    what: r.product?.name ?? "", delta: r.delta, why: r.note ? `${r.reason} · ${r.note}` : r.reason,
  }));
}
