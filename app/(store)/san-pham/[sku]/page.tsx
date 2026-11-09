import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Banknote, ChevronRight, ShieldCheck, Store, Truck } from "lucide-react";
import { BuyBox } from "@/components/storefront/CartControls";
import { AnimatedDisclosure } from "@/components/storefront/AnimatedDisclosure";
import { ReadMoreLines, ReadMoreSpecs } from "@/components/storefront/ReadMore";
import { ProductCard, ProductImage } from "@/components/storefront/ProductCard";
import { getCategories, getProduct, getProducts } from "@/lib/catalog";
import { formatVnd, SHOP } from "@/lib/shop";

// Dữ liệu từ Supabase, làm mới mỗi 60 giây
export const revalidate = 60;

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ sku: p.sku }));
}

export async function generateMetadata({ params }: PageProps<"/san-pham/[sku]">): Promise<Metadata> {
  const { sku } = await params;
  const p = await getProduct(sku);
  if (!p) return { title: "Không tìm thấy sản phẩm" };
  // Mô tả riêng từng sản phẩm: tên, hãng, vài thông số chính, giá, nơi mua (không đưa lời hứa nào ngoài dữ liệu thật).
  const keySpecs = ["Loại quạt", "Công suất", "Sải cánh", "Điều khiển"]
    .map((k) => p.specs.find(([name]) => name === k))
    .filter((x): x is [string, string] => !!x)
    .slice(0, 3)
    .map(([k, v]) => `${k.toLowerCase()} ${v}`)
    .join(", ");
  const description = `${p.name}${p.brand ? ` (${p.brand})` : ""}${keySpecs ? `: ${keySpecs}` : ""}. Giá ${formatVnd(p.price)}. Mua tại ${SHOP.name}, ${SHOP.addressShort}.`.slice(0, 200);
  const realImage = p.image && !p.image.startsWith("/ai/") ? p.image : undefined;
  return { title: p.name, description, openGraph: { title: p.name, description, type: "website", locale: "vi_VN", ...(realImage ? { images: [realImage] } : {}) } };
}

export default async function ProductPage({ params }: PageProps<"/san-pham/[sku]">) {
  const { sku } = await params;
  const p = await getProduct(sku);
  if (!p) notFound();
  const [categories, all] = await Promise.all([getCategories(), getProducts()]);
  const cat = categories.find((c) => c.slug === p.cat) ?? { slug: p.cat, name: p.sub };
  const related = all.filter((x) => x.cat === p.cat && x.sku !== p.sku).slice(0, 4);
  const more = related.length ? related : all.filter((x) => x.sku !== p.sku).slice(0, 4);
  const specRows: [string, string][] = [["Đơn vị tính", p.unit], ...p.specs];
  // Mỗi hàng: biểu tượng, một dòng, liên kết sang trang Chính sách có sẵn của shop
  const policyRows = [
    { Icon: Store, text: "Lấy tại cửa hàng", href: "/chinh-sach#van-chuyen" },
    { Icon: Truck, text: "Giao nội thành", href: "/chinh-sach#van-chuyen" },
    { Icon: Banknote, text: "Trả tiền mặt khi nhận hàng (COD)", href: "/chinh-sach#thanh-toan" },
    { Icon: ShieldCheck, text: `Bảo hành: ${p.warranty}`, href: "/chinh-sach#bao-hanh" },
  ];

  return (
    <>
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      <div className="grid gap-6 md:grid-cols-2 lg:gap-10">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl bg-sunk">
            <ProductImage p={p} sizes="(max-width: 768px) 100vw, 600px" priority />
          </div>
        </div>

        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-tight sm:text-[32px]">{p.name}</h1>
          <div className="mt-4 flex flex-wrap items-baseline gap-x-3">
            <b className="num text-[32px] font-extrabold text-ink">{formatVnd(p.price)}</b>
            {p.old && <del className="num text-ink-2">{formatVnd(p.old)}</del>}
            <span className="text-sm text-ink-2">/ {p.unit.toLowerCase()}</span>
          </div>

          <BuyBox sku={p.sku} name={p.name} available={p.stock} price={p.price} unit={p.unit} />

          <div className="mt-6 space-y-3">
            <AnimatedDisclosure title="Thông số" meta={`${specRows.length} mục`} className="overflow-hidden rounded-3xl bg-sunk">
              <div className="px-5 pb-5">
                <ReadMoreSpecs rows={specRows} notes={p.specNotes ?? []} />
              </div>
            </AnimatedDisclosure>

            <AnimatedDisclosure title="Mô tả & Bảo hành" className="overflow-hidden rounded-3xl border border-line">
              <div className="px-5 pb-5">
                <ReadMoreLines>
                  {p.description ? (
                    // Đã làm sạch ở server (lib/rich-text): chỉ còn thẻ định dạng cho phép
                    <div className="rich-text text-[15px] leading-6 text-ink-2" dangerouslySetInnerHTML={{ __html: p.description }} />
                  ) : (
                    <p className="text-[15px] leading-6 text-ink-2">{p.name}{p.spec ? ` — ${p.spec.toLowerCase()}` : ""}. Phù hợp dùng trong gia đình, phòng trọ và công trình nhỏ. Cần tư vấn chọn loại, gọi shop{" "}
                      <a href="tel:0948732064" className="font-semibold text-ink underline underline-offset-[3px]">0948 732 064</a>.
                    </p>
                  )}
                </ReadMoreLines>
                <p className="mt-3 text-sm"><b>Bảo hành:</b> {p.warranty}</p>
              </div>
            </AnimatedDisclosure>

            {p.usageGuide && p.usageGuide.length > 0 && (
              <AnimatedDisclosure title="Hướng dẫn sử dụng" className="overflow-hidden rounded-3xl border border-line">
                <div className="px-5 pb-5">
                  <ReadMoreLines>
                    <div>
                      <ol className="list-decimal space-y-3 pl-5 marker:font-semibold marker:text-brand">
                        {p.usageGuide.map((step, i) => (
                          <li key={i} className="text-[15px] leading-6">{step}</li>
                        ))}
                      </ol>
                      <p className="mt-4 text-sm text-ink-2">Hướng dẫn chung theo loại sản phẩm. Xem sách hướng dẫn của hãng đi kèm sản phẩm.</p>
                    </div>
                  </ReadMoreLines>
                </div>
              </AnimatedDisclosure>
            )}
          </div>

          <ul className="mt-5 overflow-hidden rounded-2xl bg-sunk">
            {policyRows.map(({ Icon, text, href }, i) => (
              <li key={text} className={i > 0 ? "border-t border-line" : ""}>
                <Link href={href} aria-label={`${text}, xem chi tiết`} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm hover:bg-brand-tint">
                  <Icon className="size-5 shrink-0 text-ink" aria-hidden />
                  <span className="min-w-0 flex-1 font-medium">{text}</span>
                  <span className="flex shrink-0 items-center gap-0.5 text-xs text-ink-2">Xem chi tiết<ChevronRight className="size-4" aria-hidden /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section id="cung-danh-muc" className="mt-10 scroll-mt-32" aria-labelledby="h-lien-quan">
        <h2 id="h-lien-quan" className="mb-4 text-[22px] font-extrabold">{related.length ? `Cùng danh mục ${cat.name}` : "Có thể bạn cần"}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {more.map((x) => <ProductCard key={x.sku} p={x} />)}
        </div>
      </section>
    </>
  );
}
