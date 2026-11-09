"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

// Logo chỉ dùng các tệp đã có trong kho (public/brand-logos); hãng chưa có logo hiện chữ cái đầu.
const LOGOS: Record<string, string> = {
  ChingHai: "/brand-logos/chinghai.png",
  Lifan: "/brand-logos/lifan.webp",
  Senko: "/brand-logos/senko.png",
};
const PER_PAGE = 4;
const INTERVAL_MS = 3000;

type Brand = { name: string; count: number };

function BrandMark({ name }: { name: string }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-white shadow-sm" aria-hidden>
      {LOGOS[name]
        ? <Image src={LOGOS[name]} alt="" width={40} height={40} className="size-9 object-contain" />
        : <span className="text-sm font-extrabold uppercase text-brand">{name.slice(0, 2)}</span>}
    </span>
  );
}

// Mỗi lần hiện 4 thương hiệu, 3 giây tự sang 4 hãng kế tiếp. Chỉ đứng yên khi đang rê chuột/chạm/focus vào mục này
// và không tự chạy nếu máy bật "giảm chuyển động"; luôn chuyển tay được bằng các chấm.
export function BrandRotator({ brands }: { brands: Brand[] }) {
  const pages = Math.max(1, Math.ceil(brands.length / PER_PAGE));
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  const current = Math.min(page, pages - 1);
  const stopped = hover || reduced;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (pages < 2 || stopped) return;
    const timer = window.setInterval(() => setPage((value) => (value + 1) % pages), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [pages, stopped]);

  if (!brands.length) return null;
  // Nhóm cuối thiếu hãng thì lấy thêm từ đầu danh sách cho đủ 4 ô.
  const start = current * PER_PAGE;
  const visible = Array.from({ length: Math.min(PER_PAGE, brands.length) }, (_, i) => brands[(start + i) % brands.length]);

  return (
    <div onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)} onFocusCapture={() => setHover(true)} onBlurCapture={() => setHover(false)}>
      <div key={current} className="brand-page grid min-h-[152px] grid-cols-2 content-start gap-2 sm:gap-3 lg:grid-cols-4" aria-live="off">
        {visible.map((brand) => (
          <Link key={brand.name} href={`/danh-muc?brand=${encodeURIComponent(brand.name)}`} aria-label={`Xem ${brand.count} sản phẩm thương hiệu ${brand.name}`} className="flex h-[72px] min-w-0 items-center gap-3 rounded-xl bg-brand-tint px-3 shadow-[var(--shadow-soft)] transition-colors hover:bg-brand-hover active:bg-brand-hover">
            <BrandMark name={brand.name} />
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="break-words text-sm font-bold [overflow-wrap:anywhere]">{brand.name}</span>
              <span className="num text-xs text-ink-2">{brand.count} sản phẩm</span>
            </span>
          </Link>
        ))}
      </div>
      {pages > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1">
          <div className="flex" role="group" aria-label="Chọn nhóm thương hiệu">
            {Array.from({ length: pages }, (_, index) => (
              <button key={index} type="button" onClick={() => setPage(index)} aria-label={`Nhóm thương hiệu ${index + 1} trên ${pages}`} aria-current={index === current} className="grid h-11 w-10 place-items-center">
                <span className={`block h-2 rounded-full transition-all duration-200 ${index === current ? "w-5 bg-brand" : "w-2 bg-line"}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
