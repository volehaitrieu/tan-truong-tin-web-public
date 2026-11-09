import { Suspense } from "react";
import { ProductBrowser } from "@/components/storefront/ProductBrowser";
import { ProductCard } from "@/components/storefront/ProductCard";
import { HOME_PAGE_SIZE, PAGE_SIZE, type Category, type Product } from "@/lib/mock/store";

function ProductBrowserFallback({ products, showSale }: { products: Product[]; showSale: boolean }) {
  const initialProducts = products.slice(0, showSale ? HOME_PAGE_SIZE : PAGE_SIZE);
  const saleProducts = products.filter((product) => product.old).slice(0, HOME_PAGE_SIZE);
  if (showSale) {
    const prices = ["Tất cả", "Dưới 100.000₫", "100.000₫ – 500.000₫", "500.000₫ – 1.000.000₫", "Trên 1.000.000₫"];
    const priceRow = (label: string) => <div className="mb-3"><p className="mb-2 text-sm font-semibold">Khoảng giá · {label}</p><div className="flex flex-wrap gap-2">{prices.map((price, i) => <span key={price} className={`rounded-full border px-4 py-2 text-[13px] ${i === 0 ? "border-brand bg-brand text-white" : "border-line bg-surface"}`}>{price}</span>)}</div></div>;
    return (
      <div className="min-w-0">
        <section className="mb-8" aria-labelledby="h-giam-gia">
                    {priceRow("sản phẩm giảm giá")}
          <h2 id="h-giam-gia" className="mb-4 text-lg font-bold sm:text-[22px]">Sản phẩm đang giảm giá ({saleProducts.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{saleProducts.map((product) => <ProductCard key={product.sku} p={product} />)}</div>
        </section>
        <section aria-labelledby="h-tat-ca">
                    {priceRow("tất cả sản phẩm")}
          <h2 id="h-tat-ca" className="mb-4 text-lg font-bold sm:text-[22px]">Tất cả sản phẩm ({products.length})</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{initialProducts.map((product) => <ProductCard key={product.sku} p={product} />)}</div>
        </section>
      </div>
    );
  }
  return (
    <div className="grid gap-6 md:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden h-fit rounded-md bg-surface p-4 md:block" aria-label="Bộ lọc">
        <h2 className="font-bold">Bộ lọc</h2>
        <p className="mt-2 text-sm text-ink-2">Danh mục, thương hiệu, khoảng giá và tình trạng</p>
      </aside>
      <section aria-label="Danh sách sản phẩm">
        <p className="mb-3 text-sm text-ink-2">Tìm thấy <b className="num text-ink">{products.length}</b> sản phẩm</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {initialProducts.map((product) => <ProductCard key={product.sku} p={product} />)}
        </div>
      </section>
    </div>
  );
}

export function ProductBrowserShell({ products, categories, fixedCat, showSort = true, showSale = false }: { products: Product[]; categories: Category[]; fixedCat?: string; showSort?: boolean; showSale?: boolean }) {
  return (
    <Suspense fallback={<ProductBrowserFallback products={products} showSale={showSale} />}>
      <ProductBrowser products={products} categories={categories} fixedCat={fixedCat} showSort={showSort} showSale={showSale} />
    </Suspense>
  );
}
