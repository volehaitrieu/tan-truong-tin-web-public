import Link from "next/link";
import { ArrowRight, ChevronRight, Clock, CookingPot, Fan, MapPin, Phone } from "lucide-react";
import { BrandRotator } from "@/components/storefront/BrandRotator";
import { ShopBanner } from "@/components/storefront/ShopBanner";
import { FadeImage } from "@/components/storefront/FadeImage";
import { CategoryIcon } from "@/components/storefront/CategoryIcon";
import { ProductBrowserShell } from "@/components/storefront/ProductBrowserShell";
import { getCategories, getProducts } from "@/lib/catalog";
import { SHOP } from "@/lib/shop";
import { listProduct } from "@/lib/mock/store";

// Dữ liệu từ Supabase, làm mới mỗi 60 giây
export const revalidate = 60;

export default async function Home() {
  const [CATEGORIES, PRODUCTS] = await Promise.all([getCategories(), getProducts()]);
  const NAV_CATEGORIES = CATEGORIES.filter((category) => category.slug === "gia-dung");
  const brandCounts = new Map<string, number>();
  for (const p of PRODUCTS) if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) ?? 0) + 1);
  const BRANDS = [...brandCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
  const INDUSTRIES = [...new Set(PRODUCTS.map((p) => p.industry.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
  // Danh sách ở trang chủ: xen kẽ các ngành hàng (ngành đông sản phẩm trước) để trang đầu thấy đủ ngành, thay vì xếp theo tên.
  const byIndustry = new Map<string, typeof PRODUCTS>();
  for (const p of PRODUCTS) { const key = p.industry.trim() || "-"; byIndustry.set(key, [...(byIndustry.get(key) ?? []), p]); }
  const groups = [...byIndustry.values()].sort((a, b) => b.length - a.length);
  const SHOWCASE: typeof PRODUCTS = [];
  for (let i = 0; groups.some((g) => i < g.length); i++) for (const g of groups) if (i < g.length) SHOWCASE.push(g[i]);
  return (
    <>
      {/* Đánh dấu trang đã áp bảng màu mới (xem khối .store:has([data-theme-v2]) trong globals.css) */}
      <div hidden data-theme-v2 />
      <h1 className="sr-only">Tân Trường Tín: điện nước, kim khí, dụng cụ, quạt, gia dụng tại Nha Trang</h1>

      <ShopBanner />

      {/* Ngành hàng (lấy theo dữ liệu Excel đã nhập); máy tính có thêm menu danh mục bên trái. Đã bỏ banner theo thiết kế v2. */}
      <section className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]" aria-labelledby="h-danh-muc">
        <nav aria-label="Danh mục hàng hóa" className="relative hidden min-h-[200px] rounded-xl border border-line bg-surface p-2 shadow-[var(--shadow-soft)] lg:block">
          {NAV_CATEGORIES.map((c) => (
            <div key={c.slug} className="group/item relative rounded-lg transition-colors hover:bg-brand-tint focus-within:bg-brand-tint">
              <Link href={`/danh-muc/${c.slug}`} className="flex min-h-11 items-center gap-3 rounded-lg py-2 pl-3 pr-12 text-[13.5px] hover:text-brand">
                <CategoryIcon icon={c.icon} className="size-4 text-brand" />
                <span className="flex-1">Đồ gia dụng</span>
              </Link>
              <ChevronRight className="pointer-events-none absolute right-3 top-3.5 size-4 text-brand" aria-hidden />
              <div aria-label="Danh mục con Đồ gia dụng" className="invisible absolute left-full top-0 z-20 w-[560px] rounded-xl border border-line bg-surface p-4 opacity-0 shadow-lg transition-opacity duration-150 group-hover/item:visible group-hover/item:opacity-100 group-focus-within/item:visible group-focus-within/item:opacity-100">
                <b className="text-sm">Danh mục con</b>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(c.subcategories ?? []).map((sub) => {
                    const Icon = /quạt/i.test(sub.name) ? Fan : CookingPot;
                    return <Link key={sub.slug} href={`/danh-muc/${sub.slug}`} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-3 text-center transition-colors hover:border-brand hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                      <span className="grid size-10 place-items-center rounded-full bg-sunk text-brand"><Icon className="size-5" aria-hidden /></span>
                      <span className="text-[13px] font-semibold leading-4">{sub.name}</span>
                      <span className="num text-xs text-ink-2">{sub.count} sản phẩm</span>
                    </Link>;
                  })}
                </div>
              </div>
            </div>
          ))}
        </nav>

        <div className="min-w-0">
          <div className="mb-3 flex items-end justify-between">
            <h2 id="h-danh-muc" className="text-lg font-bold sm:text-[22px]">Danh mục</h2>
            <a href="#tat-ca" className="flex min-h-11 items-center gap-1 text-sm font-semibold text-brand">Tất cả sản phẩm <ArrowRight className="size-4" aria-hidden /></a>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-3 xl:grid-cols-6">
            {INDUSTRIES.map((industry) => {
              const count = PRODUCTS.filter((p) => p.industry.trim() === industry).length;
              const icon: "fan" | "home" = /quạt/i.test(industry) ? "fan" : "home";
              return (
                <Link key={industry} href={`/danh-muc?industry=${encodeURIComponent(industry)}`} className="flex min-h-24 min-w-0 flex-col items-center rounded-xl border border-line bg-surface px-1 py-2.5 text-center sm:px-2 sm:py-3 shadow-[var(--shadow-soft)] transition-colors duration-150 hover:border-brand-line hover:bg-brand-tint active:bg-brand-tint">
                  <span className="grid size-11 place-items-center rounded-full bg-sunk text-brand"><CategoryIcon icon={icon} className="size-6" /></span>
                  <span className="mt-1.5 break-words text-xs font-semibold leading-4 [overflow-wrap:anywhere] sm:mt-2 sm:text-[13px]">{industry}</span>
                  <span className="num mt-0.5 hidden text-xs text-ink-2 sm:block">{count} sản phẩm</span>
                </Link>
              );
            })}
          </div>
          {INDUSTRIES.length === 0 && <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">Danh sách ngành hàng đang được cập nhật.</p>}
        </div>
      </section>

      {/* Tất cả sản phẩm */}
      <section id="tat-ca" className="mt-10 scroll-mt-32" aria-labelledby="h-tat-ca">
        <ProductBrowserShell products={SHOWCASE.map(listProduct)} categories={CATEGORIES} showSort={false} showSale />
      </section>

      {/* Thương hiệu: 4 hãng một lần, tự sang 4 hãng kế tiếp sau 3 giây (BrandRotator) */}
      <section className="mt-10" aria-labelledby="h-thuong-hieu">
        <h2 id="h-thuong-hieu" className="mb-3 text-lg font-bold sm:text-[22px]">Thương hiệu</h2>
        <BrandRotator brands={BRANDS} />
      </section>

      {/* Ghé cửa hàng */}
      <section className="mt-10 grid overflow-hidden rounded-xl border border-line bg-sunk sm:grid-cols-2" aria-labelledby="h-cua-hang">
        <div className="p-5 sm:p-8">
          <h2 id="h-cua-hang" className="text-lg font-bold sm:text-[22px]">Ghé cửa hàng</h2>
          <p className="mt-3 flex gap-2 text-[15px]"><MapPin className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />379 đường 2/4, phường Bắc Nha Trang, tỉnh Khánh Hòa</p>
          <p className="mt-2 flex gap-2 text-[15px] text-ink-2"><Clock className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />Mở cửa {SHOP.hours} hằng ngày</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
            <a href="tel:0948732064" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-deep active:scale-[0.98]"><Phone className="size-4" aria-hidden />Gọi ngay {SHOP.phone}</a>
            <a href="https://www.google.com/maps/search/?api=1&query=379+%C4%91%C6%B0%E1%BB%9Dng+2%2F4+Nha+Trang" target="_blank" rel="noopener" className="inline-flex h-12 items-center justify-center rounded-full border border-brand bg-white px-6 font-semibold text-brand hover:bg-brand-tint">Chỉ đường</a>
          </div>
        </div>
        <div className="relative aspect-[4/3] overflow-hidden bg-sunk sm:aspect-auto sm:min-h-full">
          <FadeImage src="/shop/mat-tien.webp" alt="Mặt tiền cửa hàng Tân Trường Tín, 379 đường 2/4, Nha Trang" sizes="(min-width: 640px) 50vw, 100vw" />
        </div>
      </section>
    </>
  );
}
