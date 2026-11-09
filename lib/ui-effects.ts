// Hiệu ứng nhỏ cho trang đăng nhập (Web Animations API, không thư viện, không bộ lọc làm mờ).
// Máy bật "giảm chuyển động" thì bỏ qua hết.
const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Gõ phím: ô nhún nhẹ, icon đầu dòng nhảy lên một nhịp
export function bounceField(box: HTMLElement | null) {
  if (!box || reduced()) return;
  box.animate([{ transform: "scale(1)" }, { transform: "scale(1.012)" }, { transform: "scale(1)" }], { duration: 200, easing: "ease-out" });
  box.querySelector("svg")?.animate([{ transform: "translateY(0)" }, { transform: "translateY(-3px)" }, { transform: "translateY(0)" }], { duration: 260, easing: "ease-out" });
}

// Bấm nút: vệt sáng lan ra từ điểm chạm rồi tắt. Nút cần `relative overflow-hidden`.
export function rippleAt(e: { currentTarget: HTMLElement; clientX: number; clientY: number }, color: string) {
  if (reduced()) return;
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  const size = Math.max(r.width, r.height) * 2;
  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  Object.assign(dot.style, {
    position: "absolute", left: `${e.clientX - r.left - size / 2}px`, top: `${e.clientY - r.top - size / 2}px`,
    width: `${size}px`, height: `${size}px`, borderRadius: "9999px", background: color, pointerEvents: "none",
  });
  el.appendChild(dot);
  const anim = dot.animate([{ transform: "scale(0)", opacity: 0.5 }, { transform: "scale(1)", opacity: 0 }], { duration: 550, easing: "ease-out" });
  anim.onfinish = () => dot.remove();
}

// Bấm gửi mà thiếu ô bắt buộc: ô rung ngang một nhịp (viền đỏ do trạng thái lỗi của form). Máy bật "giảm chuyển động" thì bỏ qua.
export function shakeField(box: Element | null | undefined) {
  if (!box || reduced()) return;
  (box as HTMLElement).animate(
    [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-5px)" }, { transform: "translateX(3px)" }, { transform: "translateX(0)" }],
    { duration: 380, easing: "ease-in-out" },
  );
}
