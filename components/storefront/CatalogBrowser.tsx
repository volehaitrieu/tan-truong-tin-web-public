"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { FilterSheet } from "@/components/storefront/FilterSheet";
import { ProductCard } from "@/components/storefront/ProductCard";
import { boundsOf, clamp, matchProducts, priceLabel, type Draft } from "@/components/storefront/priceFilter";
import { PAGE_SIZE, type Product } from "@/lib/mock/store";

const SORTS = [
  ["pho-bien", "Sắp xếp: Phổ biến"],
  ["gia-tang", "Giá thấp → cao"],
  ["gia-giam", "Giá cao → thấp"],
  ["ten", "Tên A–Z"],
] as const;
type Sort = (typeof SORTS)[number][0];

const countBy = (names: string[]) => {
  const map = new Map<string, number>();
  for (const n of names) if (n) map.set(n, (map.get(n) ?? 0) + 1);
  return [...map].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
};

// "Phổ biến" ở trang Tất cả: xếp lần lượt từng ngành một (Quạt, Ấm, Quạt, Ấm…) để khách thấy cả hai ngành ngay màn đầu.
// Trong mỗi ngành giữ nguyên thứ tự gốc; hết ngành nhỏ thì phần còn lại của ngành lớn nối tiếp. Sản phẩm chưa có ngành xếp cuối.
function interleaveByIndustry(list: Product[], order: string[]) {
  const lanes = order.map((name) => list.filter((p) => p.industry.trim() === name));
  const out: Product[] = [];
  for (let i = 0; lanes.some((lane) => i < lane.length); i++) for (const lane of lanes) if (i < lane.length) out.push(lane[i]);
  return [...out, ...list.filter((p) => !order.includes(p.industry.trim()))];
}

