import Image from "next/image";
import type { ReactNode } from "react";
import { Package } from "lucide-react";

// Ảnh đầu tiên của SP (theo cột sort) — dùng với select "images:product_images(url, sort)"
export const firstImage = (imgs: { url: string; sort: number }[] | null | undefined) =>
  imgs?.length ? [...imgs].sort((a, b) => a.sort - b.sort)[0].url : null;

// Tồn dưới mức tối thiểu → số tồn đỏ đậm
export const stockClass = (stock: number, min: number) => (stock < min ? "font-bold text-danger" : "");

// Ảnh nhỏ vuông; chưa có ảnh thì hiện biểu tượng hộp
export function ProductThumb({ src, size = 48 }: { src?: string | null; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center overflow-hidden rounded border border-line bg-sunk" style={{ width: size, height: size }}>
      {src ? <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" /> : <Package className="size-1/2 text-brand" aria-hidden />}
    </span>
  );
}

// Ô sản phẩm dùng chung ở Admin: ảnh bên trái, tên ở trên, "Mã: …" ở dưới
export function ProductCell({ name, sku, image, size, extra, className = "" }: {
  name: string; sku: string; image?: string | null; size?: number; extra?: ReactNode; className?: string;
}) {
  return (
    <span className={`flex min-w-0 items-center gap-3 ${className}`}>
      <ProductThumb src={image} size={size} />
      <span className="min-w-0 flex-1">
        <b className="block font-semibold leading-snug">{name}</b>
        <small className="num block break-all text-xs text-ink-2">Mã: {sku}{extra}</small>
      </span>
    </span>
  );
}
