"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: boolean; error?: string };
const vi = (m?: string) => (m && /[À-ỹ]/.test(m) ? m : "Không thực hiện được. Vui lòng thử lại.");

export async function createRound(_: Result, form: FormData): Promise<Result> {
  const me = await requireStaff();
  if (me.role !== "owner") return { ok: false, error: "Chỉ chủ shop được tạo đợt kiểm kho." };
  const name = String(form.get("name") ?? "").trim().slice(0, 100);
  const cat = String(form.get("category") ?? "") || null;
  const db = await createClient();
  const { data, error } = await db.rpc("count_create", { p_name: name, p_category_slug: cat });
  if (error) return { ok: false, error: vi(error.message) };
  redirect(`/admin/kiem-kho?dot=${data}`);
}

export async function saveCount(countId: number, productId: number, qty: number): Promise<Result> {
  await requireStaff("count_stock");
  if (!Number.isInteger(qty) || qty < 0 || qty > 100000) return { ok: false, error: "Số đếm không hợp lệ." };
  const db = await createClient();
  const { error } = await db.rpc("count_set", { p_count_id: countId, p_product_id: productId, p_qty: qty });
  revalidatePath(`/admin/kiem-kho/${countId}/dem`);
  return error ? { ok: false, error: vi(error.message) } : { ok: true };
}

export async function closeRound(countId: number): Promise<Result> {
  await requireStaff();
  const db = await createClient();
  const { error } = await db.rpc("count_close", { p_count_id: countId });
  revalidatePath("/admin/kiem-kho");
  revalidatePath("/admin/ton-kho");
  return error ? { ok: false, error: vi(error.message) } : { ok: true };
}
