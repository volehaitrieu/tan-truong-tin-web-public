import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Đổi mật khẩu" };

export default async function ChangePasswordPage() {
  await requireStaff();
  return (
    <>
      <PageHeader title="Đổi mật khẩu" sub="Nên đổi mật khẩu tạm ngay lần đăng nhập đầu tiên." />
      <PasswordForm />
    </>
  );
}
