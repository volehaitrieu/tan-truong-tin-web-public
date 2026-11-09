import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { getProduct } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { SHOP } from "@/lib/shop";
import { InfoCard } from "./InfoCard";

export const metadata: Metadata = { title: "Ảnh thông tin sản phẩm" };

export default async function InfoImagePage({ params }: PageProps<"/admin/san-pham/[id]/anh-thong-tin">) {
  await requireStaff();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const db = await createClient();
  const { data } = await db.from("products").select("sku").eq("id", id).maybeSingle();
  // Dùng dữ liệu như khách thấy (SP đang ẩn thì không tạo ảnh gửi khách)
  const [p, st] = await Promise.all([data ? getProduct(data.sku) : undefined, getSettings()]);
  if (!p) notFound();
  return (
    <>
      <PageHeader title="Ảnh thông tin sản phẩm" crumbs={[{ label: "Sản phẩm", href: "/admin/san-pham" }, { label: p.name, href: `/admin/san-pham/${id}` }, { label: "Ảnh thông tin" }]} />
      <InfoCard p={p} shop={{ name: st.shop.name || SHOP.name, phone: st.shop.phone || SHOP.phone, address: st.shop.address || SHOP.address }} />
    </>
  );
}
