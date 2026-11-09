// Ô xác minh "không phải máy" (Cloudflare Turnstile) ở trang đăng nhập và đổi mật khẩu.
// Web chỉ chuyển mã từ trình duyệt sang Supabase Auth; Supabase tự kiểm mã với Cloudflare bằng khóa bí mật
// (bật ở Supabase → Authentication → Bot and Abuse Protection), nên gọi thẳng API Supabase cũng không né được.
// Chưa đặt NEXT_PUBLIC_TURNSTILE_SITE_KEY → không hiện ô, không gửi mã (dùng khi Supabase chưa bật xác minh).
// Khóa công khai (không phải bí mật), dùng ở trình duyệt.
export const TURNSTILE_SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();
export const CAPTCHA_FIELD = "captchaToken";

export const CAPTCHA_FAILED = "Xác minh chưa thành công hoặc đã hết hạn. Đợi ô xác minh hiện dấu ✓ rồi thử lại.";

// Máy chủ chuyển nguyên mã cho Supabase kiểm, không tự chặn khi thiếu mã: Supabase là nơi quyết định duy nhất
// (chưa bật xác minh thì vẫn đăng nhập được kể cả khi ô xác minh lỗi; đã bật thì thiếu mã sẽ bị từ chối).
export function captchaOption(form: FormData): { captchaToken?: string } {
  const token = String(form.get(CAPTCHA_FIELD) ?? "").slice(0, 4096);
  return token ? { captchaToken: token } : {};
}

// Supabase từ chối vì mã sai / hết hạn / đã dùng (kiểm trước cả mật khẩu, nên không lộ tài khoản có tồn tại không)
export const isCaptchaError = (error: { code?: string } | null) => error?.code === "captcha_failed";
