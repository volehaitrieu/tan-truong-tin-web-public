import type { Metadata } from "next";
import { ThankYou } from "@/components/storefront/ThankYou";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Đặt hàng thành công" };

export default async function ThankYouPage() {
  const st = await getSettings();
  return (
    <>
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      <ThankYou bank={st.bank} />
    </>
  );
}
