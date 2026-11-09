"use client";
import Link from "next/link";
import { Suspense, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import type { SuggestResult } from "@/lib/suggest";
import { SHOP, formatVnd } from "@/lib/shop";

// Ô tìm kiếm có gợi ý thả xuống; gõ không dấu vẫn ra.
// Gợi ý: nút ngành hàng (khi từ khóa trùng tên ngành) → 5 sản phẩm (tên | giá) → "Đã hiện N/T…" + "Xem thêm" → "Xem tất cả".
// Máy chủ gửi sẵn tối đa 20 dòng; "Xem thêm" hoặc cuộn tới đáy chỉ hiện thêm 5 dòng, không gọi lại máy chủ.
const STEP = 5;
const TEL = `tel:${SHOP.phone.replace(/\D/g, "")}`;

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

// Trang kết quả (/tim-kiem) không còn ô tìm kiếm riêng: ô ở đầu trang tự điền từ khóa đang xem trên địa chỉ.
// Tách ra thành phần con vì useSearchParams cần nằm trong Suspense (trang tĩnh).
function UrlKeyword({ onChange }: { onChange: (keyword: string | null) => void }) {
  const pathname = usePathname();
  const keyword = useSearchParams().get("query");
  useEffect(() => onChange(pathname === "/tim-kiem" ? (keyword ?? "") : null), [pathname, keyword, onChange]);
  return null;
}

// Một mục chọn được bằng bàn phím (mũi tên + Enter). href rỗng = nút "Xem thêm".
type Act = { id: string; href?: string };

export function StoreSearch({ mobile = false, initial = "", autoFocus = false, onDone, endSlot }: { mobile?: boolean; initial?: string; autoFocus?: boolean; onDone?: () => void; endSlot?: ReactNode }) {
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<{ q: string; res: SuggestResult } | null>(null);
  const [shown, setShown] = useState(STEP);
  const [active, setActive] = useState(-1);
  // Chiều cao tối đa của tấm (đến sát bàn phím điện thoại) và, trên điện thoại, vị trí/độ rộng để tấm rộng bằng màn hình
  const [geo, setGeo] = useState<{ left?: number; width?: number; maxH: number }>({ maxH: 420 });
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const uid = useId();
  const q = query.trim();
  // Từ khóa trên địa chỉ trang kết quả → điền vào ô (đổi trong lúc vẽ, không cần effect)
  const [urlKeyword, setUrlKeyword] = useState<string | null>(null);
  const [syncedKeyword, setSyncedKeyword] = useState<string | null>(null);
  if (urlKeyword !== syncedKeyword) {
    setSyncedKeyword(urlKeyword);
    if (urlKeyword) setQuery(urlKeyword);
  }

  // Gợi ý từ server qua GET (gọi song song, hủy được lần gõ cũ, trình duyệt nhớ tạm kết quả nên xóa lùi gần như tức thì).
  useEffect(() => {
    if (!q) return;
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/goi-y?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? (r.json() as Promise<SuggestResult>) : Promise.reject(new Error("suggest"))))
        .then((res) => {
          setFound({ q, res });
          setShown(STEP);
          setActive(-1);
        })
        .catch(() => {}); // bị hủy hoặc lỗi mạng: giữ nguyên tấm hiện có
    }, 120);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const res = found?.res;
  const loading = !!found && found.q !== q; // đang chờ kết quả mới
  // Trong lúc chờ vẫn giữ tấm cũ (rõ nét, không làm mờ) nếu từ khóa mới nối tiếp từ khóa cũ; từ khóa khác hẳn thì ẩn để không hiện nhầm
  // (so không dấu: gõ Telex "a" → "á" cũng tính là nối tiếp)
  const related = !found || fold(q).startsWith(fold(found.q)) || fold(found.q).startsWith(fold(q));
  const panelOpen = open && !!q && !!res && related;
  const items = res?.items ?? [];
  const industries = res?.industries ?? [];
  const visible = items.slice(0, shown);
  const remaining = items.length - visible.length;
  const empty = !!res && res.total === 0 && industries.length === 0;
  const keyword = found?.q ?? "";

  const acts: Act[] = !panelOpen
    ? []
    : empty
      ? [{ id: "call", href: TEL }, { id: "cat", href: "/danh-muc" }]
      : [
          ...industries.map((i) => ({ id: `i-${i.name}`, href: `/danh-muc?industry=${encodeURIComponent(i.name)}` })),
          ...visible.map((p) => ({ id: `p-${p.sku}`, href: `/san-pham/${p.sku}` })),
          ...(remaining > 0 ? [{ id: "more" }] : []),
          { id: "all", href: `/tim-kiem?query=${encodeURIComponent(keyword)}` },
        ];
  const domId = (a: Act) => `${uid}-${a.id}`;

  const close = () => {
    setOpen(false);
    onDone?.();
  };
  const go = (href: string) => {
    close();
    if (href.startsWith("tel:")) window.location.assign(href);
    else router.push(href);
  };
  const more = () => {
    setShown((s) => Math.min(items.length, s + STEP));
    return industries.length + visible.length; // chỉ số dòng mới đầu tiên
  };

  // Đo vị trí tấm: cao tới sát bàn phím điện thoại (visualViewport), rộng bằng màn hình trên điện thoại.
  useEffect(() => {
    if (!panelOpen) return;
    const measure = () => {
      const form = formRef.current;
      if (!form) return;
      const r = form.getBoundingClientRect();
      const vv = window.visualViewport;
      const room = (vv ? vv.height : window.innerHeight) - (r.bottom - (vv ? vv.offsetTop : 0)) - 16;
      const maxH = Math.max(220, Math.min(520, Math.floor(room)));
      setGeo(mobile ? { left: 12 - r.left, width: window.innerWidth - 24, maxH } : { maxH });
    };
    const raf = requestAnimationFrame(measure);
    // Ô tìm kiếm trên điện thoại đang giãn ra khi mở (300ms): đo lại theo từng khung hình để tấm không lệch trái
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (formRef.current) ro?.observe(formRef.current);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [panelOpen, mobile]);

  const select = (i: number) => {
    setActive(i);
    document.getElementById(domId(acts[i]))?.scrollIntoView({ block: "nearest" });
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && !open && res) {
      setOpen(true);
      return;
    }
    if (!panelOpen) return;
    if (e.key === "Escape") setOpen(false);
    else if ((e.key === "ArrowDown" || e.key === "ArrowUp") && acts.length) {
      e.preventDefault();
      select(e.key === "ArrowDown" ? (active + 1) % acts.length : active <= 0 ? acts.length - 1 : active - 1);
    } else if (e.key === "Enter" && active >= 0 && !loading) {
      e.preventDefault();
      const a = acts[active];
      if (a.href) go(a.href);
      else setActive(more());
    }
  };

  const status = !res ? "" : empty ? `Không thấy sản phẩm nào có “${keyword}”` : `Đã hiện ${visible.length}/${res.total} sản phẩm có từ khóa “${keyword}”`;
  const optBase = "aria-selected:bg-brand-tint hover:bg-brand-tint";

  return (
    <form
      ref={formRef}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q) go(`/tim-kiem?query=${encodeURIComponent(q)}`);
      }}
      className="relative flex h-11 min-w-0 items-center rounded-full border border-line bg-white pl-4 shadow-[var(--shadow-soft)] focus-within:border-ink focus-within:shadow-[0_0_0_2px_var(--color-ground),0_0_0_4px_var(--color-ink)]"
    >
      <Search className="size-5 shrink-0 text-brand" aria-hidden />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-label="Tìm sản phẩm"
        aria-autocomplete="list"
        aria-expanded={panelOpen}
        aria-controls={`${uid}-list`}
        aria-activedescendant={panelOpen && active >= 0 && acts[active] ? domId(acts[active]) : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        enterKeyHint="search"
        className="h-full min-w-0 flex-1 bg-transparent px-2 text-[15px] outline-none focus-visible:!rounded-none focus-visible:!shadow-none"
        placeholder={mobile ? "Tìm ống nước, quạt…" : "Tìm ống nước, quạt, công tắc…"}
      />
      {endSlot}
      <button type="submit" className={`h-full rounded-r-full bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep ${mobile ? "sr-only" : ""}`}>
        Tìm
      </button>
      <p role="status" className="sr-only">{panelOpen ? status : ""}</p>
      <Suspense fallback={null}>
        <UrlKeyword onChange={setUrlKeyword} />
      </Suspense>

      {panelOpen && res && (
        <div
          id={`${uid}-list`}
          role="listbox"
          aria-label="Gợi ý sản phẩm"
          aria-busy={loading}
          // Giữ con trỏ trong ô nhập khi bấm hoặc kéo thanh cuộn trong tấm
          onMouseDown={(e) => e.preventDefault()}
          // Trên điện thoại, chưa đo xong vị trí thì ẩn (tránh nháy một khung hình sai chỗ)
          style={{ maxHeight: geo.maxH, left: geo.left, width: geo.width, visibility: mobile && geo.width === undefined ? "hidden" : undefined }}
          className={`absolute top-[calc(100%+6px)] z-50 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-ink ${geo.width ? "" : "left-0 right-0"}`}
        >
          {empty ? (
            <div className="px-5 py-6 text-center">
              <p className="text-base font-bold">Không thấy sản phẩm nào có “{keyword}”</p>
              <p className="mt-1.5 text-sm text-ink-2">Thử gõ ngắn hơn hoặc bỏ dấu. Hoặc gọi shop để hỏi.</p>
              <a id={domId(acts[0])} href={TEL} role="option" aria-selected={active === 0} tabIndex={-1} onClick={close} className="mt-4 flex min-h-11 items-center justify-center rounded-full bg-ink px-4 text-sm font-semibold text-ground aria-selected:outline-2 aria-selected:outline-offset-2 aria-selected:outline-ink">
                Gọi {SHOP.phone}
              </a>
              <Link id={domId(acts[1])} href="/danh-muc" prefetch={false} role="option" aria-selected={active === 1} tabIndex={-1} onClick={close} className="mt-2 flex min-h-11 items-center justify-center rounded-full border border-brand-line bg-sunk px-4 text-sm font-semibold aria-selected:outline-2 aria-selected:outline-offset-2 aria-selected:outline-ink">
                Xem danh mục sản phẩm
              </Link>
            </div>
          ) : (
            <>
              <div
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
                onScroll={(e) => {
                  const el = e.currentTarget;
                  // Chỉ tải thêm khi danh sách thật sự cuộn được và khách đã kéo tới đáy
                  if (remaining > 0 && el.scrollHeight > el.clientHeight && el.scrollTop + el.clientHeight >= el.scrollHeight - 12) more();
                }}
              >
                {industries.length > 0 && (
                  <div className="border-b border-sunk px-3 pb-2.5 pt-2.5">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-2" aria-hidden>Ngành hàng</p>
                    <div className="flex flex-wrap gap-2">
                      {industries.map((ind, i) => (
                        <Link
                          key={ind.name}
                          id={domId(acts[i])}
                          href={`/danh-muc?industry=${encodeURIComponent(ind.name)}`}
                          prefetch={false}
                          role="option"
                          aria-selected={active === i}
                          aria-label={`Ngành hàng ${ind.name}, ${ind.count} sản phẩm`}
                          tabIndex={-1}
                          onClick={close}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-brand-line bg-sunk px-4 text-sm font-semibold hover:border-ink aria-selected:border-ink aria-selected:outline-2 aria-selected:outline-offset-1 aria-selected:outline-ink"
                        >
                          {ind.name}
                          <span className="font-normal text-ink-2">· {ind.count} sản phẩm →</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {visible.map((p, i) => {
                  const idx = industries.length + i;
                  return (
                    <Link
                      key={p.sku}
                      id={domId(acts[idx])}
                      href={`/san-pham/${p.sku}`}
                      prefetch={false}
                      role="option"
                      aria-selected={active === idx}
                      tabIndex={-1}
                      onClick={close}
                      // Cột giá rộng cố định (5,5rem), không kẻ vạch: tên luôn rộng bằng nhau nên mọi dòng xuống hàng cùng chỗ, giá thẳng một cột
                      className={`grid min-h-11 grid-cols-[minmax(0,1fr)_5.5rem] border-b border-sunk text-sm last:border-b-0 ${optBase}`}
                    >
                      <span className="py-2.5 pl-3 pr-2 leading-snug [overflow-wrap:anywhere]">{p.name}</span>
                      <span className={`num flex items-center justify-end whitespace-nowrap py-2.5 pl-1 pr-3 ${p.price > 0 ? "font-bold" : "font-medium text-ink-2"}`}>
                        {p.price > 0 ? formatVnd(p.price) : "Liên hệ"}
                      </span>
                    </Link>
                  );
                })}
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-sunk px-3 py-2">
                <span className="text-xs leading-snug text-ink-2" aria-hidden>{status}</span>
                {remaining > 0 && (
                  <button
                    id={domId(acts[industries.length + visible.length])}
                    type="button"
                    role="option"
                    aria-selected={active === industries.length + visible.length}
                    tabIndex={-1}
                    onClick={() => setActive(more())}
                    className="min-h-11 shrink-0 rounded-full bg-ink px-4 text-sm font-semibold text-ground aria-selected:outline-2 aria-selected:outline-offset-2 aria-selected:outline-ink"
                  >
                    Xem thêm {Math.min(STEP, remaining)}
                  </button>
                )}
              </div>
              <Link
                id={domId(acts[acts.length - 1])}
                href={`/tim-kiem?query=${encodeURIComponent(keyword)}`}
                prefetch={false}
                role="option"
                aria-selected={active === acts.length - 1}
                tabIndex={-1}
                onClick={close}
                className={`flex min-h-11 shrink-0 items-center justify-center border-t border-line px-3 text-sm font-bold ${optBase}`}
              >
                Xem tất cả {res.total} kết quả →
              </Link>
            </>
          )}
        </div>
      )}
    </form>
  );
}
