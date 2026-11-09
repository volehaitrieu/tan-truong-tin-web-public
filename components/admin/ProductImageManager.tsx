"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { registerProductImage, removeProductImage, reorderProductImages } from "@/app/admin/(shell)/san-pham/actions";
import type { ProductImage } from "@/lib/admin/products";
import { ImageCropDialog } from "@/components/admin/ImageCropDialog";
import { MAX_IMAGE_EDGE, drawOnWhite, encodeCanvas, renamed } from "@/lib/image-encode";

// encoded: ảnh đã được khung chỉnh cắt và nén, không cần nén lại khi tải lên.
export type StagedProductImage = { file: File; preview: string; encoded?: boolean };
const bucket = "product-images";
const maxImages = 10;
const maxFileSize = 6 * 1024 * 1024;
const maxOriginalFileSize = 25 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

// crypto.randomUUID chỉ có trong secure context (HTTPS/localhost); điện thoại mở qua http://IP-LAN thì không có.
// getRandomValues dùng được ở mọi origin và vẫn là nguồn ngẫu nhiên an toàn.
// Phải ra đúng dạng UUID 8-4-4-4-12 vì máy chủ (registerProductImage) chỉ nhận tên tệp dạng đó.
function randomId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // UUID phiên bản 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Mọi ảnh đều thu nhỏ còn cạnh dài 1600px và nén WebP/JPEG (ảnh điện thoại 3-5 MB → vài trăm KB).
// Ảnh vừa cắt ở khung chỉnh đã được nén cùng cách nên giữ nguyên, tránh nén hai lần làm mờ ảnh.
async function prepareForUpload(file: File, alreadyEncoded: boolean): Promise<File> {
  if (alreadyEncoded) return file;
  const isHeic = file.type === "image/heic" || file.type === "image/heif";
  if (file.size > maxOriginalFileSize) throw new Error("ảnh gốc vượt quá 25 MB.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(isHeic ? "trình duyệt chưa đọc được ảnh HEIC; hãy chọn ảnh JPEG/PNG/WebP hoặc đổi iPhone sang định dạng Tương thích nhất." : "không thể xử lý ảnh trên thiết bị này.");
  }
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  let canvas: HTMLCanvasElement;
  try { canvas = drawOnWhite(width, height, (ctx) => ctx.drawImage(bitmap, 0, 0, width, height)); }
  finally { bitmap.close(); }
  // Luôn dùng bản vẽ lại: vừa nhẹ, vừa xóa EXIF (ảnh điện thoại thường kèm toạ độ GPS nơi chụp).
  const blob = await encodeCanvas(canvas);
  if (blob.size > maxFileSize) throw new Error("ảnh sau khi tối ưu vẫn vượt quá 6 MB.");
  return renamed(file, blob);
}

export async function uploadProductImages(productId: number, staged: StagedProductImage[], onUploaded: (image: ProductImage) => void) {
  const supabase = createClient();
  const errors: string[] = [];
  const failed: StagedProductImage[] = [];
  for (const item of staged) {
    const { file } = item;
    if (!acceptedTypes.has(file.type)) {
      errors.push(`${file.name}: định dạng không hỗ trợ.`);
      failed.push(staged.find((item) => item.file === file)!);
      continue;
    }
    let prepared: File;
    try { prepared = await prepareForUpload(file, !!item.encoded); }
    catch (error) {
      errors.push(`${file.name}: ${error instanceof Error ? error.message : "không thể xử lý ảnh."}`);
      failed.push(item);
      continue;
    }
    const ext = prepared.type === "image/jpeg" ? "jpg" : prepared.type === "image/png" ? "png" : prepared.type.split("/")[1]?.toLowerCase();
    if (!ext || prepared.size > maxFileSize) {
      errors.push(`${file.name}: định dạng không hỗ trợ hoặc ảnh vượt quá 6 MB.`);
      failed.push(item);
      continue;
    }
    const path = `${productId}/${randomId()}.${ext}`;
    // Mất mạng thì upload/Server Action ném exception thay vì trả error — bắt lại để ảnh ở lại hàng chờ, bấm Lưu lần nữa sẽ thử lại.
    try {
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, prepared, { contentType: prepared.type, upsert: false });
      if (uploadError) throw uploadError;
      const result = await registerProductImage(productId, path);
      if (!result.ok || !result.image) {
        // Máy chủ trả lời rõ là không đăng ký → dọn tệp. Nếu chỉ mất phản hồi (exception) thì giữ tệp, vì metadata có thể đã ghi.
        await supabase.storage.from(bucket).remove([path]).catch(() => undefined);
        throw new Error(result.error ?? "không thể lưu ảnh.");
      }
      onUploaded(result.image);
    } catch (error) {
      // Chỉ báo "kiểm tra mạng" khi thật sự mất kết nối; lỗi quyền hay lỗi máy chủ phải nói đúng, nếu không sẽ đi sửa nhầm chỗ.
      const raw = error instanceof Error ? error.message : "";
      const text = /[À-ỹ]/.test(raw) ? raw
        : /row-level security|unauthorized|access ?denied|403/i.test(raw) ? "máy chủ từ chối quyền tải ảnh. Báo lại cho người quản trị kỹ thuật."
        : error instanceof TypeError || /failed to fetch|network/i.test(raw) ? "mất kết nối khi tải ảnh, kiểm tra mạng rồi bấm Lưu để thử lại."
        : `tải ảnh lên thất bại (${raw || "lỗi không rõ"}).`;
      errors.push(`${file.name}: ${text}`);
      failed.push(item);
    }
  }
  return { errors, failed };
}

