import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstImage } from "@/components/admin/ProductCell";
import { PosClient, type PosProduct } from "./PosClient";

export const metadata: Metadata = { title: "Bán tại quầy" };

const today = () => new Date().toISOString().slice(0, 10);

export default async function PosPage() {
  await requireStaff("pos_sale");
  const db = await createClient();
  const { data } = await db
    .from("products")
    .select("id, sku, name, unit, price, sale_price, sale_from, sale_to, inventory(qty), images:product_images(url, sort)")
    .eq("is_visible", true)
    .order("name")
    .limit(5000);
  type R = { id: number; sku: string; name: string; unit: string; price: number; sale_price: number | null; sale_from: string | null; sale_to: string | null; inventory: { qty: number } | null; images: { url: string; sort: number }[] };
  const d = today();
  const products: PosProduct[] = ((data ?? []) as unknown as R[]).map((r) => ({
    id: r.id, sku: r.sku, name: r.name, unit: r.unit, image: firstImage(r.images),
    // Giá hiển thị; server tính lại khi bán
    price: r.sale_price != null && (!r.sale_from || r.sale_from <= d) && (!r.sale_to || r.sale_to >= d) ? r.sale_price : r.price,
    stock: r.inventory?.qty ?? 0,
  }));
  return (
    <>
      <PageHeader title="Bán tại quầy" sub="Đơn tại quầy được ghi là đã thu tiền mặt và trừ tồn ngay." />
      <PosClient products={products} />
    </>
  );
}
