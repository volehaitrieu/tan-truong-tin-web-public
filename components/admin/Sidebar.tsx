"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive, visibleNav } from "@/lib/admin-nav";
import type { Permission } from "@/lib/permissions";
import { SHOP } from "@/lib/shop";
import { Logo } from "@/components/brand/Logo";

export function Sidebar({ perms }: { perms: Permission[] }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[72px] shrink-0 flex-col bg-brand-deep text-white md:flex xl:w-60">
      <div className="flex h-16 items-center px-4">
        <span className="hidden xl:block">
          <Logo size={34} subtitle="Quản trị cửa hàng" tone="light" />
        </span>
        <span className="mx-auto text-sm font-bold tracking-tight xl:hidden" aria-label="Tân Trường Tín">TTT</span>
      </div>
      <nav aria-label="Menu quản trị" className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {visibleNav(perms).map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={label}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-all duration-200 ${
                    active ? "bg-white/12 font-semibold text-white" : "text-white/75 hover:bg-white/8 hover:text-white"
                  }`}
                >
                  {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-gold" aria-hidden />}
                  <Icon className="size-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110" aria-hidden />
                  <span className="hidden truncate xl:inline">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <p className="hidden px-5 py-4 text-xs text-white/60 xl:block">Hotline {SHOP.phone}</p>
    </aside>
  );
}
