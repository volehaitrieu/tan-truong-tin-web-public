import type { Metadata } from "next";
import { Boxes, PackageX, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { StockScreen } from "@/components/admin/InventoryScreens";
import { requireStaff } from "@/lib/auth";
import { listMovements, listStock } from "@/lib/admin/inventory";
import { formatNum } from "@/lib/shop";

export const metadata: Metadata = { title: "Tồn kho" };

export default async function StockPage() {
  const staff = await requireStaff();
  const [rows, history] = await Promise.all([listStock(), listMovements()]);
  const low = rows.filter((r) => r.stock > 0 && r.stock <= r.min).length;
  const out = rows.filter((r) => r.stock === 0).length;
  const cards = [
    { label: "Tổng mặt hàng", value: rows.length, icon: Boxes },
    { label: "Sắp hết", value: low, icon: TriangleAlert },
    { label: "Hết hàng", value: out, icon: PackageX },
  ];
  return (
    <>
      <PageHeader title="Tồn kho" sub="Tồn ≤ mức tối thiểu sẽ báo “Sắp hết”." />
      <div className="mb-4 grid grid-cols-3 gap-3">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-line bg-white p-3 sm:p-4">
            <p className="flex items-center justify-between text-xs text-ink-2 sm:text-sm">{label}<Icon className="size-4 text-brand" aria-hidden /></p>
            <b className="num mt-1 block text-2xl">{formatNum(value)}</b>
          </div>
        ))}
      </div>
      <StockScreen rows={rows} history={history} canAdjust={staff.perms.has("adjust_stock")} />
    </>
  );
}
