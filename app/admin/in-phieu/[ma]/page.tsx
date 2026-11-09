import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "./PrintButton";
import { requireStaff } from "@/lib/auth";
import { DELIVERY_LABEL, fmtTime, getOrder } from "@/lib/admin/orders";
import { SHOP, formatVnd } from "@/lib/shop";

export const metadata: Metadata = { title: "In phiếu giao hàng" };

// Phiếu giao hàng / xuất kho khổ A5 — in qua trình duyệt (không dùng máy in K80).
export default async function PrintSlip({ params }: PageProps<"/admin/in-phieu/[ma]">) {
  await requireStaff("process_orders");
  const { ma } = await params;
  const o = await getOrder(ma.toUpperCase());
  if (!o) notFound();
  return (
    <main className="mx-auto max-w-[560px] bg-white p-6 text-[13px] text-black print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <a href={`/admin/don-hang/${o.code}`} className="text-brand">← Quay lại đơn</a>
        <PrintButton />
      </div>
      <header className="border-b border-black pb-2">
        <b className="text-base">{SHOP.name.toUpperCase()}</b>
        <p>{SHOP.address} · {SHOP.phone}</p>
      </header>
      <h1 className="mt-3 text-center text-lg font-bold">PHIẾU GIAO HÀNG · {o.code}</h1>
      <p className="text-center">{fmtTime(o.created_at)} · {DELIVERY_LABEL[o.delivery]}</p>
      <section className="mt-3">
        <p><b>Người nhận:</b> {o.customer_name} · {o.phone}</p>
        {o.street && <p><b>Địa chỉ:</b> {o.street}, {o.ward}, {o.province}</p>}
        {o.note && <p><b>Ghi chú:</b> {o.note}</p>}
      </section>
      <table className="mt-3 w-full border-collapse">
        <thead><tr className="border-y border-black text-left"><th className="py-1">Sản phẩm</th><th>SL</th><th className="text-right">Thành tiền</th></tr></thead>
        <tbody>
          {o.items.map((it) => (
            <tr key={it.id} className="border-b border-dotted border-black/40">
              <td className="py-1">{it.name}<br /><small>{it.sku}</small></td>
              <td className="num">{it.qty} {it.unit.toLowerCase()}</td>
              <td className="num text-right">{formatVnd(it.qty * it.unit_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-right">Tiền hàng: {formatVnd(o.subtotal)}</p>
      <p className="text-right">Phí ship: {o.shipping_fee === null ? "báo sau" : formatVnd(o.shipping_fee)}</p>
      <p className="text-right text-base font-bold">Thu khách: {formatVnd(o.subtotal + (o.shipping_fee ?? 0))}{o.payment_status === "paid" && " (đã thanh toán)"}</p>
      <div className="mt-8 grid grid-cols-2 text-center"><p>Người giao</p><p>Người nhận</p></div>
    </main>
  );
}
