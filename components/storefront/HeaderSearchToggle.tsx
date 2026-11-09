"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { StoreSearch } from "@/components/storefront/StoreSearch";

// Điện thoại: tìm kiếm thu nhỏ ở đầu trang. Bấm biểu tượng thì ô tìm kiếm phóng dài ra, ép tên cửa hàng
// và nút Tài khoản thu hẹp lại (hiệu ứng ở globals.css, theo thuộc tính body[data-search-open]).
// Đóng bằng nút ×, Esc, bấm ra ngoài hoặc tìm xong.
export function HeaderSearchToggle() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(true);

  useEffect(() => {
    if (!open) return;
    const wrap = wrapRef.current;
    const opener = openerRef.current;
    document.body.dataset.searchOpen = "1";
    const input = wrap?.querySelector("input");
    input?.focus();
    input?.select(); // trang kết quả: ô đã điền sẵn từ khóa, chọn sẵn để gõ đè hoặc sửa
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (wrap && !wrap.contains(e.target as Node)) {
        refocus.current = false; // người dùng đã chạm sang chỗ khác, đừng kéo con trỏ về
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      delete document.body.dataset.searchOpen;
      if (refocus.current) opener?.focus();
      refocus.current = true;
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="hdr-search relative h-11 min-w-0 sm:hidden">
      <button
        ref={openerRef}
        type="button"
        aria-label="Tìm kiếm"
        aria-expanded={open}
        tabIndex={open ? -1 : 0}
        onClick={() => setOpen(true)}
        className={`absolute inset-0 grid place-items-center rounded-full bg-sunk text-ink transition-[opacity,background-color,transform] duration-200 hover:bg-line active:scale-95 ${open ? "pointer-events-none opacity-0" : ""}`}
      >
        <Search className="size-[22px]" aria-hidden />
      </button>
      <div inert={!open} aria-hidden={!open} className={`h-11 transition-opacity duration-200 ${open ? "opacity-100 delay-100" : "pointer-events-none opacity-0"}`}>
        <StoreSearch
          mobile
          onDone={() => setOpen(false)}
          endSlot={
            <button type="button" aria-label="Đóng tìm kiếm" onClick={() => setOpen(false)} className="mr-1 grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-150 hover:bg-sunk">
              <X className="size-[18px]" aria-hidden />
            </button>
          }
        />
      </div>
    </div>
  );
}
