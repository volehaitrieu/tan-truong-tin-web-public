"use client";

import { useId, useRef, useState, type RefObject } from "react";
import { clamp, fmtNumber } from "@/components/storefront/priceFilter";

export type PriceError = { which: "lo" | "hi"; text: string; msg: string };

type Props = {
  compact?: boolean;
  onCommit?: (lo: number, hi: number) => void;
  min: number;
  max: number;
  step: number;
  lo: number;
  hi: number;
  error: PriceError | null;
  onChange: (lo: number, hi: number) => void;
  onError: (error: PriceError | null) => void;
  loRef: RefObject<HTMLInputElement | null>;
  hiRef: RefObject<HTMLInputElement | null>;
};

const THUMB = 44; // vùng chạm của nút kéo (px)
const HALF = THUMB / 2;

// Hai ô nhập giá + thanh kéo hai đầu. Nhập số, kéo chuột/ngón tay hoặc dùng phím mũi tên đều cho cùng một kết quả.
export function PriceRange({ min, max, step, lo, hi, error, onChange, onError, loRef, hiRef, compact = false, onCommit }: Props) {
  const id = useId();
  const pending = useRef<[number, number] | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ which: "lo" | "hi"; x: number; ambiguous: boolean } | null>(null);
  const [dragging, setDragging] = useState<"lo" | "hi" | null>(null);
  const [edit, setEdit] = useState<{ which: "lo" | "hi"; text: string } | null>(null);

  const span = Math.max(1, max - min);
  const frac = (v: number) => (v - min) / span;
  const snap = (v: number) => v <= min ? min : v >= max ? max : clamp(Math.round(v / step) * step, min, max);

  const valueAt = (clientX: number) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return min;
    return min + clamp((clientX - rect.left - HALF) / Math.max(1, rect.width - THUMB), 0, 1) * span;
  };

  const setThumb = (which: "lo" | "hi", raw: number) => {
    const v = snap(raw);
    onError(null);
    const next: [number, number] = which === "lo" ? [clamp(v, min, hi), hi] : [lo, clamp(v, lo, max)];
    pending.current = next;
    onChange(...next);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0 || max <= min) return;
    // Đang gõ dở trong ô giá thì chốt giá đã gõ trước, rồi mới kéo (pointerdown bên dưới không làm ô mất focus).
    if (document.activeElement instanceof HTMLInputElement) document.activeElement.blur();
    const thumb =(e.target as HTMLElement).closest<HTMLElement>("[data-thumb]");
    const v = valueAt(e.clientX);
    const which = thumb ? (thumb.dataset.thumb as "lo" | "hi") : Math.abs(v - lo) <= Math.abs(v - hi) ? "lo" : "hi";
    drag.current = { which, x: e.clientX, ambiguous: lo === hi && !!thumb };
    setDragging(which);
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!thumb) setThumb(which, v);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    if (d.ambiguous) {
      // Hai nút đang chồng nhau: hướng kéo đầu tiên quyết định kéo nút nào.
      if (Math.abs(e.clientX - d.x) < 3) return;
      d.which = e.clientX < d.x ? "lo" : "hi";
      d.ambiguous = false;
      setDragging(d.which);
    }
    setThumb(d.which, valueAt(e.clientX));
  };

  const endDrag = () => {
    drag.current = null;
    setDragging(null);
    if (pending.current) { onCommit?.(...pending.current); pending.current = null; }
  };

  const onKeyDown = (which: "lo" | "hi") => (e: React.KeyboardEvent) => {
    const cur = which === "lo" ? lo : hi;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = cur + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = cur - step;
    else if (e.key === "PageUp") next = cur + step * 10;
    else if (e.key === "PageDown") next = cur - step * 10;
    else if (e.key === "Home") next = which === "lo" ? min : lo;
    else if (e.key === "End") next = which === "lo" ? hi : max;
    if (next === null) return;
    e.preventDefault();
    setThumb(which, next);
  };

  const shown = (which: "lo" | "hi") => {
    if (edit?.which === which) return edit.text;
    if (error?.which === which) return error.text;
    return fmtNumber(which === "lo" ? lo : hi);
  };

  const commit = (which: "lo" | "hi") => {
    const digits = (edit?.which === which ? edit.text : "").replace(/\D/g, "");
    setEdit(null);
    if (!digits) {
      onError(null);
      return;
    }
    const v = clamp(Number(digits), min, max);
    if (which === "lo" && v > hi) {
      onError({ which, text: fmtNumber(v), msg: "Giá thấp nhất không được lớn hơn giá cao nhất. Hãy nhập lại." });
      return;
    }
    if (which === "hi" && v < lo) {
      onError({ which, text: fmtNumber(v), msg: "Giá cao nhất không được nhỏ hơn giá thấp nhất. Hãy nhập lại." });
      return;
    }
    onError(null);
    const next: [number, number] = [which === "lo" ? v : lo, which === "hi" ? v : hi];
    onChange(...next);
    onCommit?.(...next);
  };

  const field = (which: "lo" | "hi", label: string, id: string, ref: RefObject<HTMLInputElement | null>) => {
    const bad = error?.which === which;
    return (
      <div>
        <label htmlFor={id} className="mb-1.5 block text-xs font-semibold text-ink-2">{label}</label>
        <div className={`flex h-[52px] items-center gap-1.5 rounded-lg border px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${bad ? "border-danger bg-danger-tint" : "border-[#918b85] bg-[#ebe6e8]"}`}>
          <input
            ref={ref}
            id={id}
            inputMode="numeric"
            autoComplete="off"
            value={shown(which)}
            aria-invalid={bad}
            aria-describedby={bad ? `${id}-price-error` : undefined}
            onFocus={(e) => {
              setEdit({ which, text: error?.which === which ? error.text : fmtNumber(which === "lo" ? lo : hi) });
              e.currentTarget.select();
            }}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              setEdit({ which, text: digits ? fmtNumber(Number(digits)) : "" });
            }}
            onBlur={() => commit(which)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              e.currentTarget.blur();
            }}
            className="num min-w-0 flex-1 bg-transparent text-base font-semibold text-ink outline-none"
          />
          <span className="text-[15px] text-ink-2" aria-hidden>₫</span>
        </div>
      </div>
    );
  };

  const thumb = (which: "lo" | "hi") => {
    const value = which === "lo" ? lo : hi;
    const active = dragging === which;
    return (
      <button
        key={which}
        type="button"
        role="slider"
        data-thumb={which}
        aria-label={which === "lo" ? "Giá thấp nhất" : "Giá cao nhất"}
        aria-valuemin={which === "lo" ? min : lo}
        aria-valuemax={which === "lo" ? hi : max}
        aria-valuenow={value}
        aria-valuetext={`${fmtNumber(value)} đồng`}
        disabled={max <= min}
        onKeyDown={onKeyDown(which)}
        onKeyUp={endDrag}
        onBlur={() => { if (!drag.current && pending.current) { onCommit?.(...pending.current); pending.current = null; } }}
        className="group absolute top-0 size-11 touch-none rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-brand"
        style={{ left: `calc(${HALF}px + (100% - ${THUMB}px) * ${frac(value)})`, marginLeft: -HALF }}
      >
        {/* Mẫu K3: vòng đen 18px lõi trắng; vùng chạm vẫn 44px. */}
        <span className={`absolute left-[13px] top-[13px] size-[18px] rounded-full border-[5px] border-brand bg-surface transition-transform duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none ${active ? "scale-125" : "group-hover:scale-110"}`} />
        {active && (
          <span className="anim-bubble num pointer-events-none absolute bottom-[calc(100%-4px)] left-1/2 whitespace-nowrap rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-white">
            {fmtNumber(value)} ₫
          </span>
        )}
      </button>
    );
  };

  return (
    <div>
      {!compact && <div className="grid grid-cols-2 gap-2.5 md:grid-cols-1">
        {field("lo", "Giá thấp nhất", `${id}-price-lo`, loRef)}
        {field("hi", "Giá cao nhất", `${id}-price-hi`, hiRef)}
      </div>}
      {error && <p id={`${id}-price-error`} role="alert" className="mt-2 text-[13px] leading-snug text-danger">{error.msg}</p>}
      <div
        ref={railRef}
        className={`relative h-11 touch-none select-none ${compact ? "mt-1" : "mt-9"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="absolute top-[20.5px] h-[3px] rounded-full bg-line" style={{ left: HALF, right: HALF }} />
        <div className="absolute top-[20.5px] h-[3px] rounded-full bg-brand" style={{ left: `calc(${HALF}px + (100% - ${THUMB}px) * ${frac(lo)})`, right: `calc(${HALF}px + (100% - ${THUMB}px) * ${1 - frac(hi)})` }} />
        {thumb("lo")}
        {thumb("hi")}
      </div>
      {!compact && <div className="num flex justify-between text-xs text-ink-2">
        <span>{fmtNumber(min)} ₫</span>
        <span>{fmtNumber(max)} ₫</span>
      </div>}
    </div>
  );
}
