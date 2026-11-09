import { Suspense } from "react";
import { CatalogBrowser } from "@/components/storefront/CatalogBrowser";
import { ProductCard } from "@/components/storefront/ProductCard";
import { PAGE_SIZE, type Product } from "@/lib/mock/store";

// Khung tạm hiện trước khi trình duyệt đọc xong địa chỉ trang (useSearchParams cần Suspense).
function CatalogFallback({ products }: { products: Product[] }) {
  return (
    <>
      <h1 className="text-[28px] font-extrabold leading-tight sm:text-[34px]">Tất cả sản phẩm</h1>
      <p className="mt-1.5 text-[15px] text-ink-2"><span className="num">{products.length}</span> sản phẩm</p>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {products.slice(0, PAGE_SIZE).map((p) => <ProductCard key={p.sku} p={p} />)}
      </div>
    </>
  );
}

export function CatalogBrowserShell({ products }: { products: Product[] }) {
  return (
    <Suspense fallback={<CatalogFallback products={products} />}>
      <CatalogBrowser products={products} />
    </Suspense>
  );
}
