"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { compareHref, MAX_COMPARE } from "@/lib/compare";
import { useCompareNotice, useCompareSkus } from "@/components/storefront/compare/store";

// Giỏ hàng/thanh toán ưu tiên hoàn tất đơn; trang so sánh đã có sản phẩm ngay trên trang → không hiện thanh nổi.
const HIDDEN = new Set(["/gio-hang", "/thanh-toan", "/so-sanh"]);

// Vị trí/chiều cao thanh do CSS quyết định (globals.css, khối "so sánh"), dựa trên body[data-compare] và body[data-buybar]
// để các thanh đáy không tự đoán chiều cao của nhau.
export function CompareBar() {
  const pathname = usePathname();
  const skus = useCompareSkus();
  const notice = useCompareNotice();
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const count = skus?.length ?? 0;
  const visible = count > 0 && !HIDDEN.has(pathname);

  useEffect(() => {
    if (!visible) return;
    document.body.dataset.compare = "1";
    return () => {
      delete document.body.dataset.compare;
    };
  }, [visible]);

  // Thông báo hiện ~3 giây; vùng role="status" luôn có mặt để đọc màn hình đọc được khi nội dung đổi.
  useEffect(() => {
    if (!notice) return;
    const show = window.setTimeout(() => setToast(notice), 0);
    const hide = window.setTimeout(() => setToast((current) => (current?.id === notice.id ? null : current)), 3200);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [notice]);

  return (
    <>
      <div role="status" aria-live="polite" className="compare-toast pointer-events-none fixed inset-x-0 z-[55] flex justify-start pl-4 pr-[72px] md:justify-center md:pr-4">
        {toast && !HIDDEN.has(pathname) && <p className="pointer-events-auto max-w-sm rounded-md bg-brand-deep px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg">{toast.text}</p>}
      </div>
      {visible && skus && (
        <section aria-label="Sản phẩm đang so sánh" className="compare-bar fixed inset-x-0 z-50 flex items-center gap-3 border-t border-line bg-surface px-4">
          <Link href={compareHref(skus)} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
            <b className="truncate text-sm">Đã chọn {count}/{MAX_COMPARE}{count < 2 ? ` · chọn thêm ${2 - count} sản phẩm` : ""}</b>
            <span className="compare-sub text-xs text-ink-2">Quản lý lựa chọn</span>
          </Link>
          {count >= 2 ? (
            <Link href={compareHref(skus)} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-brand px-5 text-sm font-bold text-white hover:bg-brand-deep">
              <ArrowLeftRight className="size-4" aria-hidden />So sánh ({count})
            </Link>
          ) : (
            <span aria-disabled="true" className="flex h-11 shrink-0 items-center rounded-full border border-line px-5 text-sm font-bold text-ink-3">So sánh ({count})</span>
          )}
        </section>
      )}
    </>
  );
}
