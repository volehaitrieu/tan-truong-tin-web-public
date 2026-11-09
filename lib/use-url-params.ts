"use client";
import { useCallback, useEffect, useRef, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

// Cập nhật tham số trên URL để trang lọc lại mà KHÔNG tải lại cả trang (giữ chỗ cuộn, giữ các bộ lọc khác).
// Dùng cho ô tìm kiếm "lọc ngay khi gõ": đợi LIVE_DELAY_MS sau phím cuối rồi mới gọi máy chủ.
export const LIVE_DELAY_MS = 300;

export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  // updates: tên tham số → giá trị (rỗng/null = bỏ tham số). Đổi bộ lọc thì về trang 1.
  // targetPath: đi sang trang khác (vd. ô "Tìm nhanh" ở đầu trang quản trị → trang Sản phẩm).
  const update = useCallback((updates: Record<string, string | null | undefined>, delay = 0, targetPath?: string) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const run = () => {
      timer.current = null;
      const path = targetPath ?? pathname;
      // Đọc URL lúc chạy (không phải lúc gõ) để không ghi đè bộ lọc vừa đổi trong lúc chờ.
      const params = new URLSearchParams(path === pathname ? window.location.search : "");
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value); else params.delete(key);
      }
      params.delete("page");
      const qs = params.toString();
      const url = qs ? `${path}?${qs}` : path;
      startTransition(() => (path === pathname ? router.replace(url, { scroll: false }) : router.push(url)));
    };
    if (delay > 0) timer.current = window.setTimeout(run, delay); else run();
  }, [pathname, router]);

  return { update, pending };
}
