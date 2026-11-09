"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { LockKeyhole, X } from "lucide-react";
import { EXPORT_GROUPS, normalizeExportGroups } from "@/lib/excel/parse-products";

const STORAGE_KEY = "ttt-product-export-groups-v1";

export function ExportColumnsDialog({ total, withCost, busy, error, onClose, onDownload, openerRef }: {
  total: number; withCost: boolean; busy: boolean; error: string; onClose: () => void; onDownload: (groups: string[]) => void;
  openerRef: RefObject<HTMLButtonElement | null>;
}) {
  const available = EXPORT_GROUPS.filter((group) => withCost || group.id !== "cost");
  const presets = [
    { id: "all", label: "Đầy đủ (nhập lại)", groups: available.map((group) => group.id) as string[] },
    { id: "stock", label: "Chỉ tồn kho", groups: ["basic", "stock"] },
    { id: "price", label: "Chỉ giá", groups: withCost ? ["basic", "cost"] : ["basic"] },
  ];
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
      if (Array.isArray(saved) && saved.every((id) => typeof id === "string")) return normalizeExportGroups(saved, withCost);
    } catch { /* Storage may be unavailable in private browsing. */ }
    return available.map((group) => group.id);
  });
  const [preset, setPreset] = useState(() => presets.find((item) => item.groups.length === selected.length && item.groups.every((id) => selected.includes(id)))?.id ?? "");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = openerRef.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previous; opener?.focus(); };
  }, [openerRef]);

  function choose(groups: string[], presetId = "") {
    const next = normalizeExportGroups(groups, withCost);
    setSelected(next);
    setPreset(presetId);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* Optional preference only. */ }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); if (!busy) onClose(); }
    if (event.key !== "Tab") return;
    const nodes = event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])");
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  return createPortal(
    <div data-selection-keep="" className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 sm:items-center sm:p-4" onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="export-columns-title" aria-busy={busy} onKeyDown={onKeyDown} className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl">
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <h2 id="export-columns-title" className="text-base font-bold">Chọn cột xuất · {total} SP</h2>
          <button ref={closeRef} type="button" disabled={busy} onClick={onClose} aria-label="Đóng bảng chọn cột" className="grid size-11 place-items-center rounded-full hover:bg-sunk disabled:opacity-50"><X className="size-5" aria-hidden /></button>
        </header>
        <div className="overflow-y-auto p-4">
          <p className="mb-2 text-xs font-semibold text-ink-2">Mẫu nhanh</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {presets.map((item) => <button key={item.id} type="button" disabled={busy} aria-pressed={preset === item.id} onClick={() => choose(item.groups, item.id)} className={`min-h-11 rounded-full border px-3 text-sm font-medium ${preset === item.id ? "border-brand bg-brand-tint text-brand" : "border-line bg-surface text-ink"}`}>{item.label}</button>)}
          </div>
          <div className="space-y-2">
            {available.map((group) => (
              <label key={group.id} className={`flex min-h-14 items-start gap-3 rounded-xl border p-3 ${selected.includes(group.id) ? "border-brand-line bg-brand-tint/40" : "border-line"}`}>
                <input type="checkbox" checked={selected.includes(group.id)} disabled={group.id === "basic" || busy} onChange={() => choose(selected.includes(group.id) ? selected.filter((id) => id !== group.id) : [...selected, group.id])} className="mt-0.5 size-5 shrink-0 accent-brand" />
                <span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold">{group.name}{group.id === "basic" && <><LockKeyhole className="size-3.5" aria-hidden /><span className="text-xs font-normal text-ink-2">Luôn có</span></>}</span><span className="mt-1 block text-xs leading-relaxed text-ink-2">{group.columns.join(" · ")}</span></span>
              </label>
            ))}
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
        </div>
        <footer className="border-t border-line p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <button type="button" disabled={busy} onClick={() => onDownload(selected)} className="h-12 w-full rounded-full bg-brand text-sm font-bold text-white hover:bg-brand-deep disabled:opacity-60">{busy ? "Đang xuất…" : "Tải file"}</button>
        </footer>
      </div>
    </div>, document.body,
  );
}
