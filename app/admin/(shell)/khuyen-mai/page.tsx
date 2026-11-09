import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstImage } from "@/components/admin/ProductCell";
import { PromoForm, PromoList, type PromoRow } from "./PromoClient";

export const metadata: Metadata = { title: "Khuyến mãi" };

const todayVN = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

export default async function PromoPage() {
  await requireStaff("edit_price");
  const db = await createClient();
  const { data } = await db.from("products").select("sku, name, price, sale_price, sale_from, sale_to, images:product_images(url, sort)").order("name").limit(5000);
  const today = todayVN();
  const all = data ?? [];
  const rows: PromoRow[] = all
    .filter((p) => p.sale_price != null)
    .map((p) => ({
      sku: p.sku, name: p.name, image: firstImage(p.images), price: p.price, sale: p.sale_price!, from: p.sale_from, to: p.sale_to,
      state: p.sale_to && p.sale_to < today ? "Đã hết" : p.sale_from && p.sale_from > today ? "Sắp tới" : "Đang chạy",
    } as PromoRow))
    .sort((a, b) => ["Đang chạy", "Sắp tới", "Đã hết"].indexOf(a.state) - ["Đang chạy", "Sắp tới", "Đã hết"].indexOf(b.state));

  return (
    <>
      <PageHeader title="Khuyến mãi" sub="SP đang khuyến mãi hiện trong mục “Sản phẩm đang giảm giá” trên trang chủ." />
      <h2 className="mb-2 font-semibold">Giá khuyến mãi theo sản phẩm</h2>
      <PromoForm products={all.map((p) => ({ sku: p.sku, name: p.name, price: p.price }))} today={today} />
      <div className="mt-4"><PromoList rows={rows} /></div>
      <h2 className="mb-2 mt-6 font-semibold">Mã giảm giá</h2>
      <p className="rounded-lg border border-line bg-white p-4 text-sm">
        <span className="mr-2 rounded-full bg-gold-tint px-2 py-0.5 text-xs font-medium text-gold-ink">Sắp có</span>
        Mã giảm giá (theo % hoặc số tiền, đơn tối thiểu, số lượt) sẽ làm sau khi mở bán.
      </p>
    </>
  );
}
