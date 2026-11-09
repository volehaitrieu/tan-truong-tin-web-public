import type { Metadata } from "next";
import { ProductFilters } from "@/components/admin/ProductFilters";
import { ProductTable } from "@/components/admin/ProductTable";
import { ProductExportButton } from "@/components/admin/ProductExportButton";
import { Pagination } from "@/components/admin/Pagination";
import { ButtonLink, PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { listOptions, listProducts } from "@/lib/admin/products";
import { DEFAULT_PER_PAGE, PER_PAGE_OPTIONS, parsePerPage, parseProductFilter, type ProductSearchParams } from "@/lib/admin/products-params";
import { formatNum } from "@/lib/shop";

export const metadata: Metadata = { title: "Sản phẩm" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<ProductSearchParams> }) {
  const staff = await requireStaff();
  const sp = await searchParams;
  const canEdit = staff.perms.has("edit_products");
  const canCost = staff.perms.has("view_cost");
  const [list, { categories, brands }] = await Promise.all([
    listProducts(parseProductFilter(sp), { page: Number(sp.page) || 1, perPage: parsePerPage(sp.per), withCost: canCost }),
    listOptions(),
  ]);
  return (
    <>
      <PageHeader title="Sản phẩm" sub={`${formatNum(list.total)} sản phẩm`} actions={<div className="flex flex-wrap gap-2">
        {canEdit && <ButtonLink href="/admin/san-pham/them">Thêm sản phẩm</ButtonLink>}
        {staff.perms.has("import_excel") && <ButtonLink href="/admin/nhap-excel" variant="secondary">Nhập Excel</ButtonLink>}
        <ProductExportButton total={list.total} />
      </div>} />
      <ProductFilters categories={categories} brands={brands} init={sp} />

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <ProductTable key={JSON.stringify(sp)} items={list.items} canEdit={canEdit} canCost={canCost} />
        {list.items.length === 0 && <p className="p-6 text-center text-sm text-ink-2">Không có sản phẩm nào khớp.</p>}
      </div>

      {list.total > 0 && (
        <Pagination page={list.page} pages={list.pages} perPage={list.perPage} total={list.total}
          perPageOptions={PER_PAGE_OPTIONS} defaultPerPage={DEFAULT_PER_PAGE} />
      )}
    </>
  );
}
