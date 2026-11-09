"use client";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { posSell, type PosResult } from "./actions";
import { formatVnd } from "@/lib/shop";
import { ProductThumb } from "@/components/admin/ProductCell";

export type PosProduct = { id: number; sku: string; name: string; unit: string; price: number; stock: number; image: string | null };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();

export function PosClient({ products }: { products: PosProduct[] }) {
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [phone, setPhone] = useState("");
  const [given, setGiven] = useState("");
  const [result, setResult] = useState<PosResult | null>(null);
  const [pending, start] = useTransition();

  const found = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return products.filter((p) => words.every((w) => norm(`${p.name} ${p.sku}`).includes(w))).slice(0, 24);
  }, [q, products]);
  const lines = Object.entries(cart).map(([id, qty]) => ({ p: products.find((x) => x.id === Number(id))!, qty })).filter((l) => l.p);
  const total = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const paid = Number(given.replace(/\D/g, "")) || 0;
  const setQty = (id: number, qty: number) => setCart((c) => {
    const n = { ...c };
    if (qty <= 0) delete n[id];
    else n[id] = Math.min(999, qty);
    return n;
  });

  function sell() {
    start(async () => {
      const r = await posSell(lines.map((l) => ({ product_id: l.p.id, qty: l.qty })), phone);
      setResult(r);
      if (r.ok) {
        setCart({});
        setGiven("");
        setPhone("");
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-lg border border-line bg-white p-3 sm:p-4">
        <label className="relative block">
          <span className="sr-only">Tìm sản phẩm</span>
          <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-2" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus placeholder="Tìm tên hoặc mã sản phẩm…" className="h-12 w-full rounded border border-line pl-10 pr-3" />
        </label>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {found.map((p) => (
            <li key={p.id}>
              <button onClick={() => setQty(p.id, (cart[p.id] ?? 0) + 1)} className="flex h-full min-h-24 w-full flex-col rounded border border-line p-2 text-left hover:border-brand hover:bg-brand-tint">
                <span className="flex gap-2">
                  <ProductThumb src={p.image} size={44} />
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[13px] font-semibold leading-snug">{p.name}</span>
                    <span className="num block truncate text-[11px] text-ink-2">Mã: {p.sku}</span>
                  </span>
                </span>
                <span className="num mt-auto pt-1 text-sm font-bold text-danger">{formatVnd(p.price)}</span>
                <span className={`num text-xs ${p.stock > 0 ? "text-ink-2" : "text-ask"}`}>Tồn {p.stock}</span>
              </button>
            </li>
          ))}
        </ul>
        {found.length === 0 && <p className="mt-4 text-center text-sm text-ink-2">Không tìm thấy sản phẩm.</p>}
      </section>

      <section className="h-fit rounded-lg border border-line bg-white p-3 sm:p-4 lg:sticky lg:top-20">
        <h2 className="font-semibold">Đơn tại quầy</h2>
        {lines.length === 0 ? <p className="py-6 text-center text-sm text-ink-2">Bấm vào sản phẩm để thêm.</p> : (
          <ul className="mt-2 divide-y divide-line">
            {lines.map(({ p, qty }) => (
              <li key={p.id} className="py-2">
                <div className="flex items-start justify-between gap-2 text-sm"><span className="flex min-w-0 gap-2"><ProductThumb src={p.image} size={36} /><span className="min-w-0">{p.name}<small className="num block text-xs text-ink-2">Mã: {p.sku}</small></span></span><b className="num">{formatVnd(p.price * qty)}</b></div>
                <div className="mt-1 flex items-center gap-2">
                  <button aria-label="Bớt" onClick={() => setQty(p.id, qty - 1)} className="grid size-10 place-items-center rounded border border-line"><Minus className="size-4" /></button>
                  <span className="num w-8 text-center">{qty}</span>
                  <button aria-label="Thêm" onClick={() => setQty(p.id, qty + 1)} className="grid size-10 place-items-center rounded border border-line"><Plus className="size-4" /></button>
                  <span className="num text-xs text-ink-2">× {formatVnd(p.price)}</span>
                  <button aria-label="Xóa" onClick={() => setQty(p.id, 0)} className="ml-auto grid size-10 place-items-center text-ink-2 hover:text-danger"><Trash2 className="size-4" /></button>
                </div>
                {qty > p.stock && <p className="text-xs text-ask">Tồn chỉ còn {p.stock} — đơn sẽ gắn cờ “cần đặt hàng”.</p>}
              </li>
            ))}
          </ul>
        )}
        <label className="mt-3 block text-sm">SĐT khách (không bắt buộc)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" maxLength={14} className="num mt-1 h-11 w-full rounded border border-line px-3" />
        </label>
        <p className="mt-3 flex items-baseline justify-between font-bold">Tổng tiền <span className="num text-xl text-danger">{formatVnd(total)}</span></p>
        <label className="mt-2 block text-sm">Tiền khách đưa
          <input value={given} onChange={(e) => setGiven(e.target.value)} inputMode="numeric" maxLength={12} className="num mt-1 h-11 w-full rounded border border-line px-3" />
        </label>
        {paid > 0 && <p className={`num mt-1 text-sm ${paid >= total ? "" : "text-danger"}`}>{paid >= total ? <>Tiền thối: <b>{formatVnd(paid - total)}</b></> : `Còn thiếu ${formatVnd(total - paid)}`}</p>}
        <button disabled={pending || lines.length === 0} onClick={sell} className="mt-4 h-12 w-full rounded bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-50">{pending ? "Đang lưu…" : "Hoàn tất bán"}</button>
        {result && !result.ok && <p role="alert" className="mt-2 text-sm text-danger">{result.error}</p>}
        {result?.ok && (
          <p role="status" className="mt-3 rounded bg-brand-tint p-3 text-sm">
            Đã bán: <Link href={`/admin/don-hang/${result.code}`} className="num font-semibold text-brand underline">{result.code}</Link> · {formatVnd(result.total)}
            {result.short && <span className="block text-ask">Có món vượt tồn — kiểm tra lại tồn kho.</span>}
            <Link href={`/admin/in-phieu/${result.code}`} className="mt-1 block font-medium text-brand">In phiếu</Link>
          </p>
        )}
      </section>
    </div>
  );
}
