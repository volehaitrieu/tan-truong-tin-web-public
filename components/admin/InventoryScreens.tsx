"use client";
import { useMemo, useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";
import { normalize } from "@/lib/mock/store";
import { Badge } from "@/components/admin/ui";
import { ProductCell, stockClass } from "@/components/admin/ProductCell";
import { adjustStock } from "@/app/admin/(shell)/ton-kho/actions";
import type { MovementRow, StockRow } from "@/lib/admin/inventory";

// Tồn kho: dữ liệu thật truyền từ trang (server).
const REASONS = ["Nhập hàng", "Hư hỏng", "Thất lạc", "Trả hàng", "Kiểm kho", "Khác"];

const btn = "inline-flex h-10 items-center justify-center gap-2 rounded px-4 text-sm font-semibold";
const level = (s: number, m: number) =>
  s === 0 ? <Badge tone="danger">Hết hàng</Badge> : s <= m ? <Badge tone="warn">Sắp hết</Badge> : <Badge tone="ok">Đủ hàng</Badge>;

export function StockScreen({ rows, history, canAdjust }: { rows: StockRow[]; history: MovementRow[]; canAdjust: boolean }) {
  const [tab, setTab] = useState<"ton" | "lich-su">("ton");
  const [editing, setEditing] = useState<StockRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState(REASONS[0]);
  // Lọc ngay khi gõ (danh sách đã tải sẵn): không dấu vẫn khớp, nhiều từ thì phải khớp đủ các từ.
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    if (!words.length) return rows;
    return rows.filter((p) => {
      const text = normalize(`${p.name} ${p.sku} ${p.cat}`);
      return words.every((w) => text.includes(w));
    });
  }, [rows, query]);
  const open = (row: StockRow) => {
    setEditing(row);
    setDelta(0);
    setError("");
    setNote("");
    setReason(REASONS[0]);
  };

  return (
    <>
      <div className="mb-3 flex gap-2" role="tablist">
        {([["ton", "Tồn kho"], ["lich-su", "Lịch sử thay đổi"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`${btn} min-h-11 border ${tab === id ? "border-brand bg-brand-tint text-brand" : "border-line bg-white text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      {!canAdjust && <p className="mb-3 text-sm text-ink-2">Bạn chỉ có quyền xem.</p>}

      {tab === "ton" && (
        <div className="mb-3">
          <label className="flex h-11 items-center gap-2 rounded-lg border border-line bg-white px-3 focus-within:border-brand">
            <Search className="size-4 shrink-0 text-ink-2" aria-hidden />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm tên, mã hàng, danh mục…" aria-label="Tìm sản phẩm trong tồn kho" enterKeyHint="search" className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] outline-none focus-visible:shadow-none! [&::-webkit-search-cancel-button]:appearance-none" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label="Xóa tìm kiếm" className="grid size-8 shrink-0 place-items-center rounded-full text-ink-2 hover:bg-sunk"><X className="size-4" /></button>}
          </label>
          {query && <p className="mt-2 text-sm text-ink-2" role="status">Tìm thấy <b className="num text-ink">{shown.length}</b> / {rows.length} sản phẩm</p>}
        </div>
      )}

      {tab === "ton" ? (
        shown.length === 0 ? <p className="rounded-lg border border-line bg-white p-6 text-center text-sm text-ink-2">Không có sản phẩm nào khớp “{query}”.</p> :
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-ground text-left text-xs text-ink-2">
              <tr>{["Sản phẩm", "Danh mục", "Tồn hiện có", "Tồn tối thiểu", "Trạng thái", ""].map((x) => <th key={x} className="px-3 py-3 font-semibold">{x}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.sku} className="h-14 border-t border-line">
                  <td className="px-3 py-2"><ProductCell name={p.name} sku={p.sku} image={p.image} /></td>
                  <td className="px-3">{p.cat}</td>
                  <td className={`num px-3 font-semibold ${stockClass(p.stock, p.min)}`}>{p.stock} {p.unit}</td>
                  <td className="num px-3">{p.min}</td>
                  <td className="px-3">{level(p.stock, p.min)}</td>
                  <td className="px-3 text-right">
                    <button disabled={!canAdjust} onClick={() => open(p)} className={`${btn} border border-brand text-brand hover:bg-brand-tint disabled:opacity-40`}>Điều chỉnh</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {shown.map((p) => (
              <li key={p.sku} className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <ProductCell name={p.name} sku={p.sku} image={p.image} className="text-sm" />
                  <p className="mt-1 flex items-center gap-2 text-sm"><span className={`num font-semibold ${stockClass(p.stock, p.min)}`}>{p.stock} {p.unit}</span><span className="text-xs text-ink-2">/ tối thiểu {p.min}</span>{level(p.stock, p.min)}</p>
                </div>
                <button disabled={!canAdjust} onClick={() => open(p)} className={`${btn} min-h-11 border border-brand px-3 text-brand disabled:opacity-40`}>Điều chỉnh</button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {history.map(({ id, when, who, what, delta: d, why }) => (
            <li key={id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
              <span className="num w-24 text-ink-2">{when}</span>
              <span className="min-w-0 flex-1 font-medium">{what}</span>
              <b className={`num ${d > 0 ? "text-ok" : "text-danger"}`}>{d > 0 ? `+${d}` : d}</b>
              <span className="text-ink-2">{why} · {who}</span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Điều chỉnh tồn kho">
          <button aria-label="Đóng" onClick={() => setEditing(null)} className="absolute inset-0 bg-ink/40" />
          <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-xl md:inset-y-0 md:left-auto md:right-0 md:w-[400px] md:rounded-none">
            <div className="flex items-start justify-between gap-3">
              <div><h2 className="text-lg font-semibold">Điều chỉnh tồn kho</h2><p className="text-sm text-ink-2">{editing.name}</p></div>
              <button onClick={() => setEditing(null)} aria-label="Đóng" className="grid size-11 place-items-center"><X className="size-5" /></button>
            </div>
            <p className="mt-4 text-sm">Hiện có: <b className="num">{editing.stock} {editing.unit}</b></p>
            <div className="mt-3 flex items-center gap-3">
              <button aria-label="Giảm" onClick={() => setDelta((d) => Math.max(-editing.stock, d - 1))} className="grid size-11 place-items-center rounded border border-line"><Minus className="size-4" /></button>
              <input aria-label="Số lượng điều chỉnh" inputMode="numeric" value={delta} onChange={(e) => { const n = parseInt(e.target.value.replace(/[^0-9-]/g, "")) || 0; setDelta(Math.max(-editing.stock, Math.min(100000, n))); }} className={`num h-11 w-20 rounded border border-line text-center text-xl font-bold ${delta < 0 ? "text-danger" : delta > 0 ? "text-ok" : ""}`} />
              <button aria-label="Tăng" onClick={() => setDelta((d) => d + 1)} className="grid size-11 place-items-center rounded border border-line"><Plus className="size-4" /></button>
            </div>
            <p className="mt-2 text-sm">Sau điều chỉnh: <b className="num">{editing.stock + delta} {editing.unit}</b></p>
            <label className="mt-4 block text-sm font-medium">Lý do
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 h-11 w-full rounded border border-line bg-white px-3">
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm font-medium">Ghi chú
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="mt-1 w-full rounded border border-line p-3" placeholder="Ví dụ: nhập lô mới từ nhà phân phối" />
            </label>
            {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
            <button
              disabled={delta === 0 || saving}
              onClick={async () => {
                setSaving(true);
                const r = await adjustStock(editing.id, delta, reason, note);
                setSaving(false);
                if (r.ok) setEditing(null);
                else setError(r.error ?? "Không lưu được.");
              }}
              className={`${btn} mt-5 h-12 w-full bg-brand text-white hover:bg-brand-deep disabled:opacity-40`}
            >
              {saving ? "Đang lưu…" : "Lưu điều chỉnh"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
