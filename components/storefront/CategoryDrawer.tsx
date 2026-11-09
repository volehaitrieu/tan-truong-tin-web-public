"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CategoryOverlay } from "@/components/storefront/CategoryOverlay";
import type { CategoryMenuTab } from "@/lib/catalog";

type Controls = { isOpen: boolean; toggle: () => void; navigate: (href: string) => void; openerRef: RefObject<HTMLButtonElement | null> };

export function CategoryDrawer({ menu, children }: { menu: CategoryMenuTab[]; children: (controls: Controls) => ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  // Gắn tấm vào khung .store để nhận bảng màu web (token chỉ có hiệu lực bên trong .store).
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const historyEntryRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const openRef = useRef(false);
  const closingRef = useRef(false);
  const requestedClose = useRef(false);
  const destination = useRef<string | undefined>(undefined);

  const finishClose = useCallback((href?: string) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
    timerRef.current = window.setTimeout(() => {
      openRef.current = false;
      closingRef.current = false;
      requestedClose.current = false;
      historyEntryRef.current = false;
      setIsOpen(false);
      setClosing(false);
      if (href) {
        router.push(href);
      } else {
        openerRef.current?.focus();
      }
      timerRef.current = null;
    }, delay);
  }, [router]);

  useEffect(() => {
    function onPopState() {
      if (!historyEntryRef.current || !openRef.current) return;
      historyEntryRef.current = false;
      finishClose(destination.current);
      destination.current = undefined;
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [finishClose]);

  useEffect(() => () => { if (timerRef.current !== null) window.clearTimeout(timerRef.current); }, []);

  function openMenu() {
    if (openRef.current) return;
    openRef.current = true;
    closingRef.current = false;
    requestedClose.current = false;
    destination.current = undefined;
    setClosing(false);
    setPortalTarget(openerRef.current?.closest(".store") ?? document.body);
    setIsOpen(true);
    window.history.pushState({ ...window.history.state, __tttCategoryOverlay: true }, "", window.location.href);
    historyEntryRef.current = true;
  }

  const closeMenu = useCallback(() => {
    if (requestedClose.current) return;
    requestedClose.current = true;
    if (historyEntryRef.current) window.history.back();
    else { finishClose(destination.current); destination.current = undefined; }
  }, [finishClose]);

  function navigate(href: string) {
    if (!openRef.current) { router.push(href); return; }
    destination.current = href;
    closeMenu();
  }

  return <>
    {children({ isOpen, toggle: () => openRef.current ? closeMenu() : openMenu(), navigate, openerRef })}
    {isOpen && portalTarget ? createPortal(<CategoryOverlay
      menu={menu} closing={closing} closeButtonRef={closeButtonRef} onClose={closeMenu} onNavigate={navigate}
    />, portalTarget) : null}
  </>;
}
