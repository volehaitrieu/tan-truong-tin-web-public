"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Check, ChevronDown, Phone, SlidersHorizontal, X } from "lucide-react";
import { PriceRange, type PriceError } from "@/components/storefront/PriceRange";
import { clamp, fmtNumber, PRICE_STEP } from "@/components/storefront/priceFilter";
import { ProductCard } from "@/components/storefront/ProductCard";
import { discountPct, HOME_PAGE_SIZE, PAGE_SIZE, type Category, type Product } from "@/lib/mock/store";

const PRICES = [
  { id: "duoi-100", label: "Dưới 100.000₫", test: (n: number) => n < 100000 },
  { id: "100-500", label: "100.000₫ – 500.000₫", test: (n: number) => n >= 100000 && n <= 500000 },
  { id: "500-1tr", label: "500.000₫ – 1.000.000₫", test: (n: number) => n > 500000 && n <= 1000000 },
  { id: "tren-1tr", label: "Trên 1.000.000₫", test: (n: number) => n > 1000000 },
];
const SORTS = [
  ["pho-bien", "Phổ biến"],
  ["gia-tang", "Giá thấp → cao"],
  ["gia-giam", "Giá cao → thấp"],
  ["giam-nhieu", "Giảm nhiều nhất"],
  ["ten", "Tên A–Z"],
] as const;
const URL_FILTERS = ["cat", "sub", "brand", "price", "state", "classification", "min", "max"];

