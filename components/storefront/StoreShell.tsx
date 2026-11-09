import Link from "next/link";
import type { ReactNode } from "react";
import { Map, MapPin, ReceiptText, ShoppingCart, UserRound } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { StoreSearch } from "@/components/storefront/StoreSearch";
import { HeaderSearchToggle } from "@/components/storefront/HeaderSearchToggle";
import { CartCount } from "@/components/storefront/CartControls";
import { MobileBottomNav } from "@/components/storefront/MobileBottomNav";
import { StoreBackButton } from "@/components/storefront/StoreBackButton";
import { FloatActions } from "@/components/storefront/FloatActions";
import { CompareBar } from "@/components/storefront/compare/CompareBar";
import { getCategoryMenu } from "@/lib/catalog";
import { SHOP } from "@/lib/shop";

export const POLICIES = [
  ["doi-tra", "Đổi trả"],
  ["bao-hanh", "Bảo hành"],
  ["van-chuyen", "Vận chuyển"],
  ["thanh-toan", "Thanh toán"],
  ["bao-mat", "Bảo mật"],
  ["gioi-thieu", "Giới thiệu"],
] as const;

export async function StoreShell({ children }: { children: ReactNode }) {
  const categoryMenu = await getCategoryMenu();
  return (
    <div className="store flex min-h-screen flex-col pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-line bg-ground/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-3 sm:gap-6">
          <Link href="/" className="hdr-logo shrink-0" aria-label="Tân Trường Tín — Trang chủ">
            {/* Điện thoại: chữ thương hiệu như thiết kế v2 (logo ảnh đang hoãn); máy tính vẫn dùng logo hiện có */}
            <span className="flex flex-col leading-tight md:hidden">
              <span className="text-lg font-bold tracking-tight text-brand">Tân Trường Tín</span>
              <span className="text-xs text-ink-2">Điện nước · Quạt · Gia dụng</span>
            </span>
            <span className="hidden md:block"><Logo size={40} subtitle={SHOP.tagline} subtitleClassName="hidden lg:block" /></span>
          </Link>
          <div className="hidden min-w-0 flex-1 sm:block"><StoreSearch /></div>
          <Link href="/tra-cuu" className="ml-auto hidden min-h-11 items-center gap-1.5 text-sm font-medium text-brand hover:underline sm:ml-0 md:flex">
            <ReceiptText className="size-4" aria-hidden />Tra cứu đơn
          </Link>
          {/* Điện thoại: tìm kiếm thu nhỏ + Tài khoản ở góc phải, giỏ hàng chỉ nằm ở thanh dưới */}
          <HeaderSearchToggle />
          <Link href="/tai-khoan" aria-label="Tài khoản" title="Tài khoản" className="hdr-acct flex min-h-11 items-center gap-1.5 rounded-full text-sm font-medium text-brand hover:bg-brand-tint sm:ml-auto md:ml-0 md:px-1">
            <span className="hdr-acct-dot grid size-11 place-items-center rounded-full bg-sunk text-ink md:size-8 md:bg-brand md:text-white"><UserRound className="size-[22px] md:size-[18px]" aria-hidden /></span><span className="hidden md:inline">Tài khoản</span>
          </Link>
          {/* Máy tính không có thanh dưới nên vẫn giữ nút giỏ hàng ở đầu trang */}
          <Link href="/gio-hang" aria-label="Giỏ hàng" className="relative hidden size-11 shrink-0 place-items-center rounded-full text-ink hover:bg-sunk md:grid">
            <ShoppingCart className="size-6" aria-hidden />
            <CartCount />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-4 pb-10 pt-5">
        <StoreBackButton />
        {children}
      </main>

      <footer className="border-t border-line bg-ground text-ink md:bg-sunk">
        {/* Điện thoại: chân trang gọn, căn giữa theo thiết kế v2 */}
        <div className="flex flex-col items-center px-4 py-6 text-center md:hidden">
          <span className="text-lg font-bold tracking-tight text-brand">Tân Trường Tín</span>
          <span className="mt-0.5 text-[13px] text-ink-2">{SHOP.tagline}</span>
          <ul className="mt-4 grid w-full max-w-xs grid-cols-3 gap-2">
            {POLICIES.map(([id, label]) => (
              <li key={id}>
                <Link href={`/chinh-sach#${id}`} className="flex min-h-11 items-center justify-center rounded-lg bg-sunk px-2 text-[13px] font-medium hover:text-brand active:bg-brand-tint">{label}</Link>
              </li>
            ))}
          </ul>
          <a href="https://www.google.com/maps/search/?api=1&query=379+%C4%91%C6%B0%E1%BB%9Dng+2%2F4+Nha+Trang" target="_blank" rel="noopener" className="mt-4 inline-flex h-11 items-center gap-1.5 rounded-full bg-sunk px-5 text-sm font-semibold hover:bg-brand-tint">
            <Map className="size-[18px] text-brand" aria-hidden />Mở Google Maps
          </a>
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-2">© 2026 Tân Trường Tín. {SHOP.address}.</p>
        </div>
        <div className="mx-auto hidden max-w-[1240px] gap-8 px-4 py-10 md:grid md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Logo size={40} subtitle={SHOP.tagline} />
            <p className="mt-4 text-sm italic text-ink-2">“{SHOP.slogan}”</p>
            <p className="mt-3 text-sm text-ink-2">{SHOP.address}</p>
            <p className="flex flex-wrap gap-x-4 text-sm text-ink-2">
              <a href="tel:0948732064" className="inline-flex min-h-11 items-center hover:text-brand">{SHOP.phone}</a>
              <a href="tel:0793783379" className="inline-flex min-h-11 items-center hover:text-brand">{SHOP.phone2}</a>
            </p>
            <p className="mt-1 text-sm text-ink-2">Mở cửa {SHOP.hours} hằng ngày</p>
          </div>
          <nav aria-label="Chính sách">
            <h2 className="font-semibold">Chính sách</h2>
            <ul className="mt-2 grid grid-cols-2 sm:grid-cols-1">
              {POLICIES.map(([id, label]) => (
                <li key={id}>
                  <Link href={`/chinh-sach#${id}`} className="flex min-h-11 items-center text-sm text-ink-2 hover:text-brand sm:min-h-9">{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h2 className="font-semibold">Bản đồ</h2>
            <a
              href="https://www.google.com/maps/search/?api=1&query=379+%C4%91%C6%B0%E1%BB%9Dng+2%2F4+Nha+Trang"
              target="_blank"
              rel="noopener"
              className="mt-3 grid h-32 place-items-center rounded-xl border border-line bg-white text-sm text-brand hover:bg-brand-tint"
            >
              <span className="flex items-center gap-2"><MapPin className="size-5" aria-hidden />Mở Google Maps</span>
            </a>
          </div>
        </div>
        <p className="hidden border-t border-line px-4 py-4 text-center text-xs text-ink-3 md:block">© 2026 Tân Trường Tín · Nha Trang</p>
      </footer>

      {/* Nút nổi Zalo + Gọi */}
      <FloatActions />

      {/* Thanh so sánh sản phẩm (chỉ hiện khi đã chọn món) */}
      <CompareBar />

      {/* Thanh đáy điện thoại */}
      <MobileBottomNav menu={categoryMenu} />
    </div>
  );
}
