import Image from "next/image";
import Link from "next/link";
import { Phone } from "lucide-react";
import { SHOP } from "@/lib/shop";

// Banner đầu trang chủ (mẫu 4 chủ shop chọn): ảnh mặt tiền phủ kín thẻ, cửa hàng nằm bên phải,
// chữ và nút chỉ ở nửa trái. Lớp dưới là bản mờ của chính tấm ảnh để lấp phần trái.
export function ShopBanner() {
  return (
    <section aria-label="Cửa hàng Tân Trường Tín" className="shop-banner mb-6">
      <Image src="/shop/mat-tien-mo.webp" alt="" width={96} height={128} unoptimized aria-hidden className="shop-banner-bg" />
      <Image
        src="/shop/mat-tien.webp"
        alt="Mặt tiền cửa hàng Tân Trường Tín trên đường 2/4, Nha Trang"
        width={765}
        height={1020}
        sizes="(min-width: 640px) 700px, 440px"
        priority
        className="shop-banner-photo"
      />
      <div className="shop-banner-scrim" aria-hidden />
      <div className="shop-banner-body">
        <div>
          <h2 className="text-base font-bold leading-snug tracking-tight text-white">Xem quạt, ấm siêu tốc tại cửa hàng</h2>
          <p className="mt-1.5 text-xs leading-snug text-[#d8dce4]">Mở {SHOP.hours} hằng ngày</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/danh-muc/quat" className="inline-flex h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-brand px-[13px] text-[13px] font-semibold text-white hover:bg-brand-deep active:scale-[0.98]">Xem quạt</Link>
          <a href="tel:0948732064" aria-label={`Gọi shop ${SHOP.phone}`} className="grid size-11 shrink-0 place-items-center rounded-full border-[1.5px] border-white bg-white text-brand hover:bg-brand-tint active:scale-[0.98]">
            <Phone className="size-5" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
