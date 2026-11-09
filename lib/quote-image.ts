// Ảnh báo giá 1 SP (PNG, rộng 1080px, cao theo nội dung) vẽ bằng canvas ngay trên trình duyệt.
// Mỗi SP một ảnh PNG, lưu thẳng vào thư mục Tải xuống.
import type { ProductPreview } from "@/lib/admin/preview";
import { htmlToText } from "@/lib/rich-text";
import { downloadBlob } from "@/lib/excel/write-xlsx";
import { SHOP } from "@/lib/shop";

const W = 1080, PAD = 56;
const C = { brand: "#0D6B45", deep: "#08482F", ink: "#14231B", ink2: "#4B5A51", line: "#DCE5DF", ground: "#F3F7F4", red: "#B3261E" };
const font = (w: number, s: number) => `${w} ${s}px 'Be Vietnam Pro', system-ui, sans-serif`;
const vnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "₫";

// Tách chữ thành các dòng vừa bề ngang
function lines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    let line = "";
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${w}` : w;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
    }
    out.push(line);
  }
  return out;
}

const loadImage = (src: string) => new Promise<HTMLImageElement | null>((ok) => {
  const img = new Image();
  // Ảnh từ kho Supabase là tên miền khác: thiếu crossOrigin thì canvas bị "bẩn" và toBlob ném lỗi bảo mật.
  // Supabase trả Access-Control-Allow-Origin: *, ảnh nội bộ "/..." cũng không bị ảnh hưởng.
  img.crossOrigin = "anonymous";
  img.onload = () => ok(img);
  img.onerror = () => ok(null);
  img.src = src;
});

export async function drawQuote(p: ProductPreview, date: string): Promise<Blob> {
  await document.fonts?.ready;
  const c = document.createElement("canvas");
  c.width = W; c.height = 6000;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, c.height);
  ctx.textBaseline = "alphabetic";

  // Đầu trang: tên shop, liên hệ, ngày
  ctx.fillStyle = C.brand; ctx.fillRect(0, 0, W, 132);
  ctx.fillStyle = "#fff"; ctx.font = font(800, 40); ctx.fillText(SHOP.name.toUpperCase(), PAD, 66);
  ctx.font = font(400, 22); ctx.fillText(SHOP.tagline, PAD, 102);
  ctx.textAlign = "right"; ctx.font = font(700, 26); ctx.fillText(`ĐT/Zalo ${SHOP.phone}`, W - PAD, 62);
  ctx.font = font(400, 22); ctx.fillText(`Báo giá ngày ${date}`, W - PAD, 100); ctx.textAlign = "left";

  // Ảnh (trái) + tên, mã, giá, thông tin chính (phải)
  let y = 176;
  const IMG = 420;
  ctx.fillStyle = C.ground; ctx.fillRect(PAD, y, IMG, IMG);
  const img = p.images[0] ? await loadImage(p.images[0]) : null;
  if (img) {
    const s = Math.max(IMG / img.naturalWidth, IMG / img.naturalHeight);
    const sw = IMG / s, sh = IMG / s;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, PAD, y, IMG, IMG);
  }
  const x2 = PAD + IMG + 40, w2 = W - x2 - PAD;
  let ry = y + 40;
  ctx.fillStyle = C.ink; ctx.font = font(800, 40);
  for (const l of lines(ctx, p.name, w2).slice(0, 4)) { ctx.fillText(l, x2, ry); ry += 50; }
  ctx.fillStyle = C.ink2; ctx.font = font(400, 24); ctx.fillText(`Mã: ${p.sku}`, x2, ry + 4); ry += 64;
  ctx.fillStyle = C.red; ctx.font = font(800, 60); ctx.fillText(vnd(p.salePrice ?? p.price), x2, ry + 10);
  const pw = ctx.measureText(vnd(p.salePrice ?? p.price)).width;
  ctx.fillStyle = C.ink2; ctx.font = font(400, 26); ctx.fillText(`/ ${p.unit.toLowerCase()}`, x2 + pw + 12, ry + 8);
  ry += 52;
  if (p.salePrice != null) {
    const t = vnd(p.price); ctx.fillText(t, x2, ry); ctx.fillRect(x2, ry - 9, ctx.measureText(t).width, 2); ry += 40;
  }
  const facts = ([["Thương hiệu", p.brand], ["Bảo hành", p.warranty], ["Xuất xứ", p.origin], ["Sản xuất tại", p.madeIn]] as const).filter(([, v]) => v);
  ry += 10;
  for (const [k, v] of facts) {
    ctx.fillStyle = C.ink2; ctx.font = font(400, 22); ctx.fillText(k, x2, ry);
    ctx.fillStyle = C.ink; ctx.font = font(600, 24);
    const ls = lines(ctx, v, w2 - 180).slice(0, 2);
    ls.forEach((l, i) => ctx.fillText(l, x2 + 180, ry + i * 30));
    ry += 22 + ls.length * 30;
  }
  y = Math.max(y + IMG, ry) + 44;

  // Thông số: bảng 2 cột
  if (p.specs.length || p.specNotes.length) {
    ctx.fillStyle = C.brand; ctx.font = font(800, 28); ctx.fillText("THÔNG SỐ", PAD, y); y += 20;
    const colW = (W - PAD * 2) / 2;
    p.specs.forEach(([k, v], i) => {
      const col = i % 2, rowY = y + Math.floor(i / 2) * 56;
      const x = PAD + col * colW;
      ctx.fillStyle = Math.floor(i / 2) % 2 ? "#fff" : C.ground; ctx.fillRect(x, rowY, colW - (col ? 0 : 8), 56);
      ctx.fillStyle = C.ink2; ctx.font = font(400, 22); ctx.fillText(lines(ctx, k, 190)[0], x + 16, rowY + 36);
      ctx.fillStyle = C.ink; ctx.font = font(600, 22); ctx.fillText(lines(ctx, v, colW - 236)[0], x + 214, rowY + 36);
    });
    y += Math.ceil(p.specs.length / 2) * 56 + 16;
    ctx.fillStyle = C.ink; ctx.font = font(400, 24);
    for (const n of p.specNotes) for (const l of lines(ctx, `• ${n}`, W - PAD * 2)) { y += 34; ctx.fillText(l, PAD, y); }
    y += 56;
  }

  // Mô tả: tiêu đề (§) in đậm, gạch đầu dòng (•) thụt vào
  const desc = htmlToText(p.description.replace(/<li>/gi, "<li>• ").replace(/<h[34]>/gi, (m) => m + "§"));
  if (desc) {
    ctx.fillStyle = C.brand; ctx.font = font(800, 28); ctx.fillText("MÔ TẢ", PAD, y + 8); y += 20;
    ctx.fillStyle = C.ink;
    for (const para of desc.split("\n")) {
      const head = para.startsWith("§"), bullet = para.startsWith("•");
      if (head) y += 12;
      ctx.font = head ? font(700, 27) : font(400, 25);
      lines(ctx, head ? para.slice(1) : para, W - PAD * 2 - (bullet ? 24 : 0)).forEach((l, i) => {
        y += 36;
        ctx.fillText(l, PAD + (bullet && i > 0 ? 24 : 0), y);
      });
      y += 8;
    }
    y += 30;
  }

  // Chân trang
  y += 10;
  ctx.fillStyle = C.deep; ctx.fillRect(0, y, W, 96);
  ctx.fillStyle = "#fff"; ctx.font = font(500, 22);
  ctx.fillText(SHOP.address, PAD, y + 40);
  ctx.fillText(`Giờ mở cửa ${SHOP.hours} · Giá có thể thay đổi theo thời điểm`, PAD, y + 74);
  y += 96;

  const out = document.createElement("canvas");
  out.width = W; out.height = Math.ceil(y);
  out.getContext("2d")!.drawImage(c, 0, 0);
  return await new Promise<Blob>((ok, fail) => out.toBlob((b) => (b ? ok(b) : fail(new Error("Không tạo được ảnh"))), "image/png"));
}

// Tên file an toàn trên Windows/điện thoại (giữ dấu tiếng Việt)
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "san-pham";

const today = () => new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
export const quoteFolderName = () => `Báo giá ngày ${today().replace(/\//g, "-")}`;

function namer() {
  const used = new Map<string, number>();
  return (p: ProductPreview) => {
    const name = safeName(p.name);
    const n = used.get(name) ?? 0;
    used.set(name, n + 1);
    return `${n ? `${name} (${n + 1})` : name}.png`;
  };
}

// Chọn chỗ lưu thư mục (hộp chọn thư mục của Windows). Trả null nếu trình duyệt không hỗ trợ; ném lỗi AbortError nếu bấm Hủy.
type DirHandle = { name: string; getDirectoryHandle(n: string, o: { create: boolean }): Promise<DirHandle>; getFileHandle(n: string, o: { create: boolean }): Promise<{ createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }> }> };
export const canPickFolder = () => typeof window !== "undefined" && "showDirectoryPicker" in window;
export async function pickFolder(): Promise<DirHandle> {
  const picker = (window as unknown as { showDirectoryPicker: (o: object) => Promise<DirHandle> }).showDirectoryPicker;
  return picker({ id: "bao-gia", mode: "readwrite", startIn: "downloads" });
}

// Lưu ảnh của nhiều SP vào thư mục con "Báo giá ngày …" bên trong chỗ đã chọn
export async function saveQuotesToFolder(dir: DirHandle, items: ProductPreview[]): Promise<string> {
  const d = today(), folder = quoteFolderName(), fileName = namer();
  const sub = await dir.getDirectoryHandle(folder, { create: true });
  for (const p of items) {
    const w = await (await sub.getFileHandle(fileName(p), { create: true })).createWritable();
    await w.write(await drawQuote(p, d));
    await w.close();
  }
  return `Đã lưu ${items.length} ảnh vào thư mục “${folder}” trong “${dir.name}”.`;
}

// Tải thẳng vào Tải xuống: mỗi SP một ảnh PNG (dùng cho 1 SP, hoặc khi trình duyệt không chọn được thư mục)
export async function downloadQuoteImages(load: () => Promise<ProductPreview[]>): Promise<string> {
  const d = today(), fileName = namer();
  const items = await load();
  for (const p of items) {
    downloadBlob(await drawQuote(p, d), fileName(p));
    await new Promise((r) => setTimeout(r, 400)); // giãn cách để trình duyệt không chặn tải nhiều file
  }
  return items.length > 1 ? `Đã tải ${items.length} ảnh vào thư mục Tải xuống.` : "";
}