// Nút "Xem tiếp N sản phẩm" kèm vòng tiến độ (đã hiện / tổng), theo thiết kế Stitch v2.
// Nút "Xem thêm N sản phẩm" kèm vòng tiến độ (đã hiện / tổng), theo thiết kế Stitch v2. Chỉ tải khi chủ động bấm.
function MoreButton({ shown, total, next, onClick }: { shown: number; total: number; next: number; onClick: () => void }) {
  const done = Math.round((shown / total) * 100);
  return (
    <button type="button" onClick={onClick} className="mt-6 flex h-12 w-full items-center justify-between rounded-full bg-brand px-4 font-semibold text-white shadow-md transition hover:bg-brand-deep active:scale-[0.98] md:mx-auto md:w-fit md:gap-4 md:px-6">
      <span className="flex items-center gap-3">
        <span className="relative grid size-7 shrink-0 place-items-center" aria-hidden>
          <svg viewBox="0 0 36 36" className="size-7 -rotate-90">
            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3.5" />
            <circle cx="18" cy="18" r="15.9155" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${done}, 100`} />
          </svg>
          <span className="num absolute text-[9px] font-bold leading-none">{done}%</span>
        </span>
        Xem thêm {next} sản phẩm
      </span>
      <ChevronDown className="size-5 md:hidden" aria-hidden />
    </button>
  );
}

type Group = { key: string; title: string; options: { id: string; label: string }[]; test: (p: Product, id: string) => boolean };
type Picked = Record<string, string[]>;
type Sort = (typeof SORTS)[number][0];

// Bộ lọc Điều khiển thống nhất (chủ shop chốt 08/11): 6 lựa chọn. Quạt có nhiều kiểu (vd. nút nhấn + remote) hiện ở mọi ô liên quan.
// Các giá trị không rõ ("Cơ", "Đang cập nhật"…) không tạo ô riêng.
const CONTROL_FILTERS = [
  { id: "control:remote", label: "Remote", test: /remote|điều khiển từ xa/ },
  { id: "control:push-button", label: "Nút nhấn", test: /nút nhấn|nút bấm|phím bấm/ },
  { id: "control:knob", label: "Núm vặn", test: /núm vặn|núm xoay|nút xoay/ },
  { id: "control:one-pull-cord", label: "Dây giật", test: /dây giật|giật dây|kéo dây|nút kéo/ },
  { id: "control:two-pull-cords", label: "2 dây giật", test: /(?:2|hai) dây (?:giật|kéo)/ },
  { id: "control:wall-box", label: "Hộp số gắn tường", test: /hộp số/ },
] as const;

function controlOptions(product: Product) {
  const values = product.specs
    .filter(([key]) => key === "Điều khiển" || key === "Remote")
    .map(([key, value]) => (key === "Remote" && /^có$/i.test(value.trim()) ? "remote" : value))
    // Bỏ phần phủ định ("…, không có remote") để không tính nhầm là có remote.
    .map((value) => value.toLocaleLowerCase("vi").replace(/,?\s*(?:không có|không|chưa có)\s*(?:remote|điều khiển từ xa)/g, ""));
  const ids = CONTROL_FILTERS.filter((option) => values.some((value) => option.test.test(value))).map((option) => option.id as string);
  // "2 dây giật" đã gồm dây giật: không tính thêm "Dây giật" cho cùng quạt.
  return ids.includes("control:two-pull-cords") ? ids.filter((id) => id !== "control:one-pull-cord") : ids;
}

function controlLabel(id: string) {
  return CONTROL_FILTERS.find((option) => option.id === id)?.label ?? id;
}

function paramKey(key: string) {
  return key.startsWith("spec:") ? `spec.${key.slice(5)}` : key;
}

export function ProductBrowser({ products, categories, showSort = true, showSale = false }: { products: Product[]; categories: Category[]; fixedCat?: string; showSort?: boolean; showSale?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const serializedParams = searchParams.toString();
  const navigationKey = `${pathname}?${serializedParams}`;
  const pageSize = showSale ? HOME_PAGE_SIZE : PAGE_SIZE;
  const [pagination, setPagination] = useState({ key: navigationKey, count: pageSize });
  const [sheet, setSheet] = useState(false);
  const [priceDraft, setPriceDraft] = useState<{ key: string; lo: number; hi: number } | null>(null);
  const [priceError, setPriceError] = useState<PriceError | null>(null);
  const loRef = useRef<HTMLInputElement>(null);
  const hiRef = useRef<HTMLInputElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const [engaged, setEngaged] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const shown = pagination.key === navigationKey ? pagination.count : pageSize;

  // Chủ shop chốt 07/11: bảng Lọc chỉ có 4 nhóm theo thứ tự Phân loại, Điều khiển, Khoảng giá, Thương hiệu.
  const groups = useMemo<Group[]>(() => {
    const uniq = (xs: string[]) => [...new Set(xs)].map((x) => ({ id: x, label: x }));
    const g: Group[] = [];
    const classificationCounts = new Map<string, number>();
    // Một SP có thể thuộc nhiều Phân loại: đếm mỗi SP một lần cho mỗi loại; chọn nhiều loại = HOẶC (thuộc ít nhất một loại).
    for (const product of products) for (const name of new Set(product.classifications ?? [])) classificationCounts.set(name, (classificationCounts.get(name) ?? 0) + 1);
    const classifications = [...classificationCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "vi")).map(([id]) => ({ id, label: id }));
    if (classifications.length) g.push({ key: "classification", title: "Phân loại", options: classifications, test: (p, id) => (p.classifications ?? []).includes(id) });
    const isFanList = products.length > 0 && products.every((product) => product.sub === "Quạt");
    if (isFanList) {
      const controls = [...new Set(products.flatMap(controlOptions))];
      g.push({ key: "spec:Điều khiển", title: "Điều khiển", options: CONTROL_FILTERS.filter((option) => controls.includes(option.id)).map((option) => ({ id: option.id, label: controlLabel(option.id) })), test: (p, id) => controlOptions(p).includes(id) });
    }
    g.push({ key: "price", title: "Khoảng giá", options: PRICES, test: (p, id) => PRICES.find((x) => x.id === id)!.test(p.price) });
    g.push({ key: "brand", title: "Thương hiệu", options: uniq(products.map((p) => p.brand).filter(Boolean)), test: (p, id) => p.brand === id });
    return g;
  }, [products]);

  const picked = useMemo<Picked>(() => {
    const next: Picked = {};
    for (const group of groups) {
      const allowed = new Set(group.options.map((option) => option.id));
      const values = [...new Set(new URLSearchParams(serializedParams).getAll(paramKey(group.key)))].filter((value) => allowed.has(value));
      if (values.length) next[group.key] = values;
    }
    return next;
  }, [groups, serializedParams]);

  const sort = useMemo<Sort>(() => {
    const allowed = new Set<string>(SORTS.map(([id]) => id));
    return new URLSearchParams(serializedParams).getAll("sort").find((value): value is Sort => allowed.has(value)) ?? "pho-bien";
  }, [serializedParams]);

  const updateUrl = (key: string, values: string[], history: "push" | "replace" = "push") => {
    const params = new URLSearchParams(serializedParams);
    params.delete(key);
    [...new Set(values)].forEach((value) => params.append(key, value));
    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router[history](url, { scroll: false });
  };

  // Back/Forward are external navigation events; reset ephemeral UI from the subscription.
  useEffect(() => {
    const resetEphemeralState = () => {
      setPagination({ key: "", count: PAGE_SIZE });
    };
    window.addEventListener("popstate", resetEphemeralState);
    return () => window.removeEventListener("popstate", resetEphemeralState);
  }, []);

  const beforePrice = products.filter((p) => groups.every((g) => g.key === "price" || !picked[g.key]?.length || picked[g.key].some((id) => g.test(p, id))));
  // Hai đầu thanh giá cố định theo cả danh sách, không co theo hãng/phân loại đang chọn (tránh số đếm vòng lặp).
  const prices = products.map((p) => p.price);
  const bounds = { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };
  const readPrice = (key: string, fallback: number) => {
    const raw = searchParams.get(key);
    const value = raw !== null && raw.trim() !== "" ? Number(raw) : NaN;
    return Number.isSafeInteger(value) && value >= 0 ? clamp(value, bounds.min, bounds.max) : fallback;
  };
  // Older price-chip URLs still select the equivalent interval until the next price edit.
  const legacyPrices = picked.price?.length ? beforePrice.filter((p) => picked.price.some((id) => PRICES.find((option) => option.id === id)?.test(p.price))).map((p) => p.price) : [];
  const lower = readPrice("min", legacyPrices.length ? Math.min(...legacyPrices) : bounds.min);
  const upper = readPrice("max", legacyPrices.length ? Math.max(...legacyPrices) : bounds.max);
  const applied = lower <= upper ? { lo: lower, hi: upper } : { lo: bounds.min, hi: bounds.max };
  const priceKey = `${navigationKey}:${bounds.min}:${bounds.max}`;
  const displayedPrice = priceDraft?.key === priceKey ? priceDraft : applied;
  const priceOn = applied.lo > bounds.min || applied.hi < bounds.max;
  const changePrice = (lo: number, hi: number) => { setEngaged(true); setPriceDraft({ key: priceKey, lo, hi }); };
  const commitPrice = (lo: number, hi: number) => {
    const params = new URLSearchParams(serializedParams);
    params.delete("price"); params.delete("min"); params.delete("max");
    if (lo > bounds.min) params.set("min", String(lo));
    if (hi < bounds.max) params.set("max", String(hi));
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const filter = (skip?: string) => products.filter((p) =>
    groups.every((g) => g.key === "price" || g.key === skip || !picked[g.key]?.length || picked[g.key].some((id) => g.test(p, id)))
    && (skip === "price" || (p.price >= applied.lo && p.price <= applied.hi)));

  useEffect(() => {
    if (engaged || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Mẫu L2: nút Lọc lắc nhẹ 3 lần, nghỉ 4 giây rồi lặp; dừng hẳn khi khách đã bấm Lọc hoặc kéo thanh giá.
    let animation: Animation | undefined;
    let timer = window.setTimeout(function nudge() {
      animation = filterButtonRef.current?.animate([{ transform: "translateX(0)" }, { transform: "translateX(-3px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }], { duration: 500, iterations: 3, easing: "ease-in-out" });
      if (animation) animation.onfinish = () => { timer = window.setTimeout(nudge, 4000); };
    }, 500);
    return () => { window.clearTimeout(timer); animation?.cancel(); };
  }, [pathname, engaged]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = resultsRef.current?.animate([{ opacity: 0.5 }, { opacity: 1 }], { duration: 150, easing: "ease-out" });
    return () => animation?.cancel();
  }, [navigationKey]);

  const results = useMemo(() => {
    const list = filter();
    const by: Partial<Record<Sort, (a: Product, b: Product) => number>> = {
      "gia-tang": (a, b) => a.price - b.price,
      "gia-giam": (a, b) => b.price - a.price,
      "giam-nhieu": (a, b) => discountPct(b) - discountPct(a),
      ten: (a, b) => a.name.localeCompare(b.name, "vi"),
    };
    return by[sort] ? [...list].sort(by[sort]) : list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, picked, sort, groups, applied.lo, applied.hi]);
  const saleHomeProducts = products.filter((product) => product.old);
  const [saleShown, setSaleShown] = useState(pageSize);
  const allHomeProducts = products;

  const toggle = (key: string, id: string) => {
    const group = groups.find((item) => item.key === key);
    if (!group?.options.some((option) => option.id === id)) return;
    if (key === "price") {
      const matches = beforePrice.filter((p) => group.test(p, id)).map((p) => p.price);
      if (!matches.length) return;
      const lo = Math.min(...matches), hi = Math.max(...matches);
      const selected = applied.lo === lo && applied.hi === hi;
      setPriceError(null);
      changePrice(selected ? bounds.min : lo, selected ? bounds.max : hi);
      commitPrice(selected ? bounds.min : lo, selected ? bounds.max : hi);
      return;
    }
    const current = picked[key] ?? [];
    const values = current.includes(id) ? current.filter((value) => value !== id) : [...current, id];
    updateUrl(paramKey(key), values);
  };

  const clearFilters = () => {
    setPriceDraft(null);
    setPriceError(null);
    const params = new URLSearchParams(serializedParams);
    for (const key of URL_FILTERS) params.delete(key);
    for (const key of [...params.keys()]) if (key.startsWith("spec.")) params.delete(key);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const active = groups.filter((g) => g.key !== "price").flatMap((g) => (picked[g.key] ?? []).map((id) => ({ g, id, label: g.options.find((o) => o.id === id)?.label ?? id })));
  const activeCount = active.length + (priceOn ? 1 : 0);

  if (showSale) {
    return (
      <div className="min-w-0">
        {/* Chưa có sản phẩm giảm giá thì ẩn cả khối, không hiện khung trống */}
        {saleHomeProducts.length > 0 && (
        <section className="mb-8" aria-labelledby="h-giam-gia">
          <h2 id="h-giam-gia" className="mb-3 text-lg font-bold sm:text-[22px]">Sản phẩm đang giảm giá ({saleHomeProducts.length})</h2>
          {saleHomeProducts.length ? <><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{saleHomeProducts.slice(0, saleShown).map((p) => <ProductCard key={p.sku} p={p} />)}</div>{saleHomeProducts.length > saleShown && <MoreButton shown={saleShown} total={saleHomeProducts.length} next={Math.min(pageSize, saleHomeProducts.length - saleShown)} onClick={() => setSaleShown(saleShown + pageSize)} />}</> : <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-2">Hiện chưa có sản phẩm giảm giá.</p>}
        </section>
        )}
        <section aria-labelledby="h-tat-ca">
          <h2 id="h-tat-ca" className="mb-3 text-lg font-bold sm:text-[22px]">Tất cả sản phẩm ({allHomeProducts.length})</h2>
          {allHomeProducts.length ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {allHomeProducts.slice(0, shown).map((p) => <ProductCard key={p.sku} p={p} />)}
              </div>
              {allHomeProducts.length > shown && <MoreButton shown={shown} total={allHomeProducts.length} next={Math.min(pageSize, allHomeProducts.length - shown)} onClick={() => setPagination({ key: navigationKey, count: shown + pageSize })} />}
            </>
          ) : <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-2">Chưa có sản phẩm.</p>}
        </section>
      </div>
    );
  }

  const panel = (
    <div className="space-y-1">
      {groups.map((g) => {
        const base = filter(g.key);
        if (g.options.length === 0 && g.key !== "spec:Điều khiển") return null;
        const option = (o: Group["options"][number]) => {
          const matching = base.filter((p) => g.test(p, o.id));
          const n = matching.length;
          const on = g.key === "price" ? priceOn && n > 0 && applied.lo === Math.min(...matching.map((p) => p.price)) && applied.hi === Math.max(...matching.map((p) => p.price)) : picked[g.key]?.includes(o.id) ?? false;
          // Mẫu C1: chỉ ô tick đổi trạng thái (không tô nền, không co cả dòng); ô tick nhún nhẹ khi nhấn.
          return <label key={o.id} className={`group flex min-h-11 cursor-pointer items-center gap-3 text-sm ${n === 0 && !on ? "cursor-not-allowed opacity-40" : ""}`}>
            <input type="checkbox" checked={on} disabled={n === 0 && !on} onChange={() => toggle(g.key, o.id)} className="peer sr-only" />
            <span aria-hidden="true" className={`grid size-[18px] shrink-0 place-items-center rounded-[5px] border-[1.5px] transition-[background-color,border-color,transform] duration-150 group-active:scale-90 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand motion-reduce:transition-none motion-reduce:transform-none ${on ? "border-brand bg-brand text-white" : "border-ink-2 bg-surface"}`}>
              {on && <Check className="anim-tick size-3" strokeWidth={3} />}
            </span>
            <span className={`flex-1 transition-colors duration-150 ${on ? "font-semibold text-ink" : ""}`}>{o.label}</span><span className="num text-xs text-ink-2">{n}</span>
          </label>;
        };
        return <fieldset key={g.key} className="border-t border-line py-3 first:border-0 first:pt-0">
          <legend className="mb-1 text-sm font-semibold">{g.title}</legend>
          {g.key === "spec:Điều khiển" && products.some((p) => controlOptions(p).length === 0) && <p className="mb-2 text-xs leading-relaxed text-ink-2">Một số sản phẩm chưa có thông tin điều khiển.</p>}
          {g.key === "price" && <PriceRange min={bounds.min} max={bounds.max} step={PRICE_STEP} lo={displayedPrice.lo} hi={displayedPrice.hi} error={priceError} onChange={changePrice} onCommit={commitPrice} onError={setPriceError} loRef={loRef} hiRef={hiRef} />}
          {/* Khoảng giá chỉ dùng thanh kéo + hai ô nhập (đã bỏ 4 ô tick, chủ shop yêu cầu 08/11). */}
          {/* Thương hiệu hiện đủ mọi hãng, không còn nút Xem thêm (chủ shop yêu cầu 08/11). */}
          {g.key !== "price" && g.options.map(option)}
        </fieldset>;
      })}
    </div>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden h-fit rounded-md bg-surface p-4 md:sticky md:top-24 md:block" aria-label="Bộ lọc">
        <h2 className="mb-3 font-bold">Bộ lọc</h2>
        {panel}
      </aside>

      <div className="min-w-0">
        {/* Điện thoại: nút Lọc + khoảng giá nhanh. Từ md trở lên bộ lọc bên trái đã có Khoảng giá nên bỏ phần này (chủ shop 08/11). */}
        <div className="mb-3 md:hidden">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <button ref={filterButtonRef} type="button" onClick={() => { setEngaged(true); setSheet(true); }} aria-expanded={sheet} aria-haspopup="dialog" className="relative flex h-11 shrink-0 md:hidden items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm font-semibold transition-colors duration-150 hover:bg-brand-tint">
              <SlidersHorizontal className="size-4" aria-hidden />Lọc{activeCount > 0 && <span className="num">({activeCount})</span>}
            </button>
            <p className="min-w-0 text-right text-[12px] leading-5 text-ink-2">Khoảng giá: <b className="num font-semibold text-ink">{fmtNumber(displayedPrice.lo)}₫ – {fmtNumber(displayedPrice.hi)}₫</b></p>
          </div>
          <PriceRange compact min={bounds.min} max={bounds.max} step={PRICE_STEP} lo={displayedPrice.lo} hi={displayedPrice.hi} error={null} onChange={changePrice} onCommit={commitPrice} onError={setPriceError} loRef={loRef} hiRef={hiRef} />
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-ink-2">Tìm thấy <b className="num text-ink">{results.length}</b> sản phẩm</p>
          <div className="flex items-center gap-2">
            {showSort && (
              <>
                <label className="sr-only" htmlFor="sort">Sắp xếp</label>
                <select id="sort" value={sort} onChange={(event) => updateUrl("sort", event.target.value === "pho-bien" ? [] : [event.target.value], "replace")} className="h-11 rounded-md border border-brand bg-surface px-3 text-sm">
                  {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {results.length > 0 ? (
          <>
            <div ref={resultsRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {results.slice(0, shown).map((p, index) => <div key={p.sku} className="anim-rise grid min-w-0" style={{ "--i": index % pageSize } as CSSProperties}><ProductCard p={p} /></div>)}
            </div>
            {results.length > shown && <MoreButton shown={shown} total={results.length} next={Math.min(pageSize, results.length - shown)} onClick={() => setPagination({ key: navigationKey, count: shown + pageSize })} />}
          </>
        ) : (
          <div className="rounded-md bg-surface px-5 py-10 text-center">
            <h2 className="text-lg font-bold">Chưa có sản phẩm phù hợp</h2>
            <p className="mt-2 text-sm text-ink-2">Thử bỏ bớt bộ lọc, chọn danh mục khác hoặc gọi shop để hỏi hàng.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {categories.map((c) => <Link key={c.slug} href={`/danh-muc/${c.slug}`} className="flex min-h-10 items-center rounded-full bg-sunk px-3 text-[13px] font-medium hover:bg-brand-tint hover:text-brand">{c.name}</Link>)}
            </div>
            <a href="tel:0948732064" className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-brand px-5 font-semibold text-white hover:bg-brand-deep">
              <Phone className="size-4" aria-hidden />Gọi shop · 0948 732 064
            </a>
          </div>
        )}
      </div>

      {sheet && <BrowserFilterDialog count={results.length} invalid={!!priceError} onClear={clearFilters} onClose={() => setSheet(false)}>{panel}</BrowserFilterDialog>}
    </div>
  );
}

function BrowserFilterDialog({ children, count, invalid, onClear, onClose }: { children: ReactNode; count: number; invalid: boolean; onClear: () => void; onClose: () => void }) {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => { cancelAnimationFrame(frame); if (timer.current !== null) clearTimeout(timer.current); document.body.style.overflow = previous; opener?.focus(); };
  }, []);
  const finish = () => {
    if (closing) return;
    setClosing(true);
    timer.current = window.setTimeout(onClose, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160);
  };
  return <div role="dialog" aria-modal="true" aria-label="Bộ lọc" className="fixed inset-0 z-[80]" onKeyDown={(event) => {
    if (event.key === "Escape") { event.preventDefault(); finish(); }
    if (event.key !== "Tab") return;
    const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled])")].filter((el) => el.tabIndex !== -1 && !el.closest("[inert]"));
    const first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <button type="button" tabIndex={-1} aria-label="Đóng bộ lọc" onClick={finish} className={`absolute inset-0 bg-ink/40 transition-opacity duration-[220ms] motion-reduce:transition-none ${entered && !closing ? "opacity-100" : "opacity-0"}`} />
    <div style={{ transitionDuration: closing ? "160ms" : "220ms" }} className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] max-w-lg flex-col rounded-t-2xl bg-surface transition-[transform,opacity] ease-out motion-reduce:transform-none motion-reduce:transition-none ${entered && !closing ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`}>
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2"><b>Bộ lọc</b><button ref={closeRef} type="button" onClick={finish} aria-label="Đóng bộ lọc" className="grid size-11 place-items-center rounded-full bg-sunk"><X className="size-5" aria-hidden /></button></div>
      <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
      <div className="flex shrink-0 gap-2 border-t border-line p-3 pb-[calc(12px+env(safe-area-inset-bottom))]"><button type="button" onClick={onClear} className="h-12 rounded-full border border-line px-5 font-medium">Bỏ chọn</button><button type="button" disabled={invalid} onClick={finish} className="h-12 flex-1 rounded-full bg-brand font-bold text-white disabled:opacity-50">Xem {count} kết quả</button></div>
    </div>
  </div>;
}