// Trang /danh-muc. Không chọn ngành: chỉ có chip ngành + sắp xếp. Chọn một ngành (?industry=Quạt):
// thêm nút "Bộ lọc" (thương hiệu, khoảng giá). Mọi lựa chọn nằm trên địa chỉ trang; áp dụng bộ lọc dùng
// replace để nút quay lại của điện thoại không phải bấm nhiều lần.
export function CatalogBrowser({ products }: { products: Product[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serialized = searchParams.toString();
  const navigationKey = `${pathname}?${serialized}`;
  const [pagination, setPagination] = useState({ key: navigationKey, count: PAGE_SIZE, from: 0 });
  const [sheet, setSheet] = useState(false);
  const shown = pagination.key === navigationKey ? pagination.count : PAGE_SIZE;
  const shownFrom = pagination.key === navigationKey ? pagination.from : 0;

  const industries = useMemo(() => countBy(products.map((p) => p.industry.trim())), [products]);
  const industry = useMemo(() => {
    const value = new URLSearchParams(serialized).get("industry");
    return value && industries.some((i) => i.name === value) ? value : null;
  }, [serialized, industries]);

  const scope = useMemo(() => (industry ? products.filter((p) => p.industry.trim() === industry) : products), [products, industry]);
  const bounds = useMemo(() => boundsOf(scope.map((p) => p.price)), [scope]);
  const brandOptions = useMemo(() => countBy(scope.map((p) => p.brand)), [scope]);

  const applied = useMemo<Draft>(() => {
    const params = new URLSearchParams(serialized);
    const allowed = new Set(brandOptions.map((b) => b.name));
    const brands = [...new Set(params.getAll("brand"))].filter((b) => allowed.has(b));
    const num = (key: string) => {
      const raw = params.get(key);
      const v = raw === null ? NaN : Number(raw);
      return Number.isFinite(v) && v > 0 ? v : null;
    };
    const lo = clamp(num("min") ?? bounds.min, bounds.min, bounds.max);
    const hi = clamp(num("max") ?? bounds.max, bounds.min, bounds.max);
    return lo > hi ? { brands, lo: bounds.min, hi: bounds.max } : { brands, lo, hi };
  }, [serialized, brandOptions, bounds]);

  const sort = useMemo<Sort>(() => {
    const value = new URLSearchParams(serialized).get("sort");
    return SORTS.find(([id]) => id === value)?.[0] ?? "pho-bien";
  }, [serialized]);

  const priceOn = applied.lo > bounds.min || applied.hi < bounds.max;
  const activeCount = (applied.brands.length ? 1 : 0) + (priceOn ? 1 : 0);

  const results = useMemo(() => {
    const list = matchProducts(scope, applied);
    if (sort === "gia-tang") return [...list].sort((a, b) => a.price - b.price);
    if (sort === "gia-giam") return [...list].sort((a, b) => b.price - a.price);
    if (sort === "ten") return [...list].sort((a, b) => a.name.localeCompare(b.name, "vi"));
    return industry ? list : interleaveByIndustry(list, industries.map((i) => i.name));
  }, [scope, applied, sort, industry, industries]);

  const replaceParams = (change: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(serialized);
    change(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const applyFilters = (d: Draft) => {
    replaceParams((p) => {
      p.delete("brand");
      p.delete("min");
      p.delete("max");
      d.brands.forEach((b) => p.append("brand", b));
      if (d.lo > bounds.min) p.set("min", String(d.lo));
      if (d.hi < bounds.max) p.set("max", String(d.hi));
    });
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
  };

  const clearFilters = () =>
    replaceParams((p) => {
      p.delete("brand");
      p.delete("min");
      p.delete("max");
    });

  const visible = Math.min(shown, results.length);
  const rest = results.length - visible;
  const title = industry ?? "Tất cả sản phẩm";
  const tags = [...(applied.brands.length ? [applied.brands.join(", ")] : []), ...(priceOn ? [priceLabel(applied.lo, applied.hi, bounds)] : [])];

  return (
    <>
      <h1 className="text-[28px] font-extrabold leading-tight sm:text-[34px]">{title}</h1>
      <p className="mt-1.5 text-[15px] text-ink-2"><span className="num">{scope.length}</span> sản phẩm</p>

      <nav aria-label="Ngành hàng" className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        <Link href="/danh-muc" aria-current={industry ? undefined : "page"} className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-[18px] text-[15px] font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] ${industry ? "bg-sunk hover:bg-line" : "bg-brand text-white"}`}>
          Tất cả <small className={`num text-[13px] font-medium ${industry ? "text-ink-2" : "text-line"}`}>{products.length}</small>
        </Link>
        {industries.map((i) => {
          const on = i.name === industry;
          return (
            <Link key={i.name} href={`/danh-muc?industry=${encodeURIComponent(i.name)}`} aria-current={on ? "page" : undefined} className={`flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-[18px] text-[15px] font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] ${on ? "bg-brand text-white" : "bg-sunk hover:bg-line"}`}>
              {i.name} <small className={`num text-[13px] font-medium ${on ? "text-line" : "text-ink-2"}`}>{i.count}</small>
            </Link>
          );
        })}
      </nav>

      <div className="mt-3.5 flex items-center gap-2.5">
        {industry && (
          <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-label={activeCount ? `Bộ lọc, đang chọn ${activeCount} mục` : "Bộ lọc"} className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97] ${activeCount ? "border-brand bg-brand text-white" : "border-[#918b85] bg-surface hover:bg-sunk"}`}>
            <SlidersHorizontal className="size-5" aria-hidden />
            Bộ lọc{activeCount > 0 && <span className="num"> · {activeCount}</span>}
          </button>
        )}
        <div className="relative min-w-0 flex-1">
          <label className="sr-only" htmlFor="sort">Sắp xếp</label>
          <select id="sort" value={sort} onChange={(e) => replaceParams((p) => (e.target.value === "pho-bien" ? p.delete("sort") : p.set("sort", e.target.value)))} className="min-h-11 w-full appearance-none rounded-full border border-[#918b85] bg-surface pl-4 pr-10 text-sm font-semibold text-ink">
            {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2" aria-hidden />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-2" aria-live="polite">
        <span>Hiển thị <span className="num">{visible}</span> / <span className="num">{results.length}</span></span>
        {tags.map((t) => <span key={t} className="inline-flex min-h-8 items-center rounded-full bg-sunk px-3 text-[13px] font-semibold text-ink">{t}</span>)}
        {tags.length > 0 && <button type="button" onClick={clearFilters} className="min-h-11 px-2 text-sm font-semibold text-ink underline underline-offset-[3px]">Xóa lọc</button>}
      </div>

      {results.length > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {results.slice(0, visible).map((p, i) => (
              <div key={p.sku} className={`min-w-0 ${i >= shownFrom ? "anim-card-in" : ""}`} style={i >= shownFrom ? { animationDelay: `${Math.min((i - shownFrom) * 45, 300)}ms` } : undefined}>
                <ProductCard p={p} />
              </div>
            ))}
          </div>
          {rest > 0 && (
            <div className="mt-7 flex justify-center">
              <button type="button" onClick={() => setPagination({ key: navigationKey, count: visible + PAGE_SIZE, from: visible })} className="h-[52px] rounded-full bg-brand px-7 text-[15px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-brand-deep active:scale-[0.98]">
                Xem thêm {Math.min(rest, PAGE_SIZE)} sản phẩm
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-2xl bg-sunk px-5 py-10 text-center">
          <h2 className="text-lg font-bold">Chưa có sản phẩm phù hợp</h2>
          <p className="mt-2 text-sm text-ink-2">Thử bỏ bớt bộ lọc hoặc gọi shop để hỏi hàng.</p>
          {tags.length > 0 && <button type="button" onClick={clearFilters} className="mt-4 h-11 rounded-full bg-brand px-6 text-sm font-semibold text-white">Xóa lọc</button>}
        </div>
      )}

      {sheet && industry && (
        <FilterSheet
          title={industry}
          brandOptions={brandOptions}
          bounds={bounds}
          initial={applied}
          countFor={(d) => matchProducts(scope, d).length}
          onApply={applyFilters}
          onClose={() => setSheet(false)}
        />
      )}
    </>
  );
}
