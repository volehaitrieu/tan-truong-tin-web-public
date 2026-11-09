import "server-only";
import { createClient } from "@/lib/supabase/server";
import { firstImage } from "@/components/admin/ProductCell";

// Đọc đơn hàng cho Admin (chạy với quyền người đăng nhập — RLS chỉ cho người có quyền xử lý đơn).

export type OrderStatus = "pending" | "confirmed" | "shipping" | "ready" | "completed" | "cancelled";
export type Delivery = "pickup" | "inner" | "province" | "counter";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Chờ xác nhận", confirmed: "Đã xác nhận", shipping: "Đang giao", ready: "Sẵn sàng lấy",
  completed: "Hoàn thành", cancelled: "Đã hủy",
};
export const STATUS_TONE: Record<OrderStatus, "warn" | "info" | "ok" | "danger"> = {
  pending: "warn", confirmed: "info", shipping: "info", ready: "info", completed: "ok", cancelled: "danger",
};
export const DELIVERY_LABEL: Record<Delivery, string> = {
  pickup: "Nhận tại cửa hàng", inner: "Giao nội thành", province: "Gửi đi tỉnh", counter: "Bán tại quầy",
};
// Bước tiếp theo hợp lệ (khớp hàm order_set_status trong DB)
export const NEXT_STATUS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed"], confirmed: ["shipping", "ready"], shipping: ["completed"], ready: ["completed"],
  completed: [], cancelled: [],
};

export type OrderRow = {
  id: number; code: string; customer_name: string; phone: string; delivery: Delivery; status: OrderStatus;
  payment_method: "cod" | "cash" | "bank"; payment_status: "unpaid" | "paid"; subtotal: number; shipping_fee: number | null; needs_restock: boolean; created_at: string;
};

export async function listOrders(opts: { status?: string; q?: string }) {
  const db = await createClient();
  let query = db
    .from("orders")
    .select("id, code, customer_name, phone, delivery, status, payment_method, payment_status, subtotal, shipping_fee, needs_restock, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (opts.status && opts.status in STATUS_LABEL) query = query.eq("status", opts.status);
  const q = opts.q?.trim().slice(0, 40);
  if (q) {
    const digits = q.replace(/\D/g, "");
    // Tìm theo mã đơn, SĐT hoặc tên — giá trị được làm sạch trước khi đưa vào bộ lọc
    const safe = q.replace(/[^\p{L}\p{N} ]/gu, "");
    const ors = [`code.ilike.%${safe.toUpperCase()}%`, `customer_name.ilike.%${safe}%`];
    if (digits.length >= 3) ors.push(`phone.like.%${digits}%`);
    query = query.or(ors.join(","));
  }
  const { data, error } = await query;
  if (error) throw error;
  return data as OrderRow[];
}

export async function countByStatus() {
  const db = await createClient();
  const { data } = await db.from("orders").select("status").gte("created_at", new Date(Date.now() - 90 * 864e5).toISOString());
  const counts: Partial<Record<OrderStatus, number>> = {};
  for (const r of data ?? []) counts[r.status as OrderStatus] = (counts[r.status as OrderStatus] ?? 0) + 1;
  return counts;
}

export async function getOrder(code: string) {
  if (!/^TTT\d{6}$/.test(code)) return null;
  const db = await createClient();
  const { data: o } = await db.from("orders").select("*").eq("code", code).maybeSingle();
  if (!o) return null;
  const [{ data: items }, { data: events }] = await Promise.all([
    db.from("order_items").select("id, sku, name, unit, unit_price, qty").eq("order_id", o.id).order("id"),
    db.from("order_events").select("id, type, note, created_at").eq("order_id", o.id).order("created_at"),
  ]);
  // Ảnh SP theo mã (đơn chỉ lưu tên + mã lúc bán)
  const skus = [...new Set((items ?? []).map((i) => i.sku))];
  const { data: imgs } = skus.length ? await db.from("products").select("sku, images:product_images(url, sort)").in("sku", skus) : { data: [] };
  const img = new Map(((imgs ?? []) as { sku: string; images: { url: string; sort: number }[] }[]).map((p) => [p.sku, firstImage(p.images)]));
  return { ...(o as OrderRow & Record<string, unknown>), items: (items ?? []).map((i) => ({ ...i, image: img.get(i.sku) ?? null })), events: events ?? [] } as OrderRow & {
    email: string | null; province: string | null; ward: string | null; street: string | null; note: string | null;
    tracking_code: string | null;
    items: { id: number; sku: string; name: string; unit: string; unit_price: number; qty: number; image: string | null }[];
    events: { id: number; type: string; note: string | null; created_at: string }[];
  };
}

export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
