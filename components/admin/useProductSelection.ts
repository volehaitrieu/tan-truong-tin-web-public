"use client";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

// Logic chọn nhiều sản phẩm, KHÔNG chứa giao diện: giao diện nào cũng dùng lại được.
// - Giữ yên một dòng LONG_PRESS_MS → bật chế độ chọn và chọn dòng đó.
// - Trong chế độ chọn: chạm nhẹ = chọn/bỏ chọn; ngoài chế độ chọn: chạm nhẹ = onOpen (mở chi tiết).
// - Ngón tay trượt quá MOVE_TOLERANCE_PX = đang cuộn, không tính là giữ yên.
// - Chạm vào vùng không mang data-selection-keep → hủy chọn.
const LONG_PRESS_MS = 600;
const MOVE_TOLERANCE_PX = 10;
export const SELECTION_KEEP_ATTR = "data-selection-keep";

export function useProductSelection(onOpen: (id: number) => void) {
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const selecting = picked.size > 0;
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const firedFor = useRef<number | null>(null); // dòng vừa được bật bằng giữ yên: bỏ qua cú "click" ngay sau đó

  const toggle = useCallback((id: number) => setPicked((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }), []);
  const clear = useCallback(() => setPicked(new Set()), []);
  const remove = useCallback((id: number) => setPicked((s) => { const next = new Set(s); next.delete(id); return next; }), []);
  const setMany = useCallback((ids: number[], on: boolean) => setPicked((s) => {
    const next = new Set(s);
    for (const id of ids) if (on) next.add(id); else next.delete(id);
    return next;
  }), []);

  const cancelPress = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };

  useEffect(() => cancelPress, []);

  // Điện thoại: chạm vào vùng trống (ngoài dòng sản phẩm, thanh chọn, khung chi tiết) → hủy chọn.
  // Desktop chọn bằng ô tick nên không tự hủy: nếu không, bấm "Tải" hay ô tick thứ hai sẽ xóa lựa chọn trước.
  useEffect(() => {
    if (!selecting) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (window.matchMedia("(min-width: 768px)").matches) return;
      if (!(e.target instanceof Element) || !e.target.closest(`[${SELECTION_KEEP_ATTR}]`)) clear();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [selecting, clear]);

  // Gắn vào mỗi dòng sản phẩm.
  const rowProps = (id: number) => ({
    [SELECTION_KEEP_ATTR]: "",
    "aria-selected": picked.has(id),
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        firedFor.current = id;
        setPicked((s) => new Set(s).add(id));
        navigator.vibrate?.(15);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > MOVE_TOLERANCE_PX) cancelPress();
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onPointerLeave: cancelPress,
    // Chặn menu "lưu ảnh / sao chép" của điện thoại khi giữ lâu trên ảnh.
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (firedFor.current === id) { firedFor.current = null; return; }
      if (selecting) toggle(id); else onOpen(id);
    },
  });

  return { picked, selecting, toggle, clear, remove, setMany, rowProps };
}
