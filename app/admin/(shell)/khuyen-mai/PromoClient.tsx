"use client";
import { useActionState, useTransition, startTransition } from "react";
import { clearSale, setSale, type PromoState } from "./actions";
import { formatVnd } from "@/lib/shop";
import { ProductCell } from "@/components/admin/ProductCell";

export type PromoRow = { sku: string; name: string; image: string | null; price: number; sale: number; from: string | null; to: string | null; state: "Đang chạy" | "Sắp tới" | "Đã hết" };
const tone = { "Đang chạy": "bg-[#ecfdf5] text-brand", "Sắp tới": "bg-[#eff6ff] text-[#1d4ed8]", "Đã hết": "bg-sunk text-ink-2" };
const input = "mt-1 h-11 w-full rounded border border-line bg-white px-3 text-sm";

export function PromoForm({ products, today }: { products: { sku: string; name: string; price: number }[]; today: string }) {
  const [state, action, pending] = useActionState<PromoState, FormData>(setSale, {});
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
      <label className="text-sm">Sản phẩm
        <input name="sku" list="promo-products" required placeholder="Gõ tên hoặc mã…" className={input} />
        <datalist id="promo-products">{products.map((p) => <option key={p.sku} value={p.sku}>{p.name} · {formatVnd(p.price)}</option>)}</datalist>
      </label>
      <label className="text-sm">Giá khuyến mãi (đ)<input name="sale_price" required inputMode="numeric" maxLength={11} className={`${input} num`} /></label>
      <label className="text-sm">Từ ngày<input name="from" type="date" required defaultValue={today} className={input} /></label>
      <label className="text-sm">Đến ngày<input name="to" type="date" required className={input} /></label>
      <button disabled={pending} className="h-11 rounded bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Đang lưu…" : "Lưu khuyến mãi"}</button>
      {state.error && <p role="alert" className="text-sm text-danger sm:col-span-2 lg:col-span-5">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-ok sm:col-span-2 lg:col-span-5">Đã lưu khuyến mãi.</p>}
    </form>
  );
}

export function PromoList({ rows }: { rows: PromoRow[] }) {
  const [pending, start] = useTransition();
  if (!rows.length) return <p className="rounded-lg border border-line bg-white p-6 text-center text-sm text-ink-2">Chưa có sản phẩm khuyến mãi.</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line bg-white">
      {rows.map((p) => (
        <li key={p.sku} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3">
          <div className="min-w-0 flex-1 basis-full md:basis-auto">
            <ProductCell name={p.name} sku={p.sku} image={p.image} className="text-sm" extra={` · ${p.from ?? "…"} → ${p.to ?? "…"}`} />
          </div>
          <span className="text-sm"><del className="num text-ink-2">{formatVnd(p.price)}</del> <b className="num text-danger">{formatVnd(p.sale)}</b></span>
          <span className="rounded-full bg-[#fef2f2] px-2.5 py-0.5 text-xs font-semibold text-danger">-{Math.round((1 - p.sale / p.price) * 100)}%</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[p.state]}`}>{p.state}</span>
          <button disabled={pending} onClick={() => start(async () => { await clearSale(p.sku); })} className="ml-auto min-h-11 rounded border border-line px-3 text-sm disabled:opacity-50">Tắt</button>
        </li>
      ))}
    </ul>
  );
}
