"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal, X } from "lucide-react";
import { MOBILE_TABS, isActive, visibleNav } from "@/lib/admin-nav";
import type { Permission } from "@/lib/permissions";

// Thanh đáy điện thoại: 4 tab chính + "Thêm" mở danh sách các mục còn lại.
export function MobileTabBar({ perms }: { perms: Permission[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = visibleNav(perms);
  const tabs = nav.filter((n) => MOBILE_TABS.includes(n.href)).sort((a, b) => MOBILE_TABS.indexOf(a.href) - MOBILE_TABS.indexOf(b.href));
  const more = nav.filter((n) => !MOBILE_TABS.includes(n.href));
  const moreActive = more.some((n) => isActive(pathname, n.href));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Các mục khác">
          <button type="button" aria-label="Đóng" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface pb-[calc(env(safe-area-inset-bottom)+72px)] shadow-[0_-8px_24px_rgba(8,72,47,0.15)]">
            <div className="flex items-center justify-between px-5 pb-2 pt-4">
              <span className="text-base font-semibold">Các mục khác</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="grid size-10 place-items-center rounded-full hover:bg-sunk">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-2 px-4 pb-2">
              {more.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-[var(--radius-card)] px-2 text-center text-[13px] leading-tight ${
                      isActive(pathname, href) ? "bg-brand-tint font-semibold text-brand" : "bg-ground text-ink"
                    }`}
                  >
                    <Icon className="size-5" aria-hidden />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <nav
        aria-label="Menu chính"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ul className="grid h-16 grid-cols-5">
          {tabs.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] ${active ? "font-semibold text-brand" : "text-ink-2"}`}
                >
                  <Icon className="size-5" aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={`flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] ${moreActive || open ? "font-semibold text-brand" : "text-ink-2"}`}
            >
              <MoreHorizontal className="size-5" aria-hidden />
              Thêm
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
