import type { Metadata } from "next";
import { CheckoutForm } from "@/components/storefront/CheckoutForm";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Đặt hàng" };

export default async function CheckoutPage() {
  const st = await getSettings();
  return (
    <>
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      <h1 className="text-[28px] font-extrabold">Thông tin đặt hàng</h1>
      <CheckoutForm innerFee={st.inner_ship_fee} freeFrom={st.free_ship_threshold} bankReady={!!st.bank} shippingPolicy={st.shop.shipping_policy} />
    </>
  );
}
