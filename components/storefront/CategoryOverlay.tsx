"use client";

import { useEffect, useState, type RefObject } from "react";
import { X } from "lucide-react";
import { CategoryIndexClient } from "@/components/storefront/CategoryIndexClient";
import type { CategoryMenuTab } from "@/lib/catalog";

type Props = {
  menu: CategoryMenuTab[];
  closing: boolean;
  closeButtonRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onNavigate: (href: string) => void;
};

export function CategoryOverlay({ menu, closing, closeButtonRef, onClose, onNavigate }: Props) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    const overlay = closeButtonRef.current?.closest('[role="dialog"]');
    const store = overlay?.closest(".store");
    const background = [...(store?.children ?? [])].filter((el): el is HTMLElement => el instanceof HTMLElement && el !== overlay && !el.matches("[data-mobile-nav]"));
    const previousInert = background.map((el) => el.inert);
    background.forEach((el) => { el.inert = true; });
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key !== "Tab") return;
      const selector = "button:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";
      const nodes = [...(overlay?.querySelectorAll<HTMLElement>(selector) ?? []), ...(store?.querySelector('[data-mobile-nav]')?.querySelectorAll<HTMLElement>(selector) ?? [])].filter((el) => el.tabIndex !== -1);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      background.forEach((el, index) => { el.inert = previousInert[index]; });
      document.removeEventListener("keydown", onKey);
    };
  }, [closeButtonRef, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Danh mục sản phẩm"
      style={{ transitionDuration: closing ? "160ms" : "220ms" }}
      className={`fixed inset-x-0 top-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[60] flex flex-col bg-ground transition-[opacity,transform] ease-out motion-reduce:translate-y-0 motion-reduce:transition-none ${closing ? "translate-y-4 opacity-0" : entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}
    >
      <header className="flex h-12 shrink-0 items-center justify-between bg-surface px-3">
        <h2 className="text-[14px] font-medium text-ink">Danh mục sản phẩm</h2>
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Đóng danh mục"
          onClick={onClose}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-sunk text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
        >
          <span className="grid size-6 place-items-center"><X className="size-4" aria-hidden="true" /></span>
        </button>
      </header>
      <div className="flex min-h-0 flex-1 px-0 pt-2">
        <CategoryIndexClient menu={menu} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
