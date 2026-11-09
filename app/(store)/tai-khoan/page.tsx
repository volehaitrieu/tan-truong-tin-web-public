import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, PackageCheck, UserRound } from "lucide-react";

export const metadata: Metadata = { title: "Tài khoản khách hàng" };

export default function CustomerAccountPage() {
  return (
    <div className="mx-auto max-w-4xl">
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      <p className="text-sm font-semibold text-brand">Khu vực khách hàng</p>
      <h1 className="mt-1 text-[28px] font-extrabold sm:text-[34px]">Tài khoản của bạn</h1>
      <p className="mt-2 max-w-2xl text-ink-2">Theo dõi đơn hàng và lưu thông tin nhận hàng tại một nơi.</p>

      <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
        <section className="rounded-md border border-line bg-white p-5 sm:p-7" aria-labelledby="account-login-title">
          <div className="grid size-12 place-items-center rounded-md bg-brand-tint text-brand"><UserRound className="size-6" aria-hidden /></div>
          <h2 id="account-login-title" className="mt-4 text-xl font-bold">Đăng nhập hoặc tạo tài khoản</h2>
          <p className="mt-2 text-sm leading-6 text-ink-2">Giao diện tài khoản đang được chuẩn bị. Bạn vẫn đặt hàng và tra cứu đơn không cần tài khoản.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/tai-khoan/dang-nhap" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#181818] px-6 font-semibold text-[#ECE7E9] hover:bg-[#2F2F2F]">Đăng nhập <ArrowRight className="size-4" aria-hidden /></Link>
            <Link href="/tai-khoan/dang-ky" className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-white px-6 font-semibold text-ink hover:bg-sunk">Tạo tài khoản mới</Link>
          </div>
          <p className="mt-3 text-xs text-ink-2">Bản xem trước · Chưa tạo tài khoản thật.</p>
        </section>

        <aside className="space-y-3">
          <div className="rounded-md border border-line bg-white p-4">
            <PackageCheck className="size-5 text-brand" aria-hidden />
            <h2 className="mt-2 font-semibold">Lịch sử đơn hàng</h2>
            <p className="mt-1 text-sm text-ink-2">Đơn đã đặt sẽ hiển thị sau khi đăng nhập được kết nối.</p>
          </div>
          <div className="rounded-md border border-line bg-white p-4">
            <MapPin className="size-5 text-brand" aria-hidden />
            <h2 className="mt-2 font-semibold">Địa chỉ nhận hàng</h2>
            <p className="mt-1 text-sm text-ink-2">Lưu địa chỉ thường dùng để đặt hàng nhanh hơn.</p>
          </div>
          <Link href="/tra-cuu" className="flex min-h-11 items-center justify-center rounded-md border border-brand bg-white px-4 text-sm font-semibold text-brand hover:bg-brand-tint">Tra cứu đơn hiện tại</Link>
        </aside>
      </div>
    </div>
  );
}
