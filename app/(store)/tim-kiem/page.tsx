import type { Metadata } from "next";
import { ProductBrowserShell } from "@/components/storefront/ProductBrowserShell";
import { listProduct } from "@/lib/mock/store";
import { getCategories, searchCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Tìm kiếm" };

export default async function SearchPage({ searchParams }: PageProps<"/tim-kiem">) {
  const { query } = await searchParams;
  const q = (Array.isArray(query) ? query[0] : query ?? "").trim();
  const [results, categories] = await Promise.all([q ? searchCatalog(q.slice(0, 100)) : [], getCategories()]);
  return (
    <>
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      <h1 className="mb-5 text-[26px] font-extrabold sm:text-[32px]">{q ? <>Kết quả cho “{q}”</> : "Tìm sản phẩm"}</h1>
      {/* Chỉ còn MỘT ô tìm kiếm: ô ở đầu trang (StoreSearch), tự điền sẵn từ khóa đang xem */}
      {q ? <ProductBrowserShell key={q} products={results.map(listProduct)} categories={categories} /> : <p className="text-ink-2">Dùng ô tìm kiếm ở đầu trang để tìm món cần mua, ví dụ “quạt treo”, “ống 21”.</p>}
    </>
  );
}
