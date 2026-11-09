"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { forgetStaff, requireStaff, STAFF_EMAIL_DOMAIN } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/admin/audit";

export type AddStaffState = { ok?: boolean; error?: string; phone?: string; password?: string };
const ROLES = ["order_staff", "stock_staff"] as const;

// Thêm nhân viên: chỉ người có quyền quản lý nhân viên. Tạo tài khoản bằng khóa server (Auth admin),
// mật khẩu tạm hiện 1 lần cho chủ shop đưa nhân viên.
export async function addStaff(_: AddStaffState, form: FormData): Promise<AddStaffState> {
  await requireStaff("manage_staff");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const phone = String(form.get("phone") ?? "").replace(/\D/g, "");
  const role = String(form.get("role") ?? "") as (typeof ROLES)[number];
  if (name.length < 2) return { error: "Nhập họ tên nhân viên." };
  if (!/^0\d{9}$/.test(phone)) return { error: "Số điện thoại cần 10 số, bắt đầu bằng 0." };
  if (!ROLES.includes(role)) return { error: "Chọn vai trò." };

  const admin = createAdminClient();
  const password = randomBytes(9).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({ email: `${phone}@${STAFF_EMAIL_DOMAIN}`, password, email_confirm: true });
  if (error) return { error: /already|registered|exists/i.test(error.message) ? "Số điện thoại này đã có tài khoản." : "Không tạo được tài khoản." };
  const { error: pErr } = await admin.from("profiles").insert({ id: data.user.id, full_name: name, phone, role, is_active: true });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "Không tạo được hồ sơ nhân viên." };
  }
  // Tạo bằng khóa server nên trigger không biết ai làm → ghi nhật ký bằng phiên của người đang thêm
  await logEvent(await createClient(), "insert:staff", phone, { name, role });
  revalidatePath("/admin/nhan-vien");
  return { ok: true, phone, password };
}

// Khóa / mở tài khoản: qua RLS (profiles_update cần manage_staff; trigger chặn tự khóa mình & đụng chủ shop)
export async function setActive(id: string, active: boolean) {
  await requireStaff("manage_staff");
  const db = await createClient();
  const { error } = await db.from("profiles").update({ is_active: active }).eq("id", id).select("id").single();
  forgetStaff();
  revalidatePath("/admin/nhan-vien");
  return { ok: !error, error: error ? "Không đổi được trạng thái tài khoản." : undefined };
}

// Bật/tắt quyền của một vai trò: chỉ chủ shop (RLS role_permissions_write), không đổi được quyền chủ shop
export async function setPermission(role: string, permission: string, allowed: boolean) {
  await requireStaff("manage_staff");
  if (!ROLES.includes(role as (typeof ROLES)[number])) return { ok: false, error: "Không đổi được quyền của chủ shop." };
  const db = await createClient();
  const { data, error } = await db.from("role_permissions").update({ allowed }).eq("role", role).eq("permission", permission).select("role");
  forgetStaff();
  revalidatePath("/admin/nhan-vien");
  return { ok: !error && !!data?.length, error: error || !data?.length ? "Chỉ chủ shop được đổi quyền." : undefined };
}
