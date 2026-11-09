"use client";
import { useState, useTransition } from "react";
import { ProductThumb } from "@/components/admin/ProductCell";
import { applyChanges } from "./actions";

export type PendingChange = {
  id: number; field: string; oldValue: string | null; newValue: string; newNote?: string;
  productId: number; sku: string; name: string; image: string | null;
};

const LABEL: Record<string, string> = {
  name: "Tên sản phẩm", unit: "Đơn vị tính", price: "Giá bán", import_price: "Giá nhập", category: "Danh mục con", classifications: "Phân loại", industry: "Ngành hàng", brand: "Thương hiệu",
  location: "Vị trí", qty: "Tồn kho (đặt đúng số này)", min_qty: "Tồn tối thiểu", spec: "Thông số", description: "Mô tả", warranty: "Bảo hành", origin: "Xuất xứ", made_in: "Sản xuất tại", usage_guide: "Hướng dẫn sử dụng",
};
const MONEY = new Set(["price", "import_price"]);
const show = (field: string, v: string | null) =>
  v == null || v === "" ? <span className="text-ink-2">(trống)</span> : MONEY.has(field) && /^\d+$/.test(v) ? `${Number(v).toLocaleString("vi-VN")}₫` : v;

// Nhãn nhỏ cạnh giá trị mới, vd. "1 loại mới" = Phân loại sẽ được tạo khi xác nhận.
const NewNote = ({ text }: { text?: string }) =>
  text ? <span className="ml-1.5 inline-block rounded bg-gold-tint px-1.5 text-xs font-medium text-gold-ink">{text}</span> : null;

// Bảng đối chiếu thay đổi khi nhập Excel: mỗi thay đổi một ô tick. Xác nhận → ghi; chưa tick → còn lại trong bảng.
export function ReviewTable({ changes }: { changes: PendingChange[] }) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const all = picked.size === changes.length;
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const products = new Set(changes.map((c) => c.productId)).size;

  return (
    <section className="mb-5 rounded-lg border-2 border-brand bg-white" aria-labelledby="h-doi-chieu">
      <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
        <div className="mr-auto">
          <h2 id="h-doi-chieu" className="font-semibold">Thay đổi chờ xác nhận</h2>
          <p className="text-sm text-ink-2">{changes.length} thay đổi ở {products} sản phẩm. Đối chiếu giá trị cũ – mới, tick để xác nhận.</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={all} onChange={() => setPicked(all ? new Set() : new Set(changes.map((c) => c.id)))} />
          Chọn tất cả
        </label>
        <button
          disabled={pending || picked.size === 0}
          onClick={() => start(async () => {
            const r = await applyChanges([...picked]);
            setMsg({ ok: r.ok, text: r.ok ? `Đã thay đổi ${r.applied} mục.` : r.error ?? "Không lưu được." });
            setPicked(new Set());
          })}
          className="h-11 rounded bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
        >
          {pending ? "Đang lưu…" : `Xác nhận ${picked.size || ""} thay đổi`}
        </button>
      </div>
      {msg && <p role="status" className={`mx-4 mt-3 rounded p-3 text-sm ${msg.ok ? "bg-brand-tint text-brand" : "bg-[#fef2f2] text-danger"}`}>{msg.text}</p>}

      <div className="max-h-[60vh] overflow-auto">
        <table className="hidden w-full text-sm md:table">
          <thead className="sticky top-0 z-10 bg-ground text-left text-xs text-ink-2">
            <tr>{["", "Sản phẩm", "Thông tin", "Giá trị cũ", "Giá trị mới"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
          </thead>
          <tbody>
            {changes.map((c, i) => {
              const first = i === 0 || changes[i - 1].productId !== c.productId;
              return (
                <tr key={c.id} className={`${first ? "border-t border-line" : ""} align-top ${picked.has(c.id) ? "bg-brand-tint/50" : ""}`}>
                  <td className="px-3 py-2"><input type="checkbox" aria-label={`Xác nhận ${LABEL[c.field]} của ${c.name}`} className="mt-1 size-4 accent-[var(--color-brand)]" checked={picked.has(c.id)} onChange={() => toggle(c.id)} /></td>
                  <td className="px-3 py-2">{first && <span className="flex items-center gap-2"><ProductThumb src={c.image} size={36} /><span><b className="block">{c.name}</b><small className="num text-xs text-ink-2">Mã: {c.sku}</small></span></span>}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-medium">{LABEL[c.field] ?? c.field}</td>
                  <td className="max-w-72 whitespace-pre-line px-3 py-2 text-ink-2 line-through decoration-ink-2/40">{show(c.field, c.oldValue)}</td>
                  <td className="max-w-72 whitespace-pre-line px-3 py-2 font-medium text-brand">{show(c.field, c.newValue)}<NewNote text={c.newNote} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <ul className="divide-y divide-line md:hidden">
          {changes.map((c, i) => {
            const first = i === 0 || changes[i - 1].productId !== c.productId;
            return (
              <li key={c.id} className={`p-3 ${picked.has(c.id) ? "bg-brand-tint/50" : ""}`}>
                {first && <span className="mb-2 flex items-center gap-2"><ProductThumb src={c.image} size={36} /><span className="min-w-0"><b className="block text-sm">{c.name}</b><small className="num break-all text-xs text-ink-2">Mã: {c.sku}</small></span></span>}
                <label className="flex gap-3 text-sm">
                  <input type="checkbox" className="mt-1 size-5 shrink-0 accent-[var(--color-brand)]" checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                  <span className="min-w-0">
                    <b className="block">{LABEL[c.field] ?? c.field}</b>
                    <span className="block whitespace-pre-line text-ink-2"><span className="text-xs">Cũ: </span>{show(c.field, c.oldValue)}</span>
                    <span className="block whitespace-pre-line font-medium text-brand"><span className="text-xs">Mới: </span>{show(c.field, c.newValue)}<NewNote text={c.newNote} /></span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
