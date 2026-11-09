"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const REASONS = ["Nhập hàng", "Hư hỏng", "Thất lạc", "Trả hàng", "Kiểm kho", "Khác"];

// Điều chỉnh tồn: kiểm quyền ở đây + trong hàm adjust_stock (khóa dòng, không cho âm)
export async function adjustStock(productId: number, delta: number, reason: string, note: string): Promise<{ ok: boolean; error?: string }> {
  await requireStaff("adjust_stock");
  if (!Number.isInteger(productId) || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100000 || !REASONS.includes(reason))
    return { ok: false, error: "Dữ liệu điều chỉnh không hợp lệ." };
  const db = await createClient();
  const { error } = await db.rpc("adjust_stock", { p_product_id: productId, p_delta: delta, p_reason: reason, p_note: note.slice(0, 500) });
  revalidatePath("/admin/ton-kho");
  if (error) return { ok: false, error: /[À-ỹ]/.test(error.message) ? error.message : "Không lưu được. Vui lòng thử lại." };
  return { ok: true };
}
