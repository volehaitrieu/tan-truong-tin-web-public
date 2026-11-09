import type { Metadata } from "next";
import { QuoteForm } from "@/components/storefront/QuoteForm";
import { getProduct } from "@/lib/catalog";

export const metadata: Metadata = { title: "Báo giá số lượng lớn" };

export default async function QuotePage({ searchParams }: PageProps<"/bao-gia">) {
  const { sku } = await searchParams;
  const p = typeof sku === "string" ? await getProduct(sku) : undefined;
  return (
    <div className="mx-auto max-w-xl">
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      <h1 className="text-[28px] font-extrabold">Báo giá số lượng lớn</h1>
      <p className="mt-1 text-ink-2">Ghi danh sách món cần mua và số điện thoại — shop sẽ gọi báo giá trong giờ mở cửa.</p>
      <QuoteForm initial={p ? `${p.name} × 10` : ""} />
    </div>
  );
}
