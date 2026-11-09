import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";

// Client quyền cao (khóa bí mật) — CHỈ dùng ở server cho việc RLS không làm được
// (tạo tài khoản nhân viên). Luôn kiểm quyền người gọi TRƯỚC khi dùng.
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("Thiếu SUPABASE_SECRET_KEY trong .env.local");
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
