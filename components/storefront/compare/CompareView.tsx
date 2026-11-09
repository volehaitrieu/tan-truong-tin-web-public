"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, X } from "lucide-react";
import { ProductImage } from "@/components/storefront/ProductCard";
import { clearCompare, replaceCompare } from "@/components/storefront/compare/store";
import { buildSpecRows, compareHref, isMissing, MAX_COMPARE, mixedKinds } from "@/lib/compare";
import type { Product } from "@/lib/mock/store";
import { formatVnd } from "@/lib/shop";

const NO_INFO = "Chưa có thông tin";

export function CompareView({ products, missing }: { products: Product[]; missing: number }) {
  const router = useRouter();
  const [onlyDiff, setOnlyDiff] = useState(true);
  const skuKey = products.map((p) => p.sku).join(",");

  // Địa chỉ trang là nguồn quyết định: kho lựa chọn theo đúng các món đang hiển thị (đã loại món không tìm thấy).
  useEffect(() => {
    replaceCompare(skuKey ? skuKey.split(",") : []);
  }, [skuKey]);

  const rows = useMemo(() => buildSpecRows(products), [products]);
  const shownRows = onlyDiff ? rows.filter((row) => row.differs) : rows;
  const mixed = mixedKinds(products);

  const remove = (sku: string) => {
    const rest = products.filter((p) => p.sku !== sku).map((p) => p.sku);
    replaceCompare(rest);
    router.push(compareHref(rest), { scroll: false });
  };
  const removeAll = () => {
    clearCompare();
    router.push("/so-sanh", { scroll: false });
  };

  if (products.length === 0) {
    return (
      <>
        <h1 className="text-[26px] font-extrabold sm:text-[32px]">So sánh sản phẩm</h1>
        {missing > 0 && <p role="status" className="mt-3 text-sm text-ink-2">Không tìm thấy {missing} sản phẩm.</p>}
        <div className="mt-5 rounded-xl border border-line bg-surface p-6 text-center">
          <p className="text-ink-2">Bạn chưa chọn sản phẩm nào để so sánh. Bấm nút <ArrowLeftRight className="inline size-4 align-text-bottom" aria-hidden /> cạnh nút Thêm vào giỏ trên thẻ sản phẩm để thêm tối đa {MAX_COMPARE} món.</p>
          <Link href="/" className="mt-4 inline-flex h-11 items-center rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-deep">Xem sản phẩm</Link>
        </div>
      </>
    );
  }

  const stickyTh = "sticky left-0 z-10 w-[88px] min-w-[88px] border-b border-line px-2 py-3 text-left align-top text-[13px] font-semibold";
  const cell = "border-b border-line px-2 py-3 align-top text-sm";

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-[26px] font-extrabold sm:text-[32px]">So sánh sản phẩm</h1>
        <p className="text-sm text-ink-2"><b className="num text-ink">{products.length}</b>/{MAX_COMPARE} món</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {products.length < MAX_COMPARE && <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold hover:bg-brand-tint">Chọn thêm sản phẩm</Link>}
        <button type="button" onClick={removeAll} className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-ink-2 hover:text-danger">Bỏ hết</button>
      </div>

      {(missing > 0 || mixed || products.length < 2) && (
        <div role="status" className="mt-3 space-y-1 rounded-xl border border-line bg-sunk p-3 text-sm">
          {missing > 0 && <p className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-ask" aria-hidden />Không tìm thấy {missing} sản phẩm; các món còn lại vẫn được hiển thị.</p>}
          {products.length < 2 && <p>Chọn thêm ít nhất 1 sản phẩm nữa để so sánh.</p>}
          {mixed && <p className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-ask" aria-hidden />Các sản phẩm này thuộc loại khác nhau nên có thể ít thông số giống nhau. Bạn vẫn xem và mua bình thường.</p>}
        </div>
      )}

      {products.length >= 2 && (
        <button type="button" role="switch" aria-checked={onlyDiff} onClick={() => setOnlyDiff((v) => !v)} className="mt-3 flex min-h-11 items-center gap-3 text-sm font-medium">
          <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${onlyDiff ? "bg-brand" : "bg-line"}`}>
            <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left] motion-reduce:transition-none ${onlyDiff ? "left-[22px]" : "left-0.5"}`} />
          </span>
          Chỉ hiện điểm khác nhau
        </button>
      )}

      <div role="region" aria-label="Bảng so sánh sản phẩm, vuốt ngang để xem đủ các cột" tabIndex={0} className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <table className="w-full table-fixed border-collapse" style={{ minWidth: products.length > 2 ? 88 + products.length * 140 : undefined }}>
          <caption className="sr-only">So sánh {products.map((p) => p.name).join(", ")}</caption>
          <colgroup>
            <col style={{ width: 88 }} />
            {products.map((p) => <col key={p.sku} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={`${stickyTh} bg-surface`}><span className="sr-only">Tiêu chí</span></th>
              {products.map((p) => (
                <th key={p.sku} scope="col" className={`${cell} font-normal`}>
                  <div className="relative aspect-square overflow-hidden rounded-lg bg-sunk">
                    <ProductImage p={p} sizes="(max-width: 768px) 160px, 420px" discountBadge={false} />
                  </div>
                  <Link href={`/san-pham/${p.sku}`} title={p.name} className="mt-2 line-clamp-3 text-left text-sm font-semibold leading-5 hover:text-brand">{p.name}</Link>
                  <button type="button" onClick={() => remove(p.sku)} aria-label={`Bỏ ${p.name} khỏi so sánh`} className="mt-1 inline-flex min-h-10 items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-danger"><X className="size-4" aria-hidden />Bỏ</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={`${stickyTh} bg-surface`}>Giá</th>
              {products.map((p) => (
                <td key={p.sku} className={cell}>
                  {p.old ? <del className="num block text-[13px] text-ink-3">{formatVnd(p.old)}</del> : null}
                  <b className="num text-base font-extrabold text-brand">{formatVnd(p.price)}</b>
                  <span className="block text-xs text-ink-2">/ {p.unit.toLowerCase()}</span>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row" className={`${stickyTh} bg-surface`}>Hãng</th>
              {products.map((p) => <td key={p.sku} className={cell}>{isMissing(p.brand) ? <span className="text-ink-3">{NO_INFO}</span> : p.brand}</td>)}
            </tr>
            <tr>
              <th scope="row" className={`${stickyTh} bg-surface`}>Bảo hành</th>
              {products.map((p) => <td key={p.sku} className={cell}>{isMissing(p.warranty) ? <span className="text-ink-3">{NO_INFO}</span> : p.warranty}</td>)}
            </tr>
            {shownRows.map((row) => (
              <tr key={row.label} className={row.differs ? "bg-brand-tint" : undefined}>
                <th scope="row" className={`${stickyTh} ${row.differs ? "bg-brand-tint" : "bg-surface"}`}>{row.label}{row.differs && <span className="sr-only"> (khác nhau)</span>}</th>
                {row.cells.map((values, i) => (
                  <td key={products[i].sku} className={cell}>
                    {values ? values.map((v) => <span key={v} className="block">{v}</span>) : <span className="text-ink-3">{NO_INFO}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {products.length > 2 && <p className="mt-2 text-xs text-ink-2">Vuốt ngang để xem đủ {products.length} sản phẩm.</p>}
      {onlyDiff && rows.length > 0 && shownRows.length === 0 && <p role="status" className="mt-3 text-sm text-ink-2">Các thông số còn lại giống nhau hoặc chưa đủ thông tin để so sánh. Giá, hãng và bảo hành vẫn hiện ở trên.</p>}
      {rows.length === 0 && <p className="mt-3 text-sm text-ink-2">Các sản phẩm này chưa có thông số chi tiết để so sánh thêm.</p>}
    </>
  );
}
