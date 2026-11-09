"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Hàng trượt ngang có nút ‹ › (máy tính, chỉ hiện khi còn món để trượt) — điện thoại vuốt tay.
export function Rail({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setCanScroll(el.scrollWidth > el.clientWidth + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const move = (dir: number) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} aria-label={label} className="flex snap-x gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] motion-reduce:scroll-auto [&>*]:w-[46%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-[calc((100%_-_1.5rem)/3)] lg:[&>*]:w-[calc((100%_-_2.25rem)/4)]">
        {children}
      </div>
      {canScroll && (
        <>
          <button type="button" onClick={() => move(-1)} aria-label="Xem trước" className="absolute -left-4 top-1/3 hidden size-10 place-items-center rounded-full border border-line bg-surface hover:bg-brand-tint hover:text-brand md:grid">
            <ChevronLeft className="size-5" />
          </button>
          <button type="button" onClick={() => move(1)} aria-label="Xem tiếp" className="absolute -right-4 top-1/3 hidden size-10 place-items-center rounded-full border border-line bg-surface hover:bg-brand-tint hover:text-brand md:grid">
            <ChevronRight className="size-5" />
          </button>
        </>
      )}
    </div>
  );
}
