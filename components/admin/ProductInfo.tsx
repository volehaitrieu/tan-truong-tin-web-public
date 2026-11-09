import type { ProductPreview } from "@/lib/admin/preview";
import { formatVnd } from "@/lib/shop";

// Phần chữ của thông tin SP (khung xem nhanh + file báo giá). Ô nào trống thì không hiện.
export function ProductPrice({ p }: { p: ProductPreview }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <b className="num text-2xl font-extrabold text-danger">{formatVnd(p.salePrice ?? p.price)}</b>
      <span className="text-sm text-ink-2">/ {p.unit.toLowerCase()}</span>
      {p.salePrice != null && <del className="num text-sm text-ink-2">{formatVnd(p.price)}</del>}
    </p>
  );
}

export function ProductFacts({ p }: { p: ProductPreview }) {
  const facts = ([["Thương hiệu", p.brand], ["Bảo hành", p.warranty], ["Xuất xứ", p.origin], ["Sản xuất tại", p.madeIn]] as const).filter(([, v]) => v);
  if (!facts.length) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-md bg-ground p-3 text-sm">
      {facts.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-ink-2">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ProductSpecs({ p }: { p: ProductPreview }) {
  if (!p.specs.length && !p.specNotes.length) return null;
  return (
    <section className="text-sm">
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-2">Thông số</h3>
      {p.specs.length > 0 && (
        <dl className="divide-y divide-line rounded-md border border-line">
          {p.specs.map(([k, v], i) => (
            <div key={`${k}-${i}`} className="grid grid-cols-[42%_1fr] gap-3 px-3 py-1.5">
              <dt className="text-ink-2">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {p.specNotes.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{p.specNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </section>
  );
}

export function ProductDescription({ p }: { p: ProductPreview }) {
  if (!p.description) return null;
  return (
    <section className="text-sm">
      <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-2">Mô tả</h3>
      {/* Đã làm sạch ở server (lib/rich-text) */}
      <div className="rich-text leading-6" dangerouslySetInnerHTML={{ __html: p.description }} />
    </section>
  );
}

export function ProductInfo({ p }: { p: ProductPreview }) {
  return (
    <div className="space-y-4">
      <ProductFacts p={p} />
      <ProductSpecs p={p} />
      <ProductDescription p={p} />
    </div>
  );
}
