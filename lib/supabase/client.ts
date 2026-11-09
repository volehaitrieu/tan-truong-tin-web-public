"use client";
import { createBrowserClient } from "@supabase/ssr";

// Trình duyệt dùng cùng phiên đăng nhập với proxy/server để Storage RLS kiểm tra quyền nhân viên.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
