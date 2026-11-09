"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/admin/ui";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { stockClass } from "@/components/admin/ProductCell";
import { createProduct, saveProduct } from "@/app/admin/(shell)/san-pham/actions";
import { ProductImageManager, uploadProductImages, type StagedProductImage } from "@/components/admin/ProductImageManager";
import type { Option, ProductDetail, ProductImage } from "@/lib/admin/products";

const input = "h-10 w-full rounded border border-line bg-white px-3 text-sm outline-none focus:border-brand disabled:bg-ground disabled:text-ink-2";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-1.5 block font-medium">{label}</span>{children}</label>;
}
const toNum = (s: string) => (s.trim() === "" ? null : Number(s.replace(/[.\s,]/g, "")));

export function ProductForm({ product: p, options, canPrice, canCost, canAdjustStock = false }: { product: ProductDetail | null; options: { categories: Option[]; brands: Option[] }; canPrice: boolean; canCost: boolean; canAdjustStock?: boolean }) {
  const router = useRouter();
  const [productId, setProductId] = useState<number | undefined>(p?.id);
  const [sku, setSku] = useState(p?.sku ?? "");
  const [images, setImages] = useState<ProductImage[]>(p?.images ?? []);
  const [staged, setStaged] = useState<StagedProductImage[]>([]);
  const [f, setF] = useState({
    name: p?.name ?? "", unit: p?.unit ?? "Cái", categoryId: p?.categoryId ? String(p.categoryId) : "", brandId: p?.brandId ? String(p.brandId) : "", spec: p?.spec ?? "",
    warranty: p?.warranty ?? "", origin: p?.origin ?? "", madeIn: p?.madeIn ?? "", description: p?.description ?? "", usageGuide: p?.usageGuide ?? "", needTags: p?.needTags ?? "", visible: p?.visible ?? false, min: String(p?.min ?? 0), location: p?.location ?? "Kho 1",
    price: p ? String(p.price) : "", salePrice: p?.salePrice != null ? String(p.salePrice) : "", saleFrom: p?.saleFrom ?? "", saleTo: p?.saleTo ?? "", cost: p?.cost != null ? String(p.cost) : "",
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Chỉ khi tạo mới mới bắt buộc giá + tồn tối thiểu; sửa SP cũ thì gửi phần mình có quyền.
    if (!productId && !canPrice) return setMsg({ ok: false, text: "Bạn cần quyền sửa giá để thêm sản phẩm." });
    if (!productId && !canAdjustStock) return setMsg({ ok: false, text: "Bạn cần quyền điều chỉnh tồn kho để lưu vị trí và tồn tối thiểu." });
    const min = toNum(f.min);
    if (min === null || Number.isNaN(min)) return setMsg({ ok: false, text: "Tồn tối thiểu phải là số." });
    const price = canPrice ? toNum(f.price) : undefined;
    const sale = canPrice ? toNum(f.salePrice) : undefined;
    const cost = canPrice && canCost ? toNum(f.cost) : undefined;
    if ([price, sale, cost].some((n) => typeof n === "number" && Number.isNaN(n))) return setMsg({ ok: false, text: "Giá phải là số." });
    if (price === null) return setMsg({ ok: false, text: "Cần nhập giá bán." });
    if (!productId && !sku.trim()) return setMsg({ ok: false, text: "Cần nhập SKU." });
    setMsg(null);
    start(async () => {
      const values = {
        name: f.name, unit: f.unit, categoryId: f.categoryId ? Number(f.categoryId) : null, brandId: f.brandId ? Number(f.brandId) : null,
        spec: f.spec, warranty: f.warranty, origin: f.origin, madeIn: f.madeIn, description: f.description, usageGuide: f.usageGuide, needTags: f.needTags, visible: f.visible, min, location: f.location,
        price: price as number, salePrice: sale as number | null, saleFrom: f.saleFrom, saleTo: f.saleTo, cost: canCost ? cost as number | null : undefined,
      };
      let r: { ok: boolean; id?: number; error?: string };
      try {
        r = productId
          ? await saveProduct({ ...values, id: productId })
          : await createProduct({ ...values, sku });
      } catch {
        // Response có thể thất lạc dù máy chủ đã tạo xong; SKU trùng sẽ chặn tạo bản thứ hai khi bấm lại.
        setMsg({ ok: false, text: productId ? "Mất kết nối khi lưu. Kiểm tra mạng rồi bấm Lưu lại." : "Mất kết nối khi tạo sản phẩm. Kiểm tra danh sách sản phẩm trước khi thử lại — nếu báo trùng SKU tức là đã tạo xong." });
        return;
      }
      const savedId = productId ?? r.id;
      if (savedId) setProductId(savedId);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error ?? "Không lưu được." });
        return;
      }
      let uploadErrors: string[] = [];
      if (savedId && staged.length) {
        const result = await uploadProductImages(savedId, staged, (image) => setImages((current) => [
          ...current.filter((item) => !item.is_illustration).map((item) => item.sort >= image.sort ? { ...item, sort: item.sort + 1 } : item), image,
        ].sort((a, b) => a.sort - b.sort)));
        uploadErrors = result.errors;
        const failedFiles = new Set(result.failed.map((item) => item.file));
        staged.filter((item) => !failedFiles.has(item.file)).forEach((item) => URL.revokeObjectURL(item.preview));
        setStaged(result.failed);
      }
      if (uploadErrors.length) setMsg({ ok: false, text: `Đã lưu thông tin. Một số ảnh chưa tải được: ${uploadErrors.join(" ")}` });
      else {
        setMsg({ ok: true, text: productId ? "Đã lưu thay đổi." : "Đã tạo sản phẩm." });
        if (!productId && savedId) router.replace(`/admin/san-pham/${savedId}`);
      }
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="grid gap-4 pb-24 lg:grid-cols-[1.8fr_1fr]">
        <div className="space-y-4">
          <ProductImageManager productId={productId} images={images} onImagesChange={setImages} staged={staged} onStagedChange={setStaged} disabled={pending} />
          <Card pad title="1. Thông tin cơ bản">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên sản phẩm"><input className={input} value={f.name} onChange={set("name")} required minLength={2} maxLength={200} /></Field>
              <Field label={productId ? "SKU (không đổi)" : "SKU (nhập thủ công)"}><input className={input} value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} disabled={!!productId} required maxLength={41} pattern="[A-Z0-9][A-Z0-9-]{1,40}" /></Field>
              <Field label="Đơn vị tính"><input className={input} value={f.unit} onChange={set("unit")} maxLength={30} /></Field>
              <Field label="Danh mục">
                <select className={input} value={f.categoryId} onChange={set("categoryId")}><option value="">—</option>{options.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </Field>
              {/* Mẫu F1: Phân loại chỉ xem; đổi bằng Nhập Excel (cột Phân loại, nhiều loại ngăn bằng dấu ;). */}
              {p && <div className="sm:col-span-2">
                <p className="text-sm font-medium">Phân loại</p>
                {p.classifications.length
                  ? <ul className="mt-1.5 flex flex-wrap gap-1.5">{p.classifications.map((c) => <li key={c} className="rounded-full bg-brand-tint px-2.5 py-0.5 text-xs font-medium text-brand">{c}</li>)}</ul>
                  : <p className="mt-1 text-sm text-ink-2">Chưa có Phân loại.</p>}
                <p className="mt-1.5 text-xs text-ink-2">Đổi Phân loại bằng Nhập Excel (cột Phân loại, nhiều loại ngăn bằng dấu ;).</p>
              </div>}
              <Field label="Thương hiệu">
                <select className={input} value={f.brandId} onChange={set("brandId")}><option value="">—</option>{options.brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              </Field>
              <Field label="Nhãn nhu cầu (cách nhau bằng dấu phẩy)"><input className={input} value={f.needTags} onChange={set("needTags")} /></Field>
            </div>
          </Card>
          <Card pad title="2. Giá">
            {canPrice ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Giá bán (₫)"><input className={input} inputMode="numeric" value={f.price} onChange={set("price")} /></Field>
                {canCost && <Field label="Giá nhập (₫) · giá vốn tính lãi = giá nhập + 10%"><input className={input} inputMode="numeric" value={f.cost} onChange={set("cost")} /></Field>}
                <Field label="Giá khuyến mãi (₫, để trống nếu không giảm)"><input className={input} inputMode="numeric" value={f.salePrice} onChange={set("salePrice")} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Từ ngày"><input type="date" className={input} value={f.saleFrom} onChange={set("saleFrom")} /></Field>
                  <Field label="Đến ngày"><input type="date" className={input} value={f.saleTo} onChange={set("saleTo")} /></Field>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-2">Bạn không có quyền sửa giá bán.{p ? <> Giá hiện tại: <b className="num text-ink">{p.price.toLocaleString("vi-VN")}₫</b></> : " Cần được cấp quyền sửa giá để thêm sản phẩm."}</p>
            )}
          </Card>
          <Card pad title="3. Mô tả & bảo hành">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Thông số (mỗi dòng một thông số)">
                  <textarea className={`${input} h-36 py-2 leading-6`} value={f.spec} onChange={set("spec")} maxLength={3000} placeholder={"Công suất: 47W\nSải cánh: 40cm\nĐiều khiển: nút nhấn"} />
                </Field>
                <p className="mt-1 text-xs text-ink-2">Dòng có dấu “:” hiện thành bảng trên web. Dán từ trang khác cũng được.</p>
              </div>
              <div className="sm:col-span-2 text-sm">
                <span className="mb-1.5 block font-medium">Mô tả</span>
                <RichTextEditor label="Mô tả" value={f.description} onChange={(html) => setF((s) => ({ ...s, description: html }))} />
              </div>
              <div className="sm:col-span-2">
                <Field label="Hướng dẫn sử dụng (mỗi dòng một bước)">
                  <textarea className={`${input} h-36 py-2 leading-6`} value={f.usageGuide} onChange={set("usageGuide")} maxLength={3000} placeholder={"Lắp quạt đúng chiều, siết chặt ốc giữ cánh.\nCắm điện 220V, chọn cấp gió.\nRút phích điện trước khi vệ sinh."} />
                </Field>
                <p className="mt-1 text-xs text-ink-2">Hiện ở trang sản phẩm, tự đánh số từng dòng. Không có nội dung thì mục này ẩn.</p>
              </div>
              <Field label="Bảo hành"><input className={input} value={f.warranty} onChange={set("warranty")} maxLength={100} /></Field>
              <Field label="Xuất xứ (nước của hãng)"><input className={input} value={f.origin} onChange={set("origin")} maxLength={100} placeholder="Ví dụ: Nhật Bản" /></Field>
              <Field label="Sản xuất tại"><input className={input} value={f.madeIn} onChange={set("madeIn")} maxLength={100} placeholder="Ví dụ: Việt Nam" /></Field>
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card pad title="Trạng thái hiển thị">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--color-brand)]" checked={f.visible} onChange={(e) => setF((s) => ({ ...s, visible: e.target.checked }))} />Hiển thị trên web
            </label>
          </Card>
          <Card pad title="Tồn kho">
            <p className={`num text-2xl font-bold ${stockClass(p?.stock ?? 0, Number(f.min) || 0)}`}>{p?.stock ?? 0} {f.unit.toLowerCase()}</p>
            <div className="mt-3"><Field label="Vị trí"><input className={input} value={f.location} onChange={set("location")} disabled={!canAdjustStock} maxLength={40} placeholder="Kho 1" /></Field></div>
            <div className="mt-3"><Field label="Tồn tối thiểu (báo sắp hết)"><input className={input} inputMode="numeric" value={f.min} onChange={set("min")} disabled={!canAdjustStock} /></Field></div>
            <Link href="/admin/ton-kho" className="mt-3 block text-sm font-medium text-brand">Điều chỉnh tồn kho ở mục Tồn kho</Link>
          </Card>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-line bg-white p-3 md:bottom-0 md:left-[72px] md:px-6 xl:left-60">
        {/* Thông báo dài (vd. tên tệp ảnh Android là một dãy số liền) xuống dòng riêng trên điện thoại, không đẩy nút Lưu bị bóp méo. */}
        <span className={`mr-auto min-w-0 text-xs [overflow-wrap:anywhere] sm:flex-1 sm:basis-auto sm:text-sm ${msg ? "basis-full" : ""}`} role="status" aria-live="polite">
          {msg ? <span className={msg.ok ? "text-brand" : "text-danger"}>{msg.text}</span> : <span className="hidden text-ink-2 sm:inline">{p ? `Sửa lần cuối: ${p.updatedAt}` : "Sản phẩm mới chưa hiển thị trên web."}</span>}
        </span>
        <Link href="/admin/san-pham" className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded border border-line bg-white px-3 text-sm font-medium hover:bg-ground">Quay lại</Link>
        <button disabled={pending || (!productId && (!canPrice || !canAdjustStock))} className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60">{pending ? "Đang lưu…" : productId ? "Lưu thay đổi" : "Thêm sản phẩm"}</button>
      </div>
    </form>
  );
}
