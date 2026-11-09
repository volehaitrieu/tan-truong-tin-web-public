import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader } from "@/components/admin/ui";
import { LiveSearchField } from "@/components/LiveSearchField";
import { requireStaff } from "@/lib/auth";
import { DELIVERY_LABEL, STATUS_LABEL, STATUS_TONE, countByStatus, fmtTime, listOrders, type OrderStatus } from "@/lib/admin/orders";
import { formatVnd } from "@/lib/shop";

export const metadata: Metadata = { title: "Đơn hàng" };

export default async function OrdersPage({ searchParams }: PageProps<"/admin/don-hang">) {
  await requireStaff("process_orders");
  const sp = await searchParams;
  const status = typeof sp.trang_thai === "string" ? sp.trang_thai : "";
  const q = typeof sp.q === "string" ? sp.q : "";
  const [orders, counts] = await Promise.all([listOrders({ status, q }), countByStatus()]);
  const tabs: [string, string][] = [["", "Tất cả"], ...(Object.entries(STATUS_LABEL) as [OrderStatus, string][])];
  const href = (s: string) => `/admin/don-hang?${new URLSearchParams({ ...(s && { trang_thai: s }), ...(q && { q }) })}`;

  return (
    <>
      <PageHeader title="Đơn hàng" sub={`${orders.length} đơn${status ? " · " + STATUS_LABEL[status as OrderStatus] : ""}`} />
      {/* Lọc ngay khi gõ; giữ nguyên tab trạng thái đang chọn */}
      <LiveSearchField param="q" initial={q} maxLength={40} label="Tìm đơn" placeholder="Tìm mã đơn, tên hoặc số điện thoại…"
        className="mb-3" inputClassName="h-11 rounded border border-line bg-white text-sm outline-none focus:border-brand" />
      <nav aria-label="Lọc theo trạng thái" className="mb-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {tabs.map(([id, label]) => (
          <Link key={id} href={href(id)} aria-current={status === id ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium md:min-h-9 ${status === id ? "bg-brand text-white" : "bg-white text-ink-2"}`}>
            {label}{id && counts[id as OrderStatus] ? <span className="num opacity-80">{counts[id as OrderStatus]}</span> : null}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-6 text-center text-sm text-ink-2">Chưa có đơn nào{q || status ? " khớp bộ lọc" : ""}.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-ground text-left text-xs text-ink-2">
              <tr>{["Mã đơn", "Thời gian", "Khách hàng", "Cách nhận", "Tổng tiền", "Thanh toán", "Trạng thái"].map((x) => <th key={x} className="px-3 py-3 font-semibold">{x}</th>)}</tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="h-14 border-t border-line hover:bg-ground">
                  <td className="px-3"><Link href={`/admin/don-hang/${o.code}`} className="num font-semibold text-brand hover:underline">{o.code}</Link></td>
                  <td className="num px-3 text-ink-2">{fmtTime(o.created_at)}</td>
                  <td className="px-3">{o.customer_name}<small className="num block text-ink-2">{o.phone}</small></td>
                  <td className="px-3">{DELIVERY_LABEL[o.delivery]}</td>
                  <td className="num px-3">{formatVnd(o.subtotal + (o.shipping_fee ?? 0))}{o.shipping_fee === null && <small className="block text-ask">Chưa có phí ship</small>}</td>
                  <td className="px-3">{o.payment_status === "paid" ? <Badge tone="ok">Đã thanh toán</Badge> : o.payment_method === "bank" ? "Chuyển khoản · chờ tiền" : "COD · chưa thu"}</td>
                  <td className="px-3"><Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>{o.needs_restock && <small className="mt-1 block text-ask">Cần đặt hàng</small>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/admin/don-hang/${o.code}`} className="block p-4 active:bg-ground">
                  <div className="flex justify-between gap-2"><b className="num">{o.code}</b><Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge></div>
                  <p className="mt-1 text-sm">{o.customer_name} · <span className="num">{o.phone}</span></p>
                  <p className="mt-1 text-xs text-ink-2">{DELIVERY_LABEL[o.delivery]} · {fmtTime(o.created_at)}{o.shipping_fee === null && " · chưa có phí ship"}</p>
                  <b className="num mt-2 block">{formatVnd(o.subtotal + (o.shipping_fee ?? 0))}</b>
                  <span className="mt-1 block text-xs text-ink-2">{o.payment_status === "paid" ? "Đã thanh toán" : o.payment_method === "bank" ? "Chuyển khoản · chờ tiền" : "COD · chưa thu"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
