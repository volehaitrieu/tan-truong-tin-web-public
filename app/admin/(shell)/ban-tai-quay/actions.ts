"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type PosResult = { ok: true; code: string; total: number; short: boolean } | { ok: false; error: string };

export async function posSell(items: { product_id: number; qty: number }[], phone: string): Promise<PosResult> {
  await requireStaff("pos_sale");
  if (!Array.isArray(items) || items.length === 0 || items.length > 100) return { ok: false, error: "Chưa chọn sản phẩm." };
  const clean = items.map((i) => ({ product_id: Number(i.product_id), qty: Number(i.qty) }));
  if (clean.some((i) => !Number.isInteger(i.product_id) || !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 999)) return { ok: false, error: "Số lượng không hợp lệ." };
  const db = await createClient();
  const { data, error } = await db.rpc("pos_create_order", { p_items: clean, p_phone: phone.slice(0, 20) || null });
  if (error) return { ok: false, error: /[À-ỹ]/.test(error.message) ? error.message : "Không tạo được đơn. Vui lòng thử lại." };
  revalidatePath("/admin/ton-kho");
  revalidatePath("/admin");
  return { ok: true, code: data.code, total: data.total, short: data.short };
}
