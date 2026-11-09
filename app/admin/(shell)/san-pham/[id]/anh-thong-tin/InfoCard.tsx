"use client";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/mock/store";

// Vẽ ảnh thông tin SP 1080×1080 (gửi khách qua Zalo) bằng canvas, tải về PNG. Chỉ dùng dữ liệu thật của SP.
const fmt = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "₫";

// Cắt chữ cho vừa bề ngang, thêm "…"
function fit(ctx: CanvasRenderingContext2D, t: string, maxW: number) {
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines: number) {
  const words = text.split(" ");
  let line = "", lines = 0;
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lh);
      line = w;
      if (++lines >= maxLines - 1) break;
    } else line = test;
  }
  ctx.fillText(line, x, y + lines * lh);
  return y + (lines + 1) * lh;
}

export function InfoCard({ p, shop }: { p: Product; shop: { name: string; phone: string; address: string } }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [opt, setOpt] = useState({ price: true, specs: true });

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const img = new Image();
    img.src = p.image;
    const draw = () => {
      ctx.fillStyle = "#F7FAF7"; ctx.fillRect(0, 0, 1080, 1080);
      ctx.fillStyle = "#0D6B45"; ctx.fillRect(0, 0, 1080, 110);
      ctx.fillStyle = "#fff"; ctx.font = "800 44px 'Be Vietnam Pro', sans-serif"; ctx.fillText(shop.name.toUpperCase(), 48, 72);
      ctx.font = "500 28px 'Be Vietnam Pro', sans-serif"; ctx.textAlign = "right"; ctx.fillText(shop.phone, 1032, 70); ctx.textAlign = "left";
      // Ảnh
      ctx.fillStyle = "#EEF3EF"; ctx.fillRect(48, 150, 440, 440);
      if (img.complete && img.naturalWidth) ctx.drawImage(img, 48, 150, 440, 440);
      ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fillRect(60, 548, 150, 32);
      ctx.fillStyle = "#4B5A51"; ctx.font = "500 20px 'Be Vietnam Pro', sans-serif"; ctx.fillText("Ảnh minh họa", 72, 571);
      // Tên + giá
      ctx.fillStyle = "#0D6B45"; ctx.font = "600 28px 'Be Vietnam Pro', sans-serif"; ctx.fillText(p.brand || "", 528, 190);
      ctx.fillStyle = "#14231B"; ctx.font = "800 42px 'Be Vietnam Pro', sans-serif";
      const y = wrap(ctx, p.name, 528, 245, 504, 54, 4);
      ctx.fillStyle = "#4B5A51"; ctx.font = "400 26px 'Be Vietnam Pro', sans-serif"; ctx.fillText(`Mã hàng: ${p.sku}`, 528, y + 6);
      if (opt.price) {
        ctx.fillStyle = "#B3261E"; ctx.font = "800 64px 'Be Vietnam Pro', sans-serif"; ctx.fillText(fmt(p.price), 528, y + 96);
        if (p.old) { ctx.fillStyle = "#4B5A51"; ctx.font = "400 30px 'Be Vietnam Pro', sans-serif"; const t = fmt(p.old); ctx.fillText(t, 528, y + 142); const w = ctx.measureText(t).width; ctx.fillRect(528, y + 131, w, 3); }
      }
      // Thông số
      if (opt.specs && p.specs.length) {
        ctx.fillStyle = "#fff"; ctx.fillRect(48, 630, 984, 330);
        ctx.fillStyle = "#14231B"; ctx.font = "700 32px 'Be Vietnam Pro', sans-serif"; ctx.fillText("Thông số", 80, 690);
        ctx.font = "400 28px 'Be Vietnam Pro', sans-serif";
        p.specs.slice(0, 8).forEach(([k, v], i) => {
          const col = i % 2, row = Math.floor(i / 2);
          ctx.fillStyle = "#4B5A51"; ctx.fillText(k, 80 + col * 480, 750 + row * 52);
          ctx.fillStyle = "#14231B"; ctx.fillText(fit(ctx, String(v), 230), 290 + col * 480, 750 + row * 52);
        });
      }
      ctx.fillStyle = "#08482F"; ctx.fillRect(0, 990, 1080, 90);
      ctx.fillStyle = "#fff"; ctx.font = "500 26px 'Be Vietnam Pro', sans-serif"; ctx.fillText(shop.address, 48, 1045);
    };
    draw();
    img.onload = draw;
  }, [p, shop, opt]);

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3 rounded-lg border border-line bg-white p-4">
        <b className="block">Tùy chọn ảnh</b>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={opt.price} onChange={(e) => setOpt((o) => ({ ...o, price: e.target.checked }))} className="size-5" />Hiện giá</label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={opt.specs} onChange={(e) => setOpt((o) => ({ ...o, specs: e.target.checked }))} className="size-5" />Hiện thông số</label>
        <button onClick={() => { const a = document.createElement("a"); a.download = `${p.sku}.png`; a.href = ref.current!.toDataURL("image/png"); a.click(); }}
          className="h-12 w-full rounded bg-brand font-semibold text-white">Tải ảnh PNG</button>
        <p className="text-xs text-ink-2">Gửi ảnh cho khách qua Zalo/Messenger.</p>
      </div>
      <canvas ref={ref} width={1080} height={1080} aria-label={`Ảnh thông tin ${p.name}`} className="w-full max-w-[640px] rounded-lg border border-line bg-white" />
    </div>
  );
}
