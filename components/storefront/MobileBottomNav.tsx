"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, LayoutGrid, ReceiptText, ShoppingCart } from "lucide-react";
import { CategoryDrawer } from "@/components/storefront/CategoryDrawer";
import { CartCount } from "@/components/storefront/CartControls";
import type { CategoryMenuTab } from "@/lib/catalog";

export function MobileBottomNav({ menu }: { menu: CategoryMenuTab[] }) {
  const pathname = usePathname();
  const inRoute = (route: string) => pathname === route || pathname.startsWith(`${route}/`);
  const itemClass = (active: boolean) => `mx-1 my-1 flex h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl transition-colors duration-150 motion-reduce:transition-none ${active ? "bg-brand-tint font-semibold text-brand" : "text-ink-2 hover:bg-brand-tint hover:text-brand"}`;
  return <CategoryDrawer menu={menu}>{({ isOpen, toggle, navigate, openerRef }) => {
    const categoryActive = isOpen || inRoute("/danh-muc");
    const links = [
      { href: "/", label: "Trang chủ", icon: House, active: !isOpen && pathname === "/" },
      { href: "/gio-hang", label: "Giỏ hàng", icon: ShoppingCart, active: !isOpen && (inRoute("/gio-hang") || inRoute("/thanh-toan")) },
      { href: "/tra-cuu", label: "Tra cứu đơn", icon: ReceiptText, active: !isOpen && inRoute("/tra-cuu") },
    ];
    const link = (item: typeof links[number]) => <Link key={item.href} href={item.href} aria-current={item.active ? "page" : undefined} onClick={(event) => { if (isOpen && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); navigate(item.href); } }} className={itemClass(item.active)}>
      <span className="relative"><item.icon className="size-5" aria-hidden />{item.href === "/gio-hang" && <CartCount placement="nav" />}</span>{item.label}
    </Link>;
    return <nav data-mobile-nav="" aria-label="Điều hướng nhanh" className="fixed inset-x-0 bottom-0 z-[70] grid grid-cols-4 border-t border-line bg-ground pb-[env(safe-area-inset-bottom)] text-xs md:hidden">
      {link(links[0])}
      <button ref={openerRef} type="button" aria-current={categoryActive ? "page" : undefined} aria-expanded={isOpen} aria-haspopup="dialog" onClick={toggle} className={itemClass(categoryActive)}><LayoutGrid className="size-5" aria-hidden />Danh mục</button>
      {link(links[1])}{link(links[2])}
    </nav>;
  }}</CategoryDrawer>;
}
