import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Đăng nhập quản trị" };

// ?het-phien=1: proxy.ts vừa tự đăng xuất vì bỏ không dùng quá 7 ngày
// Bố cục v2 (chủ shop chốt 3/11/2026): ảnh mặt tiền thật ở trên mờ dần vào nền kem-hồng nhạt, một tiêu đề, form bán trong suốt,
// nút đen mực. Không logo, không tên cửa hàng, không chữ phụ cuối trang. Điện thoại tràn viền; máy tính căn giữa.
const FADE = "linear-gradient(180deg, #000 0, #000 52%, transparent 96%)";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ "het-phien"?: string }> }) {
  const expired = (await searchParams)["het-phien"] === "1";
  return (
    <main className="min-h-dvh bg-[#F1EDEA] bg-[linear-gradient(180deg,#F1EDEA_0%,#F3F0E9_32%,#EFE9E6_58%,#EFE6E4_82%,#F0E6E5_100%)] md:grid md:place-items-center md:p-8">
      <div className="mx-auto w-full max-w-[440px] md:overflow-hidden md:rounded-3xl md:border md:border-white/70 md:bg-[#FAF7F6]/70 md:shadow-[0_24px_60px_-24px_rgba(24,24,24,0.35)]">
        <div className="relative h-[340px] md:h-[300px]">
          <Image
            src="/shop/mat-tien.webp"
            alt="Mặt tiền cửa hàng Tân Trường Tín trên đường 2/4, Nha Trang"
            fill
            priority
            sizes="(min-width: 768px) 440px, 100vw"
            className="object-cover object-[50%_59%]"
            style={{ WebkitMaskImage: FADE, maskImage: FADE }}
          />
          <h1 className="absolute inset-x-0 bottom-1 text-center text-[28px] font-bold tracking-tight text-[#181818]">Đăng nhập quản trị</h1>
        </div>
        <div className="px-[22px] pb-8 pt-4">
          {expired && (
            <p role="status" className="mb-4 rounded-2xl border border-white/90 bg-white/70 px-3 py-2.5 text-sm text-[#181818]">
              Phiên đăng nhập đã hết hạn vì lâu không dùng. Vui lòng đăng nhập lại.
            </p>
          )}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
