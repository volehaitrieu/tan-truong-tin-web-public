import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock3 } from "lucide-react";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { ProductCell } from "@/components/admin/ProductCell";
import { OrderActions, ShippingForm, PaidButton } from "@/components/admin/orders/OrderActions";
import { DeleteOrderButton } from "@/components/admin/orders/DeleteOrderButton";
import { requireStaff } from "@/lib/auth";
import { DELIVERY_LABEL, NEXT_STATUS, STATUS_LABEL, STATUS_TONE, fmtTime, getOrder } from "@/lib/admin/orders";
import { formatVnd } from "@/lib/shop";

export const metadata: Metadata = { title: "Chi tiết đơn hàng" };

const EVENT_LABEL = (type: string) =>
  type === "created" ? "Đơn mới" : type === "shipping" ? "Cập nhật giao hàng" : type === "paid" ? "Đã nhận tiền"
  : type.startsWith("status:") ? STATUS_LABEL[type.slice(7) as keyof typeof STATUS_LABEL] ?? type : type;

export default async function OrderDetailPage({ params }: PageProps<"/admin/don-hang/[ma]">) {
  const staff = await requireStaff("process_orders");
  const { ma } = await params;
  const o = await getOrder(ma.toUpperCase());
  if (!o) notFound();
  const closed = o.status === "completed" || o.status === "cancelled";
  const total = o.subtotal + (o.shipping_fee ?? 0);

  return (
    <>
      <PageHeader
        title={`Đơn hàng ${o.code}`}
        crumbs={[{ label: "Đơn hàng", href: "/admin/don-hang" }, { label: o.code }]}
        sub={fmtTime(o.created_at)}
        actions={<div className="flex items-center gap-2">
          <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
          {staff.role === "owner" && o.status === "cancelled" && o.payment_status === "unpaid" && <DeleteOrderButton orderId={o.id} code={o.code} />}
        </div>}
      />
      <OrderActions orderId={o.id} code={o.code} next={NEXT_STATUS[o.status]} canCancel={!closed && staff.perms.has("cancel_orders")} />
      {o.needs_restock && <p className="mb-4 rounded-md bg-gold-tint p-3 text-sm text-gold-ink">Có món hết hàng — cần đặt hàng thêm và gọi báo khách thời gian có hàng.</p>}

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-4">
          <Card pad title="Sản phẩm">
            <ul className="divide-y divide-line">
              {o.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <ProductCell name={it.name} sku={it.sku} image={it.image} size={44} extra={<span className="block">{it.qty} × {formatVnd(it.unit_price)}</span>} />
                  <b className="num">{formatVnd(it.qty * it.unit_price)}</b>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt>Tiền hàng</dt><dd className="num">{formatVnd(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt>Phí ship</dt><dd className="num">{o.shipping_fee === null ? <span className="text-ask">Chưa có</span> : formatVnd(o.shipping_fee)}</dd></div>
              <div className="flex justify-between pt-1 text-base font-bold"><dt>Tổng tiền</dt><dd className="num">{formatVnd(total)}</dd></div>
            </dl>
          </Card>
          <Card pad title="Dòng thời gian">
            <ol className="space-y-2.5 text-sm">
              {o.events.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <Clock3 className="mt-0.5 size-4 shrink-0 text-ink-2" aria-hidden />
                  <span><span className="num text-ink-2">{fmtTime(e.created_at)}</span> · {EVENT_LABEL(e.type)}{e.note && <span className="text-ink-2"> — {e.note}</span>}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
        <div className="space-y-4">
          <Card pad title="Khách hàng">
            <b>{o.customer_name}</b>
            <p className="mt-1 text-sm"><a href={`tel:${o.phone}`} className="num text-brand">{o.phone}</a>{o.email && <span className="block text-ink-2">{o.email}</span>}</p>
            <a href={`https://zalo.me/${o.phone}`} target="_blank" rel="noopener" className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-brand">Mở Zalo</a>
            {o.note && <p className="mt-2 rounded bg-ground p-2 text-sm">Ghi chú: {o.note}</p>}
          </Card>
          <Card pad title="Giao hàng">
            <p className="text-sm font-medium">{DELIVERY_LABEL[o.delivery]}</p>
            {o.street && <p className="mt-1 text-sm text-ink-2">{o.street}, {o.ward}, {o.province}</p>}
            {closed ? (
              <p className="mt-2 text-sm">Mã vận đơn: {o.tracking_code || "—"}</p>
            ) : (
              <ShippingForm orderId={o.id} code={o.code} fee={o.shipping_fee} tracking={o.tracking_code ?? ""} />
            )}
          </Card>
          <Card pad title="Thanh toán">
            <p className="text-sm">{o.payment_method === "bank" ? "Chuyển khoản" : "COD"} · {o.payment_status === "paid" ? <b className="text-ok">Đã nhận tiền</b> : "Chưa thanh toán"}</p>
            {o.payment_status === "unpaid" && o.status !== "cancelled" && <PaidButton orderId={o.id} code={o.code} />}
            <a href={`/admin/in-phieu/${o.code}`} className="mt-3 inline-flex h-11 items-center rounded border border-line px-4 text-sm font-medium">In phiếu giao hàng</a>
          </Card>
        </div>
      </div>
    </>
  );
}
