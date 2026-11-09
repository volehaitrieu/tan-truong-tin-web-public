import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireStaff } from "@/lib/auth";
import { getProductDetail, listOptions } from "@/lib/admin/products";

export const metadata: Metadata = { title: "Sửa sản phẩm" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireStaff("edit_products");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [product, options] = await Promise.all([getProductDetail(id, staff.perms.has("view_cost")), listOptions()]);
  if (!product) notFound();
  return (
    <>
      <PageHeader
        title={product.name}
        crumbs={[{ label: "Sản phẩm", href: "/admin/san-pham" }, { label: "Sửa" }]}
        sub={`Mã: ${product.sku} · ${product.visible ? "Hiển thị" : "Ẩn"}`}
      />
      <ProductForm product={product} options={options} canPrice={staff.perms.has("edit_price")} canCost={staff.perms.has("view_cost")} canAdjustStock={staff.perms.has("adjust_stock")} />
    </>
  );
}
