import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";

// Client ẩn danh (vai trò "anon") cho trang bán hàng: không đọc cookie nên trang vẫn tạo tĩnh được.
// Chỉ thấy những gì RLS cho khách xem (SP đang hiển thị, danh mục, cài đặt).
export function createPublicClient() {
  return createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
