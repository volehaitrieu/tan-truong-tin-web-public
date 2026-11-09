"use client";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { CAPTCHA_FIELD, TURNSTILE_SITE_KEY } from "@/lib/turnstile";

// Ô xác minh Cloudflare Turnstile đặt trong <form>: tự lấy mã rồi ghi vào ô ẩn gửi kèm form.
// Mỗi mã chỉ dùng được 1 lần → form gọi useCaptcha().renew() mỗi lần gửi (đổi `key` để vẽ ô mới, lấy mã mới).
type Turnstile = { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global {
  interface Window { turnstile?: Turnstile }
}
// Phải tải đúng địa chỉ gốc của Cloudflare (không tự lưu bản sao); CSP trong next.config.ts đã mở cho địa chỉ này.
const API = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// waiting: đang xác minh · ready: đã có mã · failed: ô lỗi (sai khóa, chưa khai tên miền, mạng chặn Cloudflare…)
export type CaptchaStatus = "waiting" | "ready" | "failed";

// Trạng thái xác minh của một form. Chỉ khóa nút gửi khi ô ĐANG xác minh; ô lỗi thì vẫn cho gửi để Supabase
// quyết định — tránh khóa cửa mọi người vì cấu hình sai khi Supabase chưa bật xác minh.
export function useCaptcha() {
  const [status, setStatus] = useState<CaptchaStatus>("waiting");
  const [round, setRound] = useState(0);
  const renew = useCallback(() => { setStatus("waiting"); setRound((r) => r + 1); }, []);
  const enabled = !!TURNSTILE_SITE_KEY;
  return { enabled, waiting: enabled && status === "waiting", round, setStatus, renew };
}

export function TurnstileWidget({ onStatus }: { onStatus: (status: CaptchaStatus) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const report = useRef(onStatus);
  const [token, setToken] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  useEffect(() => { report.current = onStatus; });

  // Vẽ ô khi script đã sẵn sàng (lần đầu tải, hoặc gắn lại sau khi đổi trang); không vẽ 2 lần vào cùng chỗ
  const mount = useCallback(() => {
    if (!box.current || !window.turnstile || widget.current) return;
    const set = (t: string, status: CaptchaStatus) => { setToken(t); report.current(status); };
    widget.current = window.turnstile.render(box.current, {
      sitekey: TURNSTILE_SITE_KEY, theme: "light", size: "flexible", "response-field": false,
      // Chỉ hiện ô khi Cloudflare cần khách tương tác (đa số lần đăng nhập không thấy ô); nghi ngờ thì vẫn có ô để tự xác minh.
      appearance: "interaction-only",
      callback: (t: string) => set(t, "ready"),
      // Hết hạn / quá giờ: Cloudflare tự lấy mã mới → chờ. Lỗi: Cloudflare tự thử lại, trong lúc đó vẫn cho gửi.
      "expired-callback": () => set("", "waiting"), "timeout-callback": () => set("", "waiting"), "error-callback": () => set("", "failed"),
    });
  }, []);
  useEffect(() => {
    mount();
    return () => {
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [mount]);

  return (
    <div>
      <Script src={API} onReady={mount} onError={() => { setLoadFailed(true); report.current("failed"); }} />
      {/* Không đặt chiều cao tối thiểu: khi ô đang ẩn (interaction-only) không chừa khoảng trống */}
      <div ref={box} />
      <input type="hidden" name={CAPTCHA_FIELD} value={token} />
      {loadFailed && <p role="alert" className="mt-1.5 text-sm text-danger">Không tải được ô xác minh. Kiểm tra mạng rồi tải lại trang.</p>}
    </div>
  );
}
