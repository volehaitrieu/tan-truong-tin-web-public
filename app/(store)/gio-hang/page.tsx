import { getSettings } from "@/lib/settings";
import type { Metadata } from "next";
import { CartPanel } from "@/components/storefront/CartControls";

export const metadata: Metadata = { title: "Giỏ hàng" };

export default async function CartPage() {
  const st = await getSettings();
  return (
    <>
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      <h1 className="text-[28px] font-extrabold">Giỏ hàng</h1>
      <CartPanel shippingPolicy={st.shop.shipping_policy} />
    </>
  );
}
