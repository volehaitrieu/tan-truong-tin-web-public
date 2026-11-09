"use client";
import { usePathname } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";

// Trang giỏ hàng và thanh toán có thanh dính (tiền + nút Đặt hàng) nằm trên thanh đáy khi màn hình nhỏ hơn lg.
// Chủ shop duyệt 06/11 (phương án B): đẩy 2 nút nổi lên trên thanh dính đó để không che số tiền và nút.
const RAISED = new Set(["/gio-hang", "/thanh-toan"]);

export function FloatActions() {
  const pathname = usePathname();
  const raised = RAISED.has(pathname);
  if (pathname === "/so-sanh") return null;
  const bottom = raised
    ? "bottom-[calc(216px+env(safe-area-inset-bottom))] lg:bottom-6"
    : "bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6";
  return (
    <div className={`float-actions fixed right-3 z-40 flex flex-col gap-2 md:right-6 ${bottom}`}>
      <a href="https://zalo.me/0948732064" aria-label="Nhắn Zalo cho shop" className="grid size-12 place-items-center rounded-full border border-line bg-white text-brand shadow-[var(--shadow-soft)] hover:bg-brand-tint">
        <MessageCircle className="size-6" aria-hidden />
      </a>
      <a href="tel:0948732064" aria-label="Gọi shop" className="grid size-12 place-items-center rounded-full bg-brand text-white shadow-[var(--shadow-float)] hover:bg-brand-deep">
        <Phone className="size-6" aria-hidden />
      </a>
    </div>
  );
}