export function ProductImageManager({ productId, images, onImagesChange, staged, onStagedChange, disabled = false }: {
  productId?: number; images: ProductImage[]; onImagesChange: (images: ProductImage[]) => void;
  staged: StagedProductImage[]; onStagedChange: (files: StagedProductImage[]) => void; disabled?: boolean;
}) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  // Xác nhận ngay trên nút: trình duyệt nhúng (khung xem của ứng dụng) chặn window.confirm, trả về "Hủy" ngay lập tức.
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  // Ảnh chờ chỉnh khung, lần lượt từng ảnh (khóa = URL xem trước).
  const [cropQueue, setCropQueue] = useState<string[]>([]);
  const cropping = staged.find((item) => item.preview === cropQueue[0]);
  const stagedRef = useRef(staged);
  useEffect(() => { stagedRef.current = staged; }, [staged]);
  useEffect(() => () => stagedRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    const realImageCount = images.filter((image) => !image.is_illustration).length;
    const capacity = Math.max(0, maxImages - realImageCount - staged.length);
    const valid: StagedProductImage[] = [];
    const issues: string[] = [];
    for (const file of picked) {
      if (!acceptedTypes.has(file.type)) issues.push(`${file.name}: chỉ nhận JPG, PNG, WebP hoặc HEIC.`);
      else if (file.size > maxOriginalFileSize) issues.push(`${file.name}: ảnh gốc tối đa 25 MB.`);
      else if (valid.length < capacity) valid.push({ file, preview: URL.createObjectURL(file) });
      else issues.push(`Mỗi sản phẩm tối đa ${maxImages} ảnh.`);
    }
    onStagedChange([...staged, ...valid]);
    setCropQueue(valid.map((item) => item.preview));
    setMessage(issues.join(" "));
  }

  function finishCrop(next: StagedProductImage[]) {
    onStagedChange(next);
    setCropQueue((queue) => queue.slice(1));
  }

  function applyCrop(file: File) {
    if (!cropping) return;
    URL.revokeObjectURL(cropping.preview);
    finishCrop(staged.map((item) => (item === cropping ? { file, preview: URL.createObjectURL(file), encoded: true } : item)));
  }

  function discardCropping() {
    if (!cropping) return;
    URL.revokeObjectURL(cropping.preview);
    finishCrop(staged.filter((item) => item !== cropping));
  }

  async function remove(image: ProductImage) {
    if (!productId || pending || disabled) return;
    setConfirmingId(null);
    setPending(true);
    try {
      const result = await removeProductImage(productId, image.id);
      if (result.ok) {
        onImagesChange(images.filter((item) => item.id !== image.id).map((item, sort) => ({ ...item, sort })));
        if (result.warning) setMessage(result.warning);
      }
      else setMessage(result.error ?? "Không xóa được ảnh.");
    } catch {
      setMessage("Không xóa được ảnh. Kiểm tra mạng rồi thử lại.");
    } finally {
      setPending(false);
    }
  }

  async function move(index: number, delta: number) {
    if (!productId || pending || disabled) return;
    const next = [...images];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const ordered = next.map((item, sort) => ({ ...item, sort }));
    onImagesChange(ordered);
    setPending(true);
    try {
      const result = await reorderProductImages(productId, ordered.map((item) => item.id));
      if (!result.ok) {
        onImagesChange(images);
        setMessage(result.error ?? "Không đổi được thứ tự ảnh.");
      }
    } catch {
      onImagesChange(images);
      setMessage("Không đổi được thứ tự ảnh. Kiểm tra mạng rồi thử lại.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="rounded-md border border-line bg-white p-4" aria-labelledby="product-images-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="product-images-title" className="text-base font-semibold">Ảnh sản phẩm</h2><p className="mt-1 text-xs text-ink-2">Ảnh đầu tiên làm ảnh bìa · tối đa 10 ảnh. Ảnh lớn được tối ưu còn tối đa 6 MB trước khi tải lên.</p></div>
        <div className="flex gap-2">
          <button type="button" disabled={disabled} onClick={() => galleryRef.current?.click()} className="rounded border border-line px-3 py-2 text-sm font-medium hover:bg-ground disabled:opacity-50">Chọn ảnh</button>
          <button type="button" disabled={disabled} onClick={() => cameraRef.current?.click()} className="rounded border border-line px-3 py-2 text-sm font-medium hover:bg-ground disabled:opacity-50">Chụp ảnh</button>
        </div>
      </div>
      <input ref={galleryRef} type="file" accept="image/*" multiple disabled={disabled} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" disabled={disabled} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.currentTarget.value = ""; }} />
      {!productId && <p className="mt-3 text-xs text-ink-2">Ảnh sẽ được tải lên sau khi lưu sản phẩm mới.</p>}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((image, index) => (
          <figure key={image.id} className="overflow-hidden rounded border border-line bg-ground">
            {/* Supabase Storage returns a remote URL outside Next image optimization. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={image.url} alt={`Ảnh sản phẩm ${index + 1}`} className="aspect-square w-full object-cover" />
            <figcaption className="p-2 text-xs">
              <div className="font-medium">{index === 0 ? "Ảnh bìa" : `Ảnh ${index + 1}`}{image.is_illustration ? " · minh họa" : ""}</div>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={index === 0 || pending || disabled} onClick={() => void move(index, -1)} className="rounded border border-line px-2 py-1 disabled:opacity-40" aria-label="Đưa ảnh lên trước">←</button>
                <button type="button" disabled={index === images.length - 1 || pending || disabled} onClick={() => void move(index, 1)} className="rounded border border-line px-2 py-1 disabled:opacity-40" aria-label="Đưa ảnh xuống sau">→</button>
                {confirmingId !== image.id && <button type="button" disabled={!productId || pending || disabled} onClick={() => setConfirmingId(image.id)} className="ml-auto rounded border border-line px-2 py-1 text-danger disabled:opacity-40">Xóa</button>}
              </div>
              {confirmingId === image.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Xác nhận xóa ảnh">
                  <span className="text-danger">Xóa ảnh này?</span>
                  <button type="button" disabled={pending || disabled} onClick={() => void remove(image)} className="rounded bg-danger px-2 py-1 font-semibold text-white disabled:opacity-40">Xóa ảnh</button>
                  <button type="button" disabled={pending} onClick={() => setConfirmingId(null)} className="rounded border border-line px-2 py-1">Hủy</button>
                </div>
              )}
            </figcaption>
          </figure>
        ))}
        {staged.map((item, index) => (
          <figure key={`${item.file.name}-${item.file.lastModified}-${index}`} className="overflow-hidden rounded border border-dashed border-brand bg-ground">
            {/* eslint-disable-next-line @next/next/no-img-element */}<img src={item.preview} alt={`Ảnh mới ${index + 1}`} className="aspect-square w-full object-cover" />
            <figcaption className="p-2 text-xs"><div className="truncate">Ảnh mới · {item.file.name}</div><div className="mt-2 flex flex-wrap gap-2"><button type="button" disabled={disabled} className="rounded border border-line px-2 py-1 disabled:opacity-40" onClick={() => setCropQueue([item.preview])}>Chỉnh khung</button><button type="button" disabled={disabled} className="rounded border border-line px-2 py-1 text-danger disabled:opacity-40" onClick={() => { URL.revokeObjectURL(item.preview); onStagedChange(staged.filter((_, i) => i !== index)); }}>Bỏ ảnh</button></div></figcaption>
          </figure>
        ))}
      </div>
      {message && <p role="status" className="mt-3 text-sm text-danger">{message}</p>}
      {cropping && <ImageCropDialog key={cropping.preview} file={cropping.file} preview={cropping.preview} onApply={applyCrop} onKeep={() => finishCrop(staged)} onDiscard={discardCropping} />}
    </section>
  );
}
