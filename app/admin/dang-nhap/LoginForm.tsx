"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { TurnstileWidget, useCaptcha } from "@/components/TurnstileWidget";
import { login, type LoginState } from "./actions";
import { bounceField, rippleAt } from "@/lib/ui-effects";

// Đăng nhập thật qua Supabase Auth (server action). Nhân viên gõ SĐT hoặc email.
// Có ô xác minh Cloudflare (khi đã cấu hình, chế độ ẩn): nút Đăng nhập mở khi có mã xác minh.
// Kiểu v2: ô nhập bán trong suốt (thấy màu nền xuyên qua, không dùng blur), nút viên thuốc đen mực.
export function LoginForm() {
  const [show, setShow] = useState(false);
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const captcha = useCaptcha();
  const error = state.error ?? "";

  const box = (invalid: boolean) =>
    `relative flex h-[52px] items-center rounded-2xl border bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_8px_18px_-12px_rgba(24,24,24,0.28)] transition-[border-color,box-shadow,background-color] duration-150 focus-within:bg-white/90 focus-within:shadow-[0_0_0_3px_rgba(24,24,24,0.12)] ${invalid ? "border-danger" : "border-white/90 focus-within:border-[#181818]"}`;
  const input = "h-full w-full min-w-0 bg-transparent text-[15px] text-[#181818] outline-none shadow-none focus-visible:!rounded-none focus-visible:!shadow-none placeholder:text-[#6B655E]";

  return (
    <form action={(fd) => { captcha.renew(); action(fd); }} noValidate className="flex flex-col gap-3.5">
      <label className="group block">
        <span className="mb-1.5 ml-1 block text-[13px] font-medium text-[#181818] transition duration-150 group-focus-within:-translate-y-0.5 group-focus-within:font-semibold">Số điện thoại hoặc email</span>
        <span className={box(false)}>
          <Mail className="pointer-events-none absolute left-4 size-5 text-[#6B655E]" aria-hidden />
          <input name="id" key={state.id} defaultValue={state.id} maxLength={200} autoComplete="username" placeholder="Số điện thoại của bạn" onInput={(e) => bounceField(e.currentTarget.parentElement)} className={`${input} pl-12 pr-4`} />
        </span>
      </label>
      <label className="group block">
        <span className="mb-1.5 ml-1 block text-[13px] font-medium text-[#181818] transition duration-150 group-focus-within:-translate-y-0.5 group-focus-within:font-semibold">Mật khẩu</span>
        <span className={box(!!error)}>
          <Lock className="pointer-events-none absolute left-4 size-5 text-[#6B655E]" aria-hidden />
          <input
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Mật khẩu"
            onInput={(e) => bounceField(e.currentTarget.parentElement)}
            aria-invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
            className={`${input} pl-12 pr-14`}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            className="absolute right-1 top-1 grid size-11 place-items-center rounded-xl text-[#6B655E] hover:bg-white/60"
          >
            {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
          </button>
        </span>
        {error && (
          <span id="login-error" role="alert" className="mt-1.5 block text-sm text-danger">
            {error}
          </span>
        )}
      </label>
      {captcha.enabled && <TurnstileWidget key={captcha.round} onStatus={captcha.setStatus} />}
      <button type="submit" disabled={pending || captcha.waiting} onPointerDown={(e) => rippleAt(e, "rgba(255,255,255,0.35)")} className="relative mt-1.5 flex overflow-hidden h-[52px] w-full items-center justify-center rounded-full bg-[#181818] text-[15px] font-semibold text-[#ECE7E9] shadow-[0_10px_22px_-10px_rgba(24,24,24,0.55)] transition duration-150 hover:bg-[#2F2F2F] active:scale-[0.98] disabled:opacity-60">
        {pending ? "Đang đăng nhập…" : captcha.waiting ? "Đang xác minh…" : "Đăng nhập"}
      </button>
      <Link href="/" onPointerDown={(e) => rippleAt(e, "rgba(24,24,24,0.14)")} className="relative flex overflow-hidden h-[52px] w-full items-center justify-center rounded-full border border-[#B8B2AB] text-[15px] font-semibold text-[#181818] transition duration-150 hover:bg-white/50 active:scale-[0.98]">
        Về trang bán hàng
      </Link>
    </form>
  );
}
