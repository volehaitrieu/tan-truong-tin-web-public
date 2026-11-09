import type { Metadata } from "next";
import { CustomerAuth } from "@/components/storefront/CustomerAuth";

export const metadata: Metadata = { title: "Đăng ký tài khoản" };

export default function CustomerRegisterPage() {
  return <CustomerAuth mode="register" />;
}
