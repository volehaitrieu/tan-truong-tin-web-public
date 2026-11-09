import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { ProductForm } from "@/components/admin/ProductForm";
import { requireStaff } from "@/lib/auth";
import { listOptions } from "@/lib/admin/products";

export const metadata: Metadata = { title: "Thêm sản phẩm" };

export default async function NewProductPage() {
  const staff = await requireStaff("edit_products");
  const options = await listOptions();
  return (
    <>
      <PageHeader title="Thêm sản phẩm" crumbs={[{ label: "Sản phẩm", href: "/admin/san-pham" }, { label: "Thêm mới" }]} sub="Nhập SKU thủ công; sản phẩm mới được ẩn khỏi web cho đến khi bật hiển thị." />
      <ProductForm product={null} options={options} canPrice={staff.perms.has("edit_price")} canCost={staff.perms.has("view_cost")} canAdjustStock={staff.perms.has("adjust_stock")} />
    </>
  );
}
