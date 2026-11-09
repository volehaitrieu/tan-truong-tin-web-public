import "server-only";
import { createClient } from "@/lib/supabase/server";
import { firstImage } from "@/components/admin/ProductCell";

export type CountRound = { id: number; name: string; scope: string | null; status: "counting" | "pending" | "closed"; created_at: string; total: number; counted: number };
export type CountItem = { product_id: number; sku: string; name: string; unit: string; system_qty: number; counted_qty: number | null; counted_by: string | null; image: string | null };

export const COUNT_STATUS = { counting: "Đang đếm", pending: "Chờ chốt", closed: "Đã chốt" } as const;

export async function listRounds(): Promise<CountRound[]> {
  const db = await createClient();
  const { data } = await db
    .from("stock_counts")
    .select("id, name, scope, status, created_at, items:stock_count_items(counted_qty)")
    .order("created_at", { ascending: false })
    .limit(30);
  type R = Omit<CountRound, "total" | "counted"> & { items: { counted_qty: number | null }[] };
  return ((data ?? []) as unknown as R[]).map(({ items, ...r }) => ({ ...r, total: items.length, counted: items.filter((i) => i.counted_qty !== null).length }));
}

export async function getRound(id: number) {
  const db = await createClient();
  const { data: round } = await db.from("stock_counts").select("id, name, scope, status, created_at").eq("id", id).maybeSingle();
  if (!round) return null;
  const { data } = await db
    .from("stock_count_items")
    .select("product_id, system_qty, counted_qty, counted_by, product:products(sku, name, unit, images:product_images(url, sort))")
    .eq("count_id", id);
  type R = { product_id: number; system_qty: number; counted_qty: number | null; counted_by: string | null; product: { sku: string; name: string; unit: string; images: { url: string; sort: number }[] } };
  const rows = (data ?? []) as unknown as R[];
  const ids = [...new Set(rows.map((r) => r.counted_by).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await db.from("profiles").select("id, full_name").in("id", ids) : { data: [] };
  const who = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const items: CountItem[] = rows
    .map((r) => ({
      product_id: r.product_id, sku: r.product.sku, name: r.product.name, unit: r.product.unit.toLowerCase(), image: firstImage(r.product.images),
      system_qty: r.system_qty, counted_qty: r.counted_qty, counted_by: r.counted_by ? who.get(r.counted_by) ?? "Nhân viên" : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  return { ...(round as Omit<CountRound, "total" | "counted">), items };
}
