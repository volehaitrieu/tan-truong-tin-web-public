"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useUrlParams } from "@/lib/use-url-params";
import { pageList, shownRange } from "@/lib/pagination";
import { formatNum } from "@/lib/shop";

// Chuyển trang dùng chung: "Hiển thị 51–100/101" · ‹ 1 2 3 … 9 › · chọn số dòng mỗi trang.
// Trang và số dòng nằm trên URL (?page=, ?per=) nên Back/Forward và chia sẻ link giữ nguyên.
export function Pagination({ page, pages, perPage, total, perPageOptions, defaultPerPage }: {
  page: number; pages: number; perPage: number; total: number; perPageOptions: readonly number[]; defaultPerPage: number;
}) {
  const params = useSearchParams();
  const { update, pending } = useUrlParams();
  const href = (n: number) => {
    const p = new URLSearchParams(params.toString());
    if (n > 1) p.set("page", String(n)); else p.delete("page");
    const qs = p.toString();
    return qs ? `?${qs}` : "?";
  };
  const { from, to } = shownRange(page, perPage, total);
  const step = "grid size-10 place-items-center rounded-full text-sm";

  return (
    <nav aria-label="Phân trang" className={`mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 text-sm ${pending ? "opacity-60" : ""}`}>
      <p className="text-ink-2">Hiển thị <b className="num text-ink">{formatNum(from)}–{formatNum(to)}</b>/<b className="num text-ink">{formatNum(total)}</b></p>

      {pages > 1 && (
        <ul className="order-last flex w-full items-center justify-center gap-0.5 sm:order-none sm:w-auto">
          <li>{page > 1
            ? <Link href={href(page - 1)} aria-label="Trang trước" className={`${step} text-brand hover:bg-brand-tint`}><ChevronLeft className="size-5" /></Link>
            : <span aria-hidden className={`${step} text-line`}><ChevronLeft className="size-5" /></span>}</li>
          {pageList(page, pages).map((n, i) => (
            <li key={n === "gap" ? `gap-${i}` : n}>
              {n === "gap" ? <span aria-hidden className={`${step} text-ink-2`}>…</span>
                : n === page ? <span aria-current="page" className={`${step} num bg-brand font-semibold text-white`}>{n}</span>
                : <Link href={href(n)} aria-label={`Trang ${n}`} className={`${step} num text-ink-2 hover:bg-brand-tint hover:text-brand`}>{n}</Link>}
            </li>
          ))}
          <li>{page < pages
            ? <Link href={href(page + 1)} aria-label="Trang sau" className={`${step} text-brand hover:bg-brand-tint`}><ChevronRight className="size-5" /></Link>
            : <span aria-hidden className={`${step} text-line`}><ChevronRight className="size-5" /></span>}</li>
        </ul>
      )}

      <label className="flex items-center gap-2 text-ink-2">
        <span>Mỗi trang</span>
        <select value={perPage} onChange={(e) => update({ per: e.target.value === String(defaultPerPage) ? null : e.target.value })}
          className="h-10 rounded-full border border-brand bg-white px-3 text-sm text-brand">
          {perPageOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
    </nav>
  );
}
