"use client";
import { useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { BrandOption, Option } from "@/lib/admin/products";
import { useUrlParams } from "@/lib/use-url-params";
import { LiveSearchField } from "@/components/LiveSearchField";

// Thanh lọc màn Sản phẩm: tìm, danh mục, thương hiệu, trạng thái lọc NGAY (không tải lại trang).
// Riêng khoảng giá vẫn bấm "Lọc giá", vì phải hỏi lọc theo giá gốc hay giá khuyến mãi.
const field = "h-10 rounded border border-line bg-white px-3 text-sm outline-none focus:border-brand";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "").slice(0, 10);
const show = (s: string) => (s ? Number(s).toLocaleString("vi-VN") : "");

type Init = { q?: string; cat?: string; brand?: string; pmin?: string; pmax?: string; pmode?: string; status?: string };

export function ProductFilters({ categories, brands, init }: { categories: Option[]; brands: BrandOption[]; init: Init }) {
  const formRef = useRef<HTMLFormElement>(null);
  const modeRef = useRef<HTMLInputElement>(null);
  const [pmin, setPmin] = useState(digits(init.pmin ?? ""));
  const [pmax, setPmax] = useState(digits(init.pmax ?? ""));
  const [asking, setAsking] = useState(false);
  const { update } = useUrlParams();
  // Đang lọc → hiện nút "Xóa bộ lọc" (về trang đầu, bỏ mọi lọc + ô đã tick)
  const filtering = !!(init.q || init.cat || init.brand || init.pmin || init.pmax || init.status);
  // Khoảng giá đã gõ nhưng chưa áp dụng → mới hiện nút "Lọc giá"
  const priceDirty = pmin !== digits(init.pmin ?? "") || pmax !== digits(init.pmax ?? "");

  const applyPrice = (mode: string) => {
    if (modeRef.current) modeRef.current.value = mode;
    setAsking(false);
    update({ pmin, pmax, pmode: pmin || pmax ? mode : null });
  };

  return (
    <form
      ref={formRef}
      role="search"
      className="mb-4 grid grid-cols-2 gap-2 xl:flex xl:flex-nowrap xl:items-center"
      onSubmit={(e) => {
        // Không gửi form kiểu cũ (tải lại cả trang): Enter chỉ áp dụng khoảng giá; các ô khác đã tự lọc.
        e.preventDefault();
        if (!priceDirty) return;
        if (pmin || pmax) setAsking(true); else applyPrice("");
      }}
    >
      <LiveSearchField param="q" initial={init.q ?? ""} label="Tìm sản phẩm" placeholder="Tìm tên, mã, thương hiệu…"
        className="col-span-2 xl:min-w-0 xl:flex-1" inputClassName={field} />
      <select name="cat" defaultValue={init.cat ?? ""} onChange={(e) => update({ cat: e.target.value })} className={`${field} w-full xl:w-40`} aria-label="Danh mục">
        <option value="">Mọi danh mục</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <BrandPicker brands={brands.filter((b) => b.count > 0)} initial={init.brand ?? ""} onPick={(id) => update({ brand: id })} />
      <div className="col-span-2 flex items-center gap-1 xl:col-span-1">
        <input inputMode="numeric" value={show(pmin)} onChange={(e) => { setPmin(digits(e.target.value)); if (modeRef.current) modeRef.current.value = ""; }} className={`${field} num min-w-0 flex-1 xl:w-28 xl:flex-none`} placeholder="Giá từ" aria-label="Giá bán từ" />
        <span className="text-ink-2">–</span>
        <input inputMode="numeric" value={show(pmax)} onChange={(e) => { setPmax(digits(e.target.value)); if (modeRef.current) modeRef.current.value = ""; }} className={`${field} num min-w-0 flex-1 xl:w-28 xl:flex-none`} placeholder="đến" aria-label="Giá bán đến" />
        {pmin && <input type="hidden" name="pmin" value={pmin} />}
        {pmax && <input type="hidden" name="pmax" value={pmax} />}
        <input ref={modeRef} type="hidden" name="pmode" defaultValue={pmin || pmax ? init.pmode ?? "" : ""} />
      </div>
      <select name="status" defaultValue={init.status ?? ""} onChange={(e) => update({ status: e.target.value })} className={`${field} w-full xl:w-36`} aria-label="Trạng thái">
        <option value="">Mọi trạng thái</option>
        <option value="show">Hiển thị</option>
        <option value="hide">Ẩn</option>
      </select>
      {priceDirty && <button className={`h-10 w-full rounded bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep xl:w-auto ${filtering ? "" : "col-span-2"}`}>Lọc giá</button>}
      {/* Xóa bộ lọc tải lại hẳn trang: các ô nhập tự giữ chữ cũ nếu chỉ đổi URL */}
      {filtering && (
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- cố ý tải lại hẳn để mọi ô về trống
        <button type="button" onClick={() => window.location.assign("/admin/san-pham")} className="inline-flex h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded border border-line bg-white px-3 text-sm font-medium text-ink-2 hover:border-danger hover:text-danger xl:w-auto">
          <X className="size-4" aria-hidden />Xóa bộ lọc
        </button>
      )}

      {asking && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Lọc theo giá nào">
          <button type="button" aria-label="Đóng" onClick={() => setAsking(false)} className="absolute inset-0 bg-ink/40" />
          <div className="relative w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h2 className="font-semibold">Lọc khoảng giá theo giá nào?</h2>
            <p className="num mt-1 text-sm text-ink-2">{pmin ? show(pmin) + "₫" : "0₫"} – {pmax ? show(pmax) + "₫" : "không giới hạn"}</p>
            <div className="mt-4 grid gap-2">
              {[["goc", "Lọc theo giá gốc"], ["km", "Lọc theo giá khuyến mãi"], ["ca2", "Lọc cả 2"]].map(([m, label]) => (
                <button key={m} type="button" onClick={() => applyPrice(m)} className="h-11 rounded border border-line text-sm font-semibold hover:border-brand hover:bg-brand-tint">{label}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </form>
  );
}

// Ô chọn thương hiệu có gõ để lọc; chỉ hiện thương hiệu đang có SP, kèm số SP
function BrandPicker({ brands, initial, onPick }: { brands: BrandOption[]; initial: string; onPick: (id: string) => void }) {
  const [value, setPicked] = useState(initial);
  const setValue = (id: string) => { setPicked(id); onPick(id); };
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const picked = brands.find((b) => String(b.id) === value);
  const list = brands.filter((b) => !text || norm(b.name).includes(norm(text)));
  return (
    <div className="relative min-w-0 xl:w-44" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <input type="hidden" name="brand" value={value} />
      <input
        value={open ? text : picked ? `${picked.name} (${picked.count})` : ""}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => { setText(""); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        placeholder="Mọi thương hiệu"
        aria-label="Thương hiệu"
        role="combobox"
        aria-controls="brand-list"
        aria-expanded={open}
        className={`${field} w-full pr-8`}
      />
      {value ? (
        <button type="button" aria-label="Bỏ lọc thương hiệu" onClick={() => setValue("")} className="absolute right-1 top-1 grid size-8 place-items-center text-ink-2"><X className="size-4" /></button>
      ) : (
        <ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-4 text-ink-2" aria-hidden />
      )}
      {open && (
        <ul id="brand-list" role="listbox" className="absolute z-30 mt-1 max-h-64 w-full min-w-56 overflow-y-auto rounded border border-line bg-white py-1 shadow-lg">
          <li><button type="button" onClick={() => { setValue(""); setOpen(false); }} className="w-full px-3 py-2 text-left text-sm text-ink-2 hover:bg-brand-tint">Mọi thương hiệu</button></li>
          {list.map((b) => (
            <li key={b.id}>
              <button type="button" role="option" aria-selected={String(b.id) === value} onClick={() => { setValue(String(b.id)); setOpen(false); }}
                className={`flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-brand-tint ${String(b.id) === value ? "font-semibold text-brand" : ""}`}>
                <span>{b.name}</span><span className="num text-ink-2">{b.count}</span>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-2 text-sm text-ink-2">Không có thương hiệu khớp.</li>}
        </ul>
      )}
    </div>
  );
}
