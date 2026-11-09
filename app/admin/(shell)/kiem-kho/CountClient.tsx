"use client";
import Link from "next/link";
import { useActionState, useState, useTransition, startTransition } from "react";
import { Check, LockKeyhole, Minus, Plus, Search } from "lucide-react";
import { closeRound, createRound, saveCount } from "./actions";
import type { CountItem } from "@/lib/admin/counts";
import { ProductCell } from "@/components/admin/ProductCell";

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded px-4 text-sm font-semibold disabled:opacity-50";

export function CreateRoundForm({ categories }: { categories: { slug: string; name: string }[] }) {
  const [state, action, pending] = useActionState(createRound, { ok: false });
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-[1fr_220px_auto] sm:items-end">
      <label className="text-sm">Tên đợt<input name="name" required maxLength={100} placeholder="Ví dụ: Kiểm kệ quạt tháng 10" className="mt-1 h-11 w-full rounded border border-line px-3" /></label>
      <label className="text-sm">Phạm vi
        <select name="category" className="mt-1 h-11 w-full rounded border border-line bg-white px-3">
          <option value="">Tất cả sản phẩm</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </label>
      <button disabled={pending} className={`${btn} bg-brand text-white`}>{pending ? "Đang tạo…" : "Tạo đợt kiểm kho"}</button>
      {state.error && <p role="alert" className="text-sm text-danger sm:col-span-3">{state.error}</p>}
    </form>
  );
}

const diffOf = (i: CountItem) => (i.counted_qty === null ? null : i.counted_qty - i.system_qty);

