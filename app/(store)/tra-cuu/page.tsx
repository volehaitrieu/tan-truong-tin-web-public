import type { Metadata } from "next";
import { OrderLookup } from "@/components/storefront/OrderLookup";

export const metadata: Metadata = { title: "Tra cứu đơn" };

export default async function LookupPage({ searchParams }: PageProps<"/tra-cuu">) {
  const { ma } = await searchParams;
  return (
    <div className="mx-auto max-w-2xl">
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      <h1 className="text-[28px] font-extrabold">Tra cứu đơn hàng</h1>
      <p className="mt-1 text-ink-2">Nhập mã đơn và số điện thoại bạn dùng khi đặt hàng.</p>
      <OrderLookup initialCode={typeof ma === "string" ? ma : ""} />
    </div>
  );
}
