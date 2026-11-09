import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProductBrowserShell } from "@/components/storefront/ProductBrowserShell";
import { listProduct } from "@/lib/mock/store";
import { getCategories, getProducts } from "@/lib/catalog";

// Dữ liệu từ Supabase, làm mới mỗi 60 giây
export const revalidate = 60;

export async function generateStaticParams() {
  const categories = await getCategories();
  const slugs = categories.flatMap((category) => [
    category.slug,
    ...(category.subcategories ?? []).map((sub) => sub.slug),
  ]);
  return [...new Set(slugs)].map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/danh-muc/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const root = categories.find((category) => category.slug === slug);
  const child = categories.flatMap((category) => category.subcategories ?? []).find((subcategory) => subcategory.slug === slug);
  return { title: root?.name ?? child?.name ?? "Không tìm thấy" };
}

export default async function CategoryPage({ params }: PageProps<"/danh-muc/[slug]">) {
  const { slug } = await params;
  const [categories, all] = await Promise.all([getCategories(), getProducts()]);
  const root = categories.find((category) => category.slug === slug);
  const childParent = root ? undefined : categories.find((category) => category.subcategories?.some((subcategory) => subcategory.slug === slug));
  const child = childParent?.subcategories?.find((subcategory) => subcategory.slug === slug);
  const cat = root ?? childParent;
  if (!cat || (!root && !child)) notFound();
  const products = all.filter((product) => product.cat === cat.slug && (!child || product.sub === child.name));
  return (
    <>
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      {child && (
        <nav aria-label="Đường dẫn" className="mb-3 flex items-center gap-2 text-sm text-ink-2">
          <Link href="/danh-muc" className="inline-flex min-h-11 items-center hover:text-ink">Danh mục</Link>
          <span aria-hidden="true">/</span>
          <Link href={`/danh-muc/${cat.slug}`} className="inline-flex min-h-11 items-center hover:text-ink">{cat.name}</Link>
        </nav>
      )}
      <h1 className="mb-4 text-[28px] font-extrabold sm:text-[34px]">{child?.name ?? cat.name} · {products.length} sản phẩm</h1>
      {!child && cat.subs.length > 0 && (
        <nav aria-label={`Danh mục con của ${cat.name}`} className="mb-5 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {(cat.subcategories ?? []).filter((sub) => products.some((product) => product.sub === sub.name)).map((sub) => (
            <Link key={sub.slug} href={`/danh-muc/${sub.slug}`} className="flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] font-medium transition-colors duration-150 hover:border-brand-line hover:bg-brand-tint hover:text-brand">
              {sub.name}<span className="num text-xs text-ink-2">{sub.count}</span>
            </Link>
          ))}
        </nav>
      )}
      <ProductBrowserShell key={cat.slug} products={products.map(listProduct)} categories={categories} fixedCat={cat.slug} />
    </>
  );
}
