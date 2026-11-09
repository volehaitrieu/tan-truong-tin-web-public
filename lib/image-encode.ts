// Nén ảnh sản phẩm ngay trên thiết bị trước khi tải lên kho: cạnh dài tối đa 1600px (đủ nét cho khung chi tiết),
// ưu tiên WebP (nhẹ hơn JPEG ~25-35%). Safari cũ không mã hóa được WebP thì toBlob trả kiểu khác → dùng JPEG.
export const MAX_IMAGE_EDGE = 1600;
const QUALITY = 0.82;

export async function encodeCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  const webp = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", QUALITY));
  if (webp?.type === "image/webp") return webp;
  const jpeg = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!jpeg) throw new Error("không thể chuyển đổi ảnh.");
  return jpeg;
}

// Vẽ nguồn lên canvas nền trắng: JPEG không có nền trong suốt, ảnh PNG trong suốt sẽ thành nền trắng thay vì đen.
export function drawOnWhite(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("không thể xử lý ảnh trên thiết bị này.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  draw(ctx);
  return canvas;
}

export function renamed(file: File, blob: Blob) {
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type, lastModified: Date.now() });
}
