import type { Metadata } from "next";
import { CustomerAuth } from "@/components/storefront/CustomerAuth";

export const metadata: Metadata = { title: "Đăng nhập" };

export default function CustomerLoginPage() {
  return <CustomerAuth mode="login" />;
}
