"use client";
import { startTransition, useActionState } from "react";
import { TurnstileWidget, useCaptcha } from "@/components/TurnstileWidget";
import { changePassword, type PwState } from "./actions";

const input = "mt-1 h-12 w-full rounded border border-line bg-white px-3";

// Kiểm mật khẩu cũ = đăng nhập lại với Supabase, nên cũng cần ô xác minh như trang đăng nhập
export function PasswordForm() {
  const [state, action, pending] = useActionState<PwState, FormData>(changePassword, {});
  const captcha = useCaptcha();
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); captcha.renew(); startTransition(() => action(fd)); }}
      className="max-w-md space-y-3 rounded-lg border border-line bg-white p-4 sm:p-5"
    >
      <label className="block text-sm">Mật khẩu hiện tại<input name="current" type="password" autoComplete="current-password" required className={input} /></label>
      <label className="block text-sm">Mật khẩu mới (ít nhất 8 ký tự, có cả chữ và số)<input name="next" type="password" autoComplete="new-password" minLength={8} maxLength={72} required className={input} /></label>
      <label className="block text-sm">Nhập lại mật khẩu mới<input name="again" type="password" autoComplete="new-password" required className={input} /></label>
      {captcha.enabled && <TurnstileWidget key={captcha.round} onStatus={captcha.setStatus} />}
      <button disabled={pending || captcha.waiting} className="h-12 w-full rounded bg-brand font-semibold text-white disabled:opacity-60">{pending ? "Đang đổi…" : captcha.waiting ? "Đang xác minh…" : "Đổi mật khẩu"}</button>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-ok">Đã đổi mật khẩu.</p>}
    </form>
  );
}
