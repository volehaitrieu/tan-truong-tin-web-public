"use server";
import { after } from "next/server";
import { getProducts } from "@/lib/catalog";
import { notifyOrder, notifyQuote } from "@/lib/notify/telegram";
import { createPublicClient } from "@/lib/supabase/public";
import type { Product } from "@/lib/mock/store";

// Hàm server cho trang bán hàng. Mọi kiểm tra tiền/số lượng nằm trong hàm Postgres (place_order…);
// ở đây chỉ chặn dữ liệu quá khổ trước khi gửi đi.
// (Gợi ý tìm kiếm không còn là server action: xem app/api/goi-y/route.ts và lib/suggest.ts.)

// Thông tin SP cho các món trong giỏ (giá luôn lấy từ DB, không tin giá lưu ở trình duyệt)
export async function cartProducts(skus: string[]): Promise<Product[]> {
  if (!Array.isArray(skus) || skus.length > 50) return [];
  const want = new Set(skus.filter((s) => typeof s === "string").map((s) => s.toUpperCase()));
  return (await getProducts()).filter((p) => want.has(p.sku));
}

export type PlaceOrderInput = {
  name: string; phone: string; email?: string; delivery: "pickup" | "inner" | "province";
  province?: string; ward?: string; street?: string; note?: string; shippingPolicy?: string; pay?: "cod" | "bank"; items: { sku: string; qty: number }[];
};
export type PlaceOrderResult = { ok: true; code: string; subtotal: number; shippingFee: number | null } | { ok: false; error: string };

const tooBig = (v: unknown) => JSON.stringify(v ?? "").length > 20000;

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  if (!input || tooBig(input)) return { ok: false, error: "Dữ liệu đơn hàng không hợp lệ." };
  const { data, error } = await createPublicClient().rpc("place_order", { payload: input });
  if (error) return { ok: false, error: friendly(error.message) };
  // Báo cho chủ shop qua Telegram SAU khi đã trả lời khách; lỗi báo tin không ảnh hưởng đơn (đơn đã lưu trong DB).
  after(async () => {
    try {
      const catalog = new Map((await getProducts()).map((p) => [p.sku.toUpperCase(), p.name]));
      await notifyOrder({
        code: String(data.code), name: input.name, phone: input.phone, delivery: input.delivery, province: input.province, ward: input.ward,
        street: input.street, note: input.note, subtotal: Number(data.subtotal) || 0, shippingFee: data.shipping_fee == null ? null : Number(data.shipping_fee),
        items: (Array.isArray(input.items) ? input.items : []).map((it) => ({ name: catalog.get(String(it.sku).toUpperCase()) ?? String(it.sku), qty: it.qty })),
      });
    } catch { /* không để lỗi báo tin ảnh hưởng gì */ }
  });
  return { ok: true, code: data.code, subtotal: data.subtotal, shippingFee: data.shipping_fee };
}

export type LookupResult = {
  code: string; status: string; delivery: string; subtotal: number; shipping_fee: number | null;
  tracking_code: string | null; items: { name: string; qty: number; unit_price: number }[];
} | null;

export async function lookupOrder(code: string, phone: string): Promise<LookupResult> {
  if (typeof code !== "string" || typeof phone !== "string" || code.length > 20 || phone.length > 20) return null;
  const { data } = await createPublicClient().rpc("lookup_order", { p_code: code, p_phone: phone });
  return (data as LookupResult) ?? null;
}

export async function submitQuote(items: string, phone: string): Promise<{ ok: boolean; error?: string }> {
  if (typeof items !== "string" || typeof phone !== "string" || items.length > 2000) return { ok: false, error: "Nội dung quá dài." };
  const { error } = await createPublicClient().rpc("submit_quote", { p_items: items, p_phone: phone });
  if (error) return { ok: false, error: friendly(error.message) };
  after(async () => { try { await notifyQuote(items, phone); } catch { /* không ảnh hưởng yêu cầu */ } });
  return { ok: true };
}

// Chỉ đưa ra trình duyệt câu báo lỗi tiếng Việt do hàm DB tự viết; lỗi kỹ thuật thì báo chung chung
function friendly(msg: string) {
  return /[À-ỹ]/.test(msg) && msg.length < 200 ? msg : "Chưa gửi được. Vui lòng thử lại hoặc gọi shop 0948 732 064.";
}
