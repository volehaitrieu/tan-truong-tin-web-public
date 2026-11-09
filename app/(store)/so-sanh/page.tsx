import type { Metadata } from "next";
import { CompareView } from "@/components/storefront/compare/CompareView";
import { getProducts } from "@/lib/catalog";
import { parseSkuParam } from "@/lib/compare";
import { listProduct } from "@/lib/mock/store";

export const metadata: Metadata = { title: "So sánh sản phẩm", robots: { index: false, follow: true } };

// Địa chỉ trang là nguồn quyết định: /so-sanh?sku=A,B. Chỉ lấy MÃ HÀNG từ địa chỉ; giá, tồn kho, thông số luôn đọc từ máy chủ.
export default async function ComparePage({ searchParams }: PageProps<"/so-sanh">) {
  const { sku } = await searchParams;
  const wanted = parseSkuParam(sku);
  // Lỗi đọc dữ liệu để error.tsx của khu bán hàng báo "không tải được" và cho thử lại, không giả thành "không tìm thấy".
  const all = wanted.length ? await getProducts() : [];
  const products = wanted.flatMap((code) => all.find((p) => p.sku.toLowerCase() === code.toLowerCase()) ?? []);
  return (
    <>
      <div hidden data-theme-v2 />
      <CompareView products={products.map(listProduct)} missing={wanted.length - products.length} />
    </>
  );
}
