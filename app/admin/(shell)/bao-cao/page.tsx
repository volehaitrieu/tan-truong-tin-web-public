import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { Card, OwnerOnly, PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { buildReport } from "@/lib/admin/reports";
import { DELIVERY_LABEL, type Delivery } from "@/lib/admin/orders";
import { formatVnd } from "@/lib/shop";

export const metadata: Metadata = { title: "Báo cáo" };
const RANGES = [[7, "7 ngày"], [30, "30 ngày"], [90, "90 ngày"]] as const;

export default async function ReportPage({ searchParams }: PageProps<"/admin/bao-cao">) {
  const me = await requireStaff("view_reports");
  const { ngay } = await searchParams;
  const n = RANGES.find(([d]) => String(d) === ngay)?.[0] ?? 7;
  const canProfit = me.perms.has("view_profit") && me.perms.has("view_cost");
  const r = await buildReport(n, canProfit);
  const max = Math.max(1, ...r.days.map((d) => d.revenue));
  const showEvery = n > 14 ? Math.ceil(n / 10) : 1;
  const cards = [
    ["Doanh thu", formatVnd(r.revenue)], ["Số đơn", String(r.orders)], ["Giá trị đơn trung bình", formatVnd(r.avg)],
  ] as const;

  return (
    <>
      <PageHeader title="Báo cáo" sub="Không tính đơn đã hủy. Doanh thu = tiền hàng (chưa gồm phí ship)." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map(([d, l]) => (
          <Link key={d} href={`/admin/bao-cao?ngay=${d}`} aria-current={d === n ? "page" : undefined}
            className={`flex min-h-11 items-center rounded border px-4 text-sm ${d === n ? "border-brand bg-brand-tint font-semibold text-brand" : "border-line bg-white"}`}>{l}</Link>
        ))}
        <a href={`/admin/bao-cao/xuat?ngay=${n}`} className="ml-auto flex min-h-11 items-center gap-2 rounded border border-line bg-white px-4 text-sm"><Download className="size-4" />Xuất Excel</a>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-lg border border-line bg-white p-4"><p className="text-[13px] text-ink-2">{l}</p><p className="num mt-1 text-xl font-bold">{v}</p></div>
        ))}
        <div className="rounded-lg border border-line bg-white p-4">
          <p className="text-[13px] text-ink-2">Lãi gộp</p>
          <p className="num mt-1 text-xl font-bold">{r.profit === null ? "••••••" : formatVnd(r.profit)}</p>
          <OwnerOnly label={r.profit === null ? "Không có quyền xem" : "Món chưa có giá nhập không tính"} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card pad title="Doanh thu theo ngày">
          <div className="flex h-48 items-end gap-1 sm:gap-2" role="img" aria-label="Biểu đồ doanh thu theo ngày">
            {r.days.map((d, i) => (
              <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${formatVnd(d.revenue)} · ${d.orders} đơn`}>
                <div className="w-full max-w-10 rounded-t bg-brand" style={{ height: `${Math.max(1, (d.revenue / max) * 85)}%` }} />
                <small className="num h-4 text-[10px] text-ink-2">{i % showEvery === 0 ? d.day : ""}</small>
              </div>
            ))}
          </div>
        </Card>
        <Card pad title="Cơ cấu đơn theo cách bán">
          {Object.keys(r.byDelivery).length === 0 && <p className="text-sm text-ink-2">Chưa có đơn trong khoảng này.</p>}
          {(Object.entries(r.byDelivery) as [Delivery, number][]).map(([k, c]) => (
            <div key={k} className="mb-3">
              <div className="mb-1 flex justify-between text-sm"><span>{DELIVERY_LABEL[k]}</span><b className="num">{c} đơn</b></div>
              <div className="h-2 rounded bg-sunk"><div className="h-full rounded bg-brand" style={{ width: `${(c / r.orders) * 100}%` }} /></div>
            </div>
          ))}
        </Card>
      </div>

      <Card title={`Sản phẩm bán chạy · ${n} ngày`} className="mt-4">
        {r.top.length === 0 ? <p className="p-4 text-sm text-ink-2">Chưa có dữ liệu.</p> : (
          <ol className="divide-y divide-line">
            {r.top.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3 px-4 py-3">
                <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-brand-tint text-xs font-bold text-brand">{i + 1}</span>
                <span className="min-w-0 flex-1 text-sm font-medium">{t.name}</span>
                <span className="num w-16 text-right text-sm text-ink-2">{t.qty} bán</span>
                <b className="num w-28 text-right text-sm">{formatVnd(t.revenue)}</b>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