export function RoundDetail({ id, status, items, isOwner, canCount }: { id: number; status: string; items: CountItem[]; isOwner: boolean; canCount: boolean }) {
  const [filter, setFilter] = useState<"all" | "diff" | "todo">("all");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const rows = items.filter((i) => (filter === "diff" ? (diffOf(i) ?? 0) !== 0 : filter === "todo" ? i.counted_qty === null : true));
  const counted = items.filter((i) => i.counted_qty !== null).length;
  const pct = items.length ? Math.round((counted / items.length) * 100) : 0;
  const cell = (i: CountItem) => {
    const d = diffOf(i);
    if (d === null) return <span className="text-ink-2">Chưa đếm</span>;
    return <b className={`num ${d < 0 ? "text-danger" : d > 0 ? "text-ok" : "text-ink-2"}`}>{d > 0 ? `+${d}` : d === 0 ? "Khớp" : d}</b>;
  };
  return (
    <>
      <div className="mb-2 flex justify-between text-sm"><span>Tiến độ đếm</span><b className="num">{counted}/{items.length} · {pct}%</b></div>
      <div className="h-2 rounded-full bg-sunk"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>
      <div className="mt-4 flex flex-wrap gap-2">
        {([["all", "Tất cả"], ["diff", "Lệch"], ["todo", "Chưa đếm"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={`${btn} border ${filter === k ? "border-brand bg-brand-tint text-brand" : "border-line bg-white"}`}>{l}</button>
        ))}
        {status !== "closed" && canCount && <Link href={`/admin/kiem-kho/${id}/dem`} className={`${btn} ml-auto border border-brand text-brand`}>Mở trang đếm (điện thoại)</Link>}
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-line">
        <table className="hidden w-full text-sm md:table">
          <thead className="bg-ground text-left text-xs text-ink-2"><tr>{["Sản phẩm", "Số hệ thống", "Số đếm", "Chênh lệch", "Người đếm"].map((x) => <th key={x} className="px-3 py-3 font-semibold">{x}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.product_id} className="h-14 border-t border-line">
                <td className="px-3 py-2"><ProductCell name={r.name} sku={r.sku} image={r.image} /></td>
                <td className="num px-3">{r.system_qty}</td>
                <td className="num px-3">{r.counted_qty ?? "—"}</td>
                <td className="px-3">{cell(r)}</td>
                <td className="px-3 text-ink-2">{r.counted_by ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="divide-y divide-line md:hidden">
          {rows.map((r) => (
            <li key={r.product_id} className="p-3 text-sm">
              <ProductCell name={r.name} sku={r.sku} image={r.image} />
              <div className="mt-1 flex flex-wrap gap-x-4 text-ink-2">
                <span>Hệ thống <b className="num text-ink">{r.system_qty}</b></span>
                <span>Đếm <b className="num text-ink">{r.counted_qty ?? "—"}</b></span>
                <span>{cell(r)}</span>
              </div>
            </li>
          ))}
        </ul>
        {rows.length === 0 && <p className="p-4 text-sm text-ink-2">Không có sản phẩm nào trong mục này.</p>}
      </div>
      {status !== "closed" && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-1 text-xs text-ink-2"><LockKeyhole className="size-3.5" />Chỉ chủ shop được chốt. Chốt xong, tồn kho được cập nhật theo số đếm (món chưa đếm giữ nguyên).</span>
          {isOwner && !confirm && <button onClick={() => setConfirm(true)} className={`${btn} bg-brand text-white`}><LockKeyhole className="size-4" />Chốt kiểm kho</button>}
          {isOwner && confirm && (
            <span className="flex items-center gap-2">
              <button disabled={pending} onClick={() => start(async () => { const r = await closeRound(id); setError(r.error ?? ""); setConfirm(false); })} className={`${btn} bg-brand text-white`}>Xác nhận chốt</button>
              <button onClick={() => setConfirm(false)} className={`${btn} border border-line`}>Không</button>
            </span>
          )}
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </>
  );
}

// Trang đếm trên điện thoại: tìm SP, nhập số đếm, lưu từng món
export function CountPad({ id, items }: { id: number; items: CountItem[] }) {
  const [q, setQ] = useState("");
  const [values, setValues] = useState<Record<number, string>>({});
  const [saved, setSaved] = useState<Record<number, number>>({});
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
  const list = items.filter((i) => !q || norm(`${i.name} ${i.sku}`).includes(norm(q)));
  const left = items.filter((i) => i.counted_qty === null && saved[i.product_id] === undefined).length;
  return (
    <>
      <label className="relative mb-3 block">
        <span className="sr-only">Tìm sản phẩm</span>
        <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-2" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên hoặc mã sản phẩm" className="h-12 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-[15px]" />
      </label>
      <p className="mb-3 text-sm text-ink-2">Còn <b className="num text-ink">{left}</b> món chưa đếm</p>
      {error && <p role="alert" className="mb-3 rounded bg-[#fef2f2] p-3 text-sm text-danger">{error}</p>}
      <ul className="space-y-2">
        {list.map((i) => {
          const done = saved[i.product_id] ?? i.counted_qty;
          const v = values[i.product_id] ?? (done !== null && done !== undefined ? String(done) : "");
          const set = (n: number) => setValues((s) => ({ ...s, [i.product_id]: String(Math.max(0, n)) }));
          return (
            <li key={i.product_id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <ProductCell name={i.name} sku={i.sku} image={i.image} size={52} className="text-[15px]" extra={` · ${i.unit}`} />
                {done !== null && done !== undefined && <span className="flex items-center gap-1 text-xs font-semibold text-ok"><Check className="size-4" />Đã đếm {done}</span>}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button aria-label="Bớt 1" onClick={() => set((parseInt(v) || 0) - 1)} className="grid size-12 place-items-center rounded border border-line"><Minus className="size-5" /></button>
                <input aria-label={`Số đếm ${i.name}`} inputMode="numeric" value={v} onChange={(e) => setValues((s) => ({ ...s, [i.product_id]: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                  className="num h-12 w-24 rounded border border-line text-center text-xl font-bold" />
                <button aria-label="Thêm 1" onClick={() => set((parseInt(v) || 0) + 1)} className="grid size-12 place-items-center rounded border border-line"><Plus className="size-5" /></button>
                <button disabled={pending || v === ""} onClick={() => start(async () => {
                  const r = await saveCount(id, i.product_id, parseInt(v));
                  if (r.ok) setSaved((s) => ({ ...s, [i.product_id]: parseInt(v) }));
                  setError(r.error ?? "");
                })} className="ml-auto h-12 rounded bg-brand px-4 font-semibold text-white disabled:opacity-50">Lưu</button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
