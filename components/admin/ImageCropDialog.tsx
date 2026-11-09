"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import { MAX_IMAGE_EDGE, drawOnWhite, encodeCanvas, renamed } from "@/lib/image-encode";

// Khung vuông 1:1 (đúng khung ảnh sản phẩm trong docs/DESIGN.md): kéo để đặt sản phẩm vào giữa, phóng to bằng
// thanh trượt, hai ngón tay hoặc con lăn. "Dùng khung này" cắt đúng phần nhìn thấy thành một tệp mới để tải lên.
const MAX_ZOOM = 3;

type Crop = { zoom: number; x: number; y: number };

export function ImageCropDialog({ file, preview, onApply, onKeep, onDiscard }: {
  file: File; preview: string;
  onApply: (file: File) => void; onKeep: () => void; onDiscard: () => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const applyRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [frame, setFrame] = useState(0);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  // null = chưa chỉnh: ảnh nằm giữa khung, tính lúc vẽ nên khung đổi cỡ vẫn đúng tâm.
  const [manual, setManual] = useState<Crop | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    // ResizeObserver tự gọi một lần ngay khi bắt đầu theo dõi, nên không cần đo tay.
    const ro = new ResizeObserver(() => setFrame(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mở dạng modal + khóa cuộn trang nền (con lăn chuột để phóng to không cuộn biểu mẫu phía sau).
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    applyRef.current?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; dialog?.close(); };
  }, []);

  // Tỉ lệ "phủ kín": cạnh ngắn của ảnh vừa bằng cạnh khung khi zoom = 1.
  const base = natural && frame ? frame / Math.min(natural.w, natural.h) : 0;
  const crop: Crop = manual ? clamp(manual) : (natural && base ? { zoom: 1, x: (frame - natural.w * base) / 2, y: (frame - natural.h * base) / 2 } : { zoom: 1, x: 0, y: 0 });
  const setCrop = (update: (c: Crop) => Crop) => setManual((m) => update(m ?? crop));

  function clamp(next: Crop): Crop {
    if (!natural || !base) return next;
    const zoom = Math.min(MAX_ZOOM, Math.max(1, next.zoom));
    const w = natural.w * base * zoom;
    const h = natural.h * base * zoom;
    return { zoom, x: Math.min(0, Math.max(frame - w, next.x)), y: Math.min(0, Math.max(frame - h, next.y)) };
  }

  // Phóng to quanh tâm khung để sản phẩm đang ở giữa vẫn ở giữa.
  function zoomTo(zoom: number) {
    setCrop((c) => {
      const ratio = Math.min(MAX_ZOOM, Math.max(1, zoom)) / c.zoom;
      const half = frame / 2;
      return clamp({ zoom: c.zoom * ratio, x: half - (half - c.x) * ratio, y: half - (half - c.y) * ratio });
    });
  }

  function pointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: crop.zoom };
    }
  }

  function pointerMove(e: PointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinchStart.current) {
      const [a, b] = [...pointers.current.values()];
      zoomTo(pinchStart.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart.current.distance));
    } else if (pointers.current.size === 1) {
      setCrop((c) => clamp({ ...c, x: c.x + e.clientX - prev.x, y: c.y + e.clientY - prev.y }));
    }
  }

  function pointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
  }

  function wheel(e: WheelEvent<HTMLDivElement>) {
    zoomTo(crop.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
  }

  function keyMove(e: KeyboardEvent<HTMLDivElement>) {
    const step = 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      setCrop((c) => clamp({ ...c, x: c.x + dx, y: c.y + dy }));
    } else if (e.key === "+" || e.key === "=") zoomTo(crop.zoom * 1.1);
    else if (e.key === "-") zoomTo(crop.zoom / 1.1);
  }

  async function apply() {
    if (!natural || !base || busy) return;
    setBusy(true);
    try {
      const img = new Image();
      img.src = preview;
      await img.decode();
      const scale = base * crop.zoom;
      const side = frame / scale;
      const out = Math.max(1, Math.min(MAX_IMAGE_EDGE, Math.round(side)));
      const canvas = drawOnWhite(out, out, (ctx) => ctx.drawImage(img, -crop.x / scale, -crop.y / scale, side, side, 0, 0, out, out));
      onApply(renamed(file, await encodeCanvas(canvas)));
    } catch {
      setError("Không cắt được ảnh trên thiết bị này. Bấm Giữ ảnh gốc để dùng ảnh như cũ.");
      setBusy(false);
    }
  }

  const size = natural && base ? { width: natural.w * base * crop.zoom, height: natural.h * base * crop.zoom } : undefined;

  // Thẻ <dialog> mở bằng showModal(): trình duyệt tự giữ tiêu điểm bên trong, Esc để đóng, nằm trên mọi lớp
  // (thanh điều hướng đáy không đè lên được), nên không cần portal hay z-index.
  return (
    <dialog ref={dialogRef} aria-labelledby="crop-title" onCancel={(e) => { e.preventDefault(); onKeep(); }} className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-xl bg-transparent p-0 backdrop:bg-ink/50">
      <div className="w-full rounded-xl bg-white p-4 shadow-xl">
        <h2 id="crop-title" className="text-base font-semibold">Chỉnh khung ảnh</h2>
        <p className="mt-1 text-xs text-ink-2">Kéo ảnh để đặt sản phẩm vào giữa khung vuông. Phóng to bằng thanh trượt, hai ngón tay hoặc con lăn chuột.</p>
        <div
          ref={frameRef}
          tabIndex={0}
          aria-label="Vùng ảnh: dùng phím mũi tên để di chuyển, phím cộng và trừ để phóng to thu nhỏ"
          className="relative mx-auto mt-3 aspect-square w-full max-w-[360px] cursor-grab touch-none select-none overflow-hidden rounded bg-ground outline-none focus-visible:ring-2 focus-visible:ring-brand active:cursor-grabbing"
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onWheel={wheel} onKeyDown={keyMove}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview} alt="" draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => setError("Trình duyệt không hiển thị được ảnh này để chỉnh. Bấm Giữ ảnh gốc để vẫn tải ảnh lên.")}
            className="absolute left-0 top-0 max-w-none"
            style={size ? { width: size.width, height: size.height, transform: `translate(${crop.x}px, ${crop.y}px)` } : { opacity: 0 }}
          />
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => <span key={i} className="border border-white/40" />)}
          </div>
        </div>
        <label className="mt-3 flex items-center gap-3 text-xs">
          <span className="shrink-0">Phóng to</span>
          <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} disabled={!natural} onChange={(e) => zoomTo(Number(e.target.value))} className="w-full accent-brand" />
        </label>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onDiscard} className="mr-auto rounded border border-line px-3 py-2 text-sm text-danger">Bỏ ảnh</button>
          <button type="button" onClick={onKeep} className="rounded border border-line px-3 py-2 text-sm font-medium">Giữ ảnh gốc</button>
          <button ref={applyRef} type="button" onClick={() => void apply()} disabled={!natural || busy} className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Đang cắt…" : "Dùng khung này"}</button>
        </div>
      </div>
    </dialog>
  );
}
