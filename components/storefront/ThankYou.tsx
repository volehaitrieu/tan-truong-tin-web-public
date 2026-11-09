"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { CircleCheck } from "lucide-react";
import { OrderSteps } from "@/components/storefront/OrderSteps";
import { ORDER_KEY, type PlacedOrder } from "@/components/storefront/CheckoutForm";
import { BankQr } from "@/components/storefront/BankQr";
import type { ShopBank } from "@/lib/vietqr";
import { receiptAmounts } from "@/lib/shipping";
import { formatVnd } from "@/lib/shop";

const noop = () => () => {};
function readOrder() {
  try {
    return sessionStorage.getItem(ORDER_KEY);
  } catch {
    return null;
  }
}

export function ThankYou({ bank = null }: { bank?: ShopBank | null }) {
  const raw = useSyncExternalStore(noop, readOrder, () => undefined);
  if (raw === undefined) return null;
  const order = raw ? (JSON.parse(raw) as PlacedOrder) : null;
  if (!order)
    return (
      <div className="mx-auto max-w-xl rounded-md bg-white p-6 text-center">
        <h1 className="text-2xl font-extrabold">Chưa có đơn hàng nào</h1>
        <p className="mt-2 text-ink-2">Nếu bạn vừa đặt hàng, hãy dùng trang Tra cứu đơn với mã đơn và số điện thoại.</p>
        <Link href="/tra-cuu" className="mt-5 inline-flex h-11 items-center rounded-md bg-brand px-5 font-semibold text-white">Tra cứu đơn</Link>
      </div>
    );

  return <OrderReceipt order={order} bank={bank} />;
}

export function OrderReceipt({ order, bank }: { order: PlacedOrder; bank: ShopBank | null }) {
  const amounts = receiptAmounts(order.total, order.method, order.shippingFee);
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-md bg-white p-6 text-center sm:p-8">
        <CircleCheck className="mx-auto size-14 text-ok" aria-hidden />
        <h1 className="mt-3 text-[26px] font-extrabold">Cảm ơn bạn đã đặt hàng!</h1>
        <p className="mt-4 text-sm text-ink-2">Mã đơn hàng của bạn</p>
        <p className="num mt-1 text-[34px] font-extrabold tracking-wide text-brand">{order.code}</p>
        <p className="mt-1 text-[13px] text-ink-2">Hãy lưu lại mã này để tra cứu đơn.</p>
        <dl className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt>Tiền hàng</dt><dd className="num">{formatVnd(amounts.subtotal)}</dd></div>
          <div className="flex justify-between gap-3"><dt>Phí giao hàng</dt><dd className="num">{amounts.shippingPending ? "Shop xác nhận sau" : formatVnd(amounts.shippingFee!)}</dd></div>
          <div className="flex justify-between gap-3 border-t border-line pt-2 font-bold"><dt>{amounts.shippingPending ? "Tạm tính" : "Tổng thanh toán"}</dt><dd className="num">{formatVnd(amounts.total)}</dd></div>
        </dl>
      </div>

      <div className="mt-4 rounded-md bg-white p-5 sm:p-6">
        <h2 className="mb-4 font-bold">Trạng thái đơn</h2>
        <OrderSteps current={0} />
        <ul className="mt-5 divide-y divide-line border-t border-line text-sm">
          {order.lines.map((l) => (
            <li key={l.name} className="flex justify-between gap-3 py-2.5">
              <span>{l.name} <span className="num text-ink-2">× {l.quantity}</span></span>
              <b className="num">{formatVnd(l.price * l.quantity)}</b>
            </li>
          ))}
        </ul>
      </div>

      {order.pay === "bank" ? bank ? (
        <BankQr bank={bank} amount={amounts.total} code={order.code} shippingPending={amounts.shippingPending} />
      ) : (
        <p role="alert" className="mt-4 rounded-md bg-white p-5 text-sm text-ink-2"><b className="text-ink">Chuyển khoản:</b> tài khoản nhận tiền chưa sẵn sàng. Vui lòng gọi shop để được hướng dẫn; không chuyển theo mã QR cũ.</p>
      ) : (
        <p className="mt-4 rounded-md bg-white p-5 text-sm text-ink-2"><b className="text-ink">Thanh toán:</b> tiền mặt khi giao hoặc nhận hàng.</p>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href={`/tra-cuu?ma=${order.code}`} className="inline-flex h-12 items-center rounded-md bg-brand px-6 font-semibold text-white hover:bg-brand-deep">Tra cứu đơn</Link>
        <Link href="/" className="inline-flex h-12 items-center rounded-md border border-brand bg-white px-6 font-semibold text-brand">Tiếp tục mua</Link>
      </div>
    </div>
  );
}
