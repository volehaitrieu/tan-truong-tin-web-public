import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddStaffForm, PermissionMatrix, StaffList } from "./StaffClient";

export const metadata: Metadata = { title: "Nhân viên & quyền" };

export default async function StaffPage() {
  const me = await requireStaff("manage_staff");
  const db = await createClient();
  const [{ data: people }, { data: perms }, { data: rp }] = await Promise.all([
    db.from("profiles").select("id, full_name, phone, role, is_active").order("role").order("full_name"),
    db.from("permissions").select("key, label").order("sort"),
    db.from("role_permissions").select("role, permission, allowed"),
  ]);
  const matrix: Record<string, Record<string, boolean>> = {};
  for (const r of rp ?? []) (matrix[r.role] ??= {})[r.permission] = r.allowed;

  return (
    <>
      <PageHeader title="Nhân viên & quyền" sub="Nhân viên đăng nhập bằng số điện thoại + mật khẩu." />
      <h2 className="mb-2 font-semibold">Thêm nhân viên</h2>
      <AddStaffForm />
      <h2 className="mb-2 mt-6 font-semibold">Danh sách nhân viên</h2>
      <StaffList people={people ?? []} meId={me.id} />
      <h2 className="mb-2 mt-6 font-semibold">Bảng quyền theo vai trò</h2>
      <PermissionMatrix perms={perms ?? []} matrix={matrix} editable={me.role === "owner"} />
    </>
  );
}
