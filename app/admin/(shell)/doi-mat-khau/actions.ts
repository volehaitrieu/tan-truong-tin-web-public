"use server";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { passwordProblem } from "@/lib/password-rule";
import { CAPTCHA_FAILED, captchaOption, isCaptchaError } from "@/lib/turnstile";

export type PwState = { ok?: boolean; error?: string };

// Đổi mật khẩu: kiểm lại mật khẩu cũ trước (tránh người khác dùng máy đang đăng nhập để đổi).
export async function changePassword(_: PwState, form: FormData): Promise<PwState> {
  await requireStaff();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const again = String(form.get("again") ?? "");
  if (next.length > 72) return { error: "Mật khẩu mới tối đa 72 ký tự." };
  const weak = passwordProblem(next);
  if (weak) return { error: weak.replace("Mật khẩu", "Mật khẩu mới") };
  if (next !== again) return { error: "Hai lần nhập mật khẩu mới chưa khớp." };
  if (next === current) return { error: "Mật khẩu mới phải khác mật khẩu cũ." };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user?.email) return { error: "Phiên đăng nhập đã hết, vui lòng đăng nhập lại." };
  // Kiểm mật khẩu cũ bằng phiên tạm riêng (không đụng phiên đăng nhập đang dùng)
  const probe = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: wrong } = await probe.auth.signInWithPassword({ email: user.email, password: current, options: captchaOption(form) });
  if (isCaptchaError(wrong)) return { error: CAPTCHA_FAILED };
  if (wrong) return { error: "Mật khẩu hiện tại chưa đúng." };
  await probe.auth.signOut({ scope: "local" });
  const { error } = await db.auth.updateUser({ password: next });
  return error ? { error: "Không đổi được mật khẩu. Vui lòng thử lại." } : { ok: true };
}
