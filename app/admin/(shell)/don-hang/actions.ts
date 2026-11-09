"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/admin/orders";

// Hành động trên đơn. Quyền được kiểm 2 lớp: ở đây (requireStaff) và trong hàm Postgres.
export type ActionResult = { ok: boolean; error?: string };

const STATUSES: OrderStatus[] = ["confirmed", "shipping", "ready", "completed", "cancelled"];
const msg = (e: { message: string } | null) =>
  e ? (/[À-ỹ]/.test(e.message) ? e.message.replace(/"/g, "") : "Không thực hiện được. Vui lòng thử lại.") : undefined;

export async function setStatus(orderId: number, code: string, status: OrderStatus, note?: string): Promise<ActionResult> {
  await requireStaff(status === "cancelled" ? "cancel_orders" : "process_orders");
  if (!Number.isInteger(orderId) || !STATUSES.includes(status)) return { ok: false, error: "Yêu cầu không hợp lệ." };
  const db = await createClient();
  const { error } = await db.rpc("order_set_status", { p_order_id: orderId, p_status: status, p_note: note?.slice(0, 500) ?? null });
  revalidatePath(`/admin/don-hang/${code}`);
  revalidatePath("/admin/don-hang");
  return { ok: !error, error: msg(error) };
}

export async function deleteOrder(orderId: number): Promise<ActionResult> {
  const staff = await requireStaff();
  if (staff.role !== "owner") return { ok: false, error: "Chỉ chủ shop được xóa đơn hàng." };
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return { ok: false, error: "Đơn hàng không hợp lệ." };

  const db = await createClient();
  const { data, error } = await db.from("orders").delete()
    .eq("id", orderId).eq("status", "cancelled").eq("payment_status", "unpaid")
    .select("id").maybeSingle();
  if (error) return { ok: false, error: msg(error) ?? "Không xóa được đơn hàng. Vui lòng thử lại." };
  if (!data) return { ok: false, error: "Chỉ xóa được đơn đã hủy và chưa thanh toán. Hãy tải lại trang để kiểm tra trạng thái đơn." };

  revalidatePath("/admin/don-hang");
  revalidatePath("/admin/don-hang/[ma]", "page");
  return { ok: true };
}

export async function setShipping(orderId: number, code: string, fee: string, tracking: string): Promise<ActionResult> {
  await requireStaff("process_orders");
  const digits = fee.replace(/\D/g, "");
  const value = digits === "" ? null : Number(digits);
  if (value !== null && (!Number.isSafeInteger(value) || value > 10_000_000)) return { ok: false, error: "Phí ship không hợp lệ." };
  const db = await createClient();
  const { error } = await db.rpc("order_set_shipping", { p_order_id: orderId, p_fee: value, p_tracking: tracking.slice(0, 60) });
  revalidatePath(`/admin/don-hang/${code}`);
  return { ok: !error, error: msg(error) };
}

export async function markPaid(orderId: number, code: string): Promise<ActionResult> {
  await requireStaff("process_orders");
  const db = await createClient();
  const { error } = await db.rpc("order_mark_paid", { p_order_id: orderId });
  revalidatePath(`/admin/don-hang/${code}`);
  return { ok: !error, error: msg(error) };
}
