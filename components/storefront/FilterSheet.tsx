"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { ArrowRight, Banknote, Check, ChevronDown, LayoutGrid, X } from "lucide-react";
import { PriceRange, type PriceError } from "@/components/storefront/PriceRange";
import { fmtNumber, PRICE_STEP, priceLabel, type Bounds, type Draft } from "@/components/storefront/priceFilter";

type Props = {
  title: string;
  brandOptions: { name: string; count: number }[];
  bounds: Bounds;
  initial: Draft;
  countFor: (d: Draft) => number;
  onApply: (d: Draft) => void;
  onClose: () => void;
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Thứ tự hiện của từng phần khi bảng mở (số càng lớn càng hiện sau), xem .anim-rise trong globals.css.
const rise = (order: number) => ({ "--i": order }) as CSSProperties;

function Acc({ id, order, open, onToggle, icon, title, badge, summary, children }: { id: string; order: number; open: boolean; onToggle: () => void; icon: ReactNode; title: string; badge?: ReactNode; summary: string; children: ReactNode }) {
  return (
    <section className="anim-rise border-t border-line pt-1" style={rise(order)}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="flex min-h-16 w-full items-center gap-3 rounded-xl py-3.5 text-left transition-colors duration-150 active:bg-sunk">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-150 ${open ? "bg-brand-deep text-white" : "bg-sunk text-brand-deep"}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <b className="flex items-center gap-2 text-base">{title}{badge}</b>
          <span className="mt-0.5 block truncate text-[13px] text-ink-2">{summary}</span>
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sunk"><ChevronDown className={`size-5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden /></span>
      </button>
      <div id={id} inert={!open} className={`grid transition-[grid-template-rows] duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className={`min-h-0 overflow-hidden transition-opacity duration-200 ${open ? "opacity-100 delay-75" : "opacity-0"}`}>
          <div className="pb-5 pt-1">{children}</div>
        </div>
      </div>
    </section>
  );
}

// Bảng lọc: trượt từ dưới lên trên điện thoại, trượt từ phải vào trên máy tính.
// Người dùng chọn xong mới bấm "Áp dụng bộ lọc"; lúc đó danh sách mới đổi.
export function FilterSheet({ title, brandOptions, bounds, initial, countFor, onApply, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [error, setError] = useState<PriceError | null>(null);
  const [openBrand, setOpenBrand] = useState(true);
  const [openPrice, setOpenPrice] = useState(false);
  const [closing, setClosing] = useState(false);
  const [leaving, setLeaving] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const loRef = useRef<HTMLInputElement>(null);
  const hiRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const pending = timers.current;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      pending.forEach((t) => window.clearTimeout(t));
      opener?.focus();
    };
  }, []);

  const hasPrice = bounds.max > bounds.min;
  const priceOn = draft.lo > bounds.min || draft.hi < bounds.max;
  const count = countFor(draft);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  const finish = () => {
    if (reducedMotion()) {
      onClose();
      return;
    }
    setClosing(true);
    later(onClose, 180);
  };

  const apply = () => {
    if (error) {
      setOpenPrice(true);
      later(() => (error.which === "lo" ? loRef : hiRef).current?.focus(), 230);
      return;
    }
    if (count === 0) return;
    onApply(draft);
    finish();
  };

  const toggleBrand = (name: string) =>
    setDraft((d) => ({ ...d, brands: d.brands.includes(name) ? d.brands.filter((b) => b !== name) : [...d.brands, name] }));

  const setPrice = (lo: number, hi: number) => setDraft((d) => ({ ...d, lo, hi }));

  const removeTag = (key: string) => {
    const remove = () => {
      if (key === "price") {
        setDraft((d) => ({ ...d, lo: bounds.min, hi: bounds.max }));
        setError(null);
      } else {
        const name = key.slice(2);
        setDraft((d) => ({ ...d, brands: d.brands.filter((b) => b !== name) }));
      }
      setLeaving(null);
    };
    if (reducedMotion()) {
      remove();
      return;
    }
    setLeaving(key);
    later(remove, 140);
  };

  const reset = () => {
    setDraft({ brands: [], lo: bounds.min, hi: bounds.max });
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      finish();
      return;
    }
    if (e.key !== "Tab") return;
    const items = [...(panelRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input") ?? [])].filter((el) => !el.closest("[inert]"));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const quicks = [
    { id: "u500", label: "Dưới 500 nghìn", lo: bounds.min, hi: 500000, show: bounds.min < 500000 && bounds.max > 500000 },
    { id: "u1m", label: "Dưới 1 triệu", lo: bounds.min, hi: 1000000, show: bounds.min < 1000000 && bounds.max > 1000000 },
    { id: "f1m", label: "Từ 1 triệu", lo: 1000000, hi: bounds.max, show: bounds.max > 1000000 && bounds.min < 1000000 },
  ].filter((q) => q.show);

  const tags: { key: string; label: string }[] = [
    ...draft.brands.map((b) => ({ key: `b:${b}`, label: b })),
    ...(priceOn ? [{ key: "price", label: priceLabel(draft.lo, draft.hi, bounds) }] : []),
  ];

  const bits: string[] = [];
  if (draft.brands.length) bits.push(`${draft.brands.length} thương hiệu`);
  if (priceOn) bits.push(priceLabel(draft.lo, draft.hi, bounds));

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="filter-title" onKeyDown={onKeyDown}>
      <button type="button" tabIndex={-1} aria-label="Đóng bộ lọc" onClick={finish} className={`absolute inset-0 bg-ink/40 ${closing ? "anim-fade-out" : "anim-fade-in"}`} />
      <div ref={panelRef} className={`absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-surface md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-3xl ${closing ? "anim-sheet-out" : "anim-sheet"}`}>
        <div className="mx-auto mt-2.5 h-[5px] w-11 shrink-0 rounded-full bg-line md:hidden" aria-hidden />
        <div className="anim-rise flex shrink-0 items-center justify-between gap-3 px-5 pb-3 pt-3" style={rise(0)}>
          <div>
            <h2 id="filter-title" className="text-2xl font-bold leading-tight">Lựa chọn của bạn</h2>
            <p className="mt-1 text-[13px] text-ink-2">{title} · Tìm đúng theo nhu cầu</p>
          </div>
          <button ref={closeRef} type="button" onClick={finish} aria-label="Đóng bộ lọc" className="grid size-11 shrink-0 place-items-center rounded-full border border-line transition-transform duration-100 active:scale-95"><X className="size-5" aria-hidden /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-2 pt-1 [scrollbar-width:none] [mask-image:linear-gradient(to_bottom,#000_calc(100%-24px),transparent)] [&::-webkit-scrollbar]:hidden">
          <p className="anim-rise mb-2 text-xs font-semibold text-ink-2" style={rise(1)}>Đang chọn</p>
          <div className="anim-rise mb-3.5 min-h-[46px]" style={rise(1.5)}>
            {tags.length ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <button key={t.key} type="button" onClick={() => removeTag(t.key)} aria-label={`Bỏ ${t.label}`} className={`flex min-h-11 items-center gap-2 rounded-full bg-line py-0 pl-4 pr-2.5 text-sm font-semibold transition-colors duration-150 hover:bg-brand-line ${leaving === t.key ? "anim-tag-out" : "anim-tag-in"}`}>
                    {t.label}
                    <span className="grid size-6 place-items-center rounded-full bg-surface"><X className="size-3.5" aria-hidden /></span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm leading-snug text-ink-2">Chưa chọn gì. Hãy chọn thương hiệu hoặc khoảng giá bên dưới.</p>
            )}
          </div>

          <Acc
            id="filter-brand"
            order={2.5}
            open={openBrand}
            onToggle={() => setOpenBrand((v) => !v)}
            icon={<LayoutGrid className="size-5" aria-hidden />}
            title="Thương hiệu"
            badge={draft.brands.length ? <span key={draft.brands.length} className="anim-pop num grid h-6 min-w-6 place-items-center rounded-xl bg-brand px-1.5 text-xs font-bold text-white">{draft.brands.length}</span> : null}
            summary={draft.brands.length ? draft.brands.join(", ") : "Tất cả thương hiệu"}
          >
            <div role="group" aria-label="Thương hiệu" className="grid grid-cols-2 gap-2.5">
              {brandOptions.map((b, index) => {
                const on = draft.brands.includes(b.name);
                return (
                  <button key={b.name} type="button" role="checkbox" aria-checked={on} onClick={() => toggleBrand(b.name)} style={rise(3.5 + index * 0.45)} className={`anim-rise flex min-h-12 w-full items-center gap-2.5 rounded-lg border px-3 text-left text-sm transition-[background-color,border-color,transform] duration-150 active:scale-[0.97] ${on ? "border-brand-deep bg-brand-deep font-bold text-white" : "border-line bg-surface text-ink hover:bg-sunk"}`}>
                    <span className={`grid size-5 shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-colors duration-150 ${on ? "border-surface bg-surface" : "border-[#918b85]"}`}>
                      {on && <Check className="anim-tick size-3.5 text-brand-deep" strokeWidth={3} aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1 py-2">
                      <span className="block break-words leading-tight">{b.name}</span>
                      <span className={`num mt-0.5 block text-xs font-normal ${on ? "text-line" : "text-ink-2"}`}>{b.count} sản phẩm</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Acc>

          {hasPrice && (
            <Acc
              id="filter-price"
              order={7}
              open={openPrice}
              onToggle={() => setOpenPrice((v) => !v)}
              icon={<Banknote className="size-5" aria-hidden />}
              title="Khoảng giá"
              summary={`${fmtNumber(draft.lo)} – ${fmtNumber(draft.hi)} ₫`}
            >
              <PriceRange min={bounds.min} max={bounds.max} step={PRICE_STEP} lo={draft.lo} hi={draft.hi} error={error} onChange={setPrice} onError={setError} loRef={loRef} hiRef={hiRef} />
              {quicks.length > 0 && (
                <div role="group" aria-label="Chọn nhanh khoảng giá" className="mt-3.5 flex gap-2">
                  {quicks.map((q) => {
                    const on = draft.lo === q.lo && draft.hi === q.hi;
                    const empty = countFor({ brands: [], lo: q.lo, hi: q.hi }) === 0;
                    return (
                      <button key={q.id} type="button" disabled={empty} aria-pressed={on} onClick={() => { setError(null); setPrice(q.lo, q.hi); }} className={`min-h-11 flex-1 rounded-lg px-1.5 text-[13px] font-semibold leading-tight transition-[background-color,transform] duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${on ? "bg-brand text-white" : "bg-sunk hover:bg-line"}`}>
                        {q.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </Acc>
          )}
        </div>

        <div className="anim-rise shrink-0 border-t border-line bg-surface px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3" style={rise(8)}>
          <p className="mb-2.5 flex min-h-5 items-center gap-1.5 text-[13px] text-ink-2" aria-live="polite">
            {count === 0 ? "Không có sản phẩm phù hợp" : (
              <>
                {bits.length > 0 && <Check className="size-4" aria-hidden />}
                <span><b key={count} className="anim-num num font-bold text-ink">{count}</b> sản phẩm · {bits.length ? bits.join(" · ") : "Chưa chọn bộ lọc"}</span>
              </>
            )}
          </p>
          <div className="flex gap-2.5">
            <button type="button" onClick={reset} className="h-12 shrink-0 rounded-full border border-[#918b85] px-5 text-[15px] font-semibold transition-[background-color,transform] duration-150 hover:bg-sunk active:scale-[0.97]">Đặt lại</button>
            <button type="button" onClick={apply} disabled={count === 0} className="group flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-brand text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-2">
              Áp dụng bộ lọc
              <ArrowRight className="size-5 transition-transform duration-150 group-hover:translate-x-0.5 group-active:translate-x-1" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
