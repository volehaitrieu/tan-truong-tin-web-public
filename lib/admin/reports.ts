import "server-only";
import { createClient } from "@/lib/supabase/server";

// Báo cáo bán hàng trong N ngày (theo giờ VN). Đơn hủy không tính. Lãi gộp chỉ tính khi người xem đọc được giá nhập (RLS).
const TZ = "Asia/Ho_Chi_Minh";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);

export type Report = {
  days: { day: string; revenue: number; orders: number }[];
  revenue: number; orders: number; avg: number;
  profit: number | null; // null = không có quyền xem lãi
  top: { name: string; qty: number; revenue: number }[];
  byDelivery: Record<string, number>;
};

export async function buildReport(nDays: number, canProfit: boolean): Promise<Report> {
  const db = await createClient();
  const now = Date.now();
  const keys = Array.from({ length: nDays }, (_, i) => dayKey(new Date(now - (nDays - 1 - i) * 864e5)));
  const since = new Date(now - nDays * 864e5).toISOString();
  const { data: orders } = await db
    .from("orders")
    .select("id, delivery, subtotal, created_at, items:order_items(product_id, name, qty, unit_price)")
    .neq("status", "cancelled")
    .gte("created_at", since)
    .limit(10000);
  type O = { id: number; delivery: string; subtotal: number; created_at: string; items: { product_id: number | null; name: string; qty: number; unit_price: number }[] };
  const list = ((orders ?? []) as unknown as O[]).filter((o) => keys.includes(dayKey(new Date(o.created_at))));

  const days = keys.map((k) => {
    const os = list.filter((o) => dayKey(new Date(o.created_at)) === k);
    return { day: `${k.slice(8)}/${k.slice(5, 7)}`, revenue: os.reduce((s, o) => s + o.subtotal, 0), orders: os.length };
  });
  const revenue = days.reduce((s, d) => s + d.revenue, 0);
  const byDelivery: Record<string, number> = {};
  const top = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of list) {
    byDelivery[o.delivery] = (byDelivery[o.delivery] ?? 0) + 1;
    for (const it of o.items) {
      const t = top.get(it.name) ?? { name: it.name, qty: 0, revenue: 0 };
      t.qty += it.qty;
      t.revenue += it.qty * it.unit_price;
      top.set(it.name, t);
    }
  }

  let profit: number | null = null;
  if (canProfit) {
    const ids = [...new Set(list.flatMap((o) => o.items.map((i) => i.product_id)).filter(Boolean))] as number[];
    const { data: costs } = ids.length ? await db.from("product_costs").select("product_id, cost_price").in("product_id", ids) : { data: [] };
    const cost = new Map((costs ?? []).map((c) => [c.product_id, c.cost_price]));
    // Món chưa có giá nhập thì không tính vào lãi
    profit = list.reduce((s, o) => s + o.items.reduce((ss, i) => (i.product_id && cost.has(i.product_id) ? ss + i.qty * (i.unit_price - cost.get(i.product_id)!) : ss), 0), 0);
  }

  return {
    days, revenue, orders: list.length, avg: list.length ? Math.round(revenue / list.length) : 0, profit,
    top: [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 10), byDelivery,
  };
}
