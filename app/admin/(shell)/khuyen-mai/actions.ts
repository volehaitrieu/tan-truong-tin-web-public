"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PromoState = { ok?: boolean; error?: string };
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// Đặt giá KM cho 1 SP. Quyền: edit_price (trigger trong DB kiểm lại).
export async function setSale(_: PromoState, form: FormData): Promise<PromoState> {
  await requireStaff("edit_price");
  const sku = String(form.get("sku") ?? "").trim().toUpperCase();
  const sale = Number(String(form.get("sale_price") ?? "").replace(/\D/g, ""));
  const from = String(form.get("from") ?? "");
  const to = String(form.get("to") ?? "");
  if (!/^[A-Z0-9-]{2,42}$/.test(sku)) return { error: "Chọn sản phẩm." };
  if (!isDate(from) || !isDate(to) || to < from) return { error: "Ngày bắt đầu/kết thúc chưa đúng." };
  const db = await createClient();
  const { data: p } = await db.from("products").select("price").eq("sku", sku).maybeSingle();
  if (!p) return { error: "Không tìm thấy sản phẩm." };
  if (!Number.isSafeInteger(sale) || sale <= 0 || sale >= p.price) return { error: "Giá khuyến mãi phải nhỏ hơn giá bán và lớn hơn 0." };
  const { error } = await db.from("products").update({ sale_price: sale, sale_from: from, sale_to: to }).eq("sku", sku).select("sku").single();
  if (error) return { error: /quyền/.test(error.message) ? error.message : "Không lưu được." };
  revalidatePath("/admin/khuyen-mai");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearSale(sku: string): Promise<PromoState> {
  await requireStaff("edit_price");
  const db = await createClient();
  const { error } = await db.from("products").update({ sale_price: null, sale_from: null, sale_to: null }).eq("sku", sku).select("sku").single();
  revalidatePath("/admin/khuyen-mai");
  revalidatePath("/", "layout");
  return error ? { error: "Không tắt được khuyến mãi." } : { ok: true };
}
