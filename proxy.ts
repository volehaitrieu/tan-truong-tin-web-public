import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Tự đăng xuất khi bỏ không mở trang quản trị quá 7 ngày (gói Supabase miễn phí không có sẵn tính năng này).
// Cookie ghi lần cuối mở trang; sống lâu bằng cookie phiên Supabase để không tự mất trước khi hết hạn chờ.
const LAST_SEEN = "ttt_last_seen";
const IDLE_LIMIT_MS = 7 * 24 * 60 * 60 * 1000;
const LAST_SEEN_COOKIE = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/admin", maxAge: 400 * 24 * 60 * 60,
} as const;

// Làm mới phiên đăng nhập Supabase và chặn khách chưa đăng nhập vào /admin.
// Kiểm quyền chi tiết nằm ở server (lib/auth.ts) và RLS — đây chỉ là lớp chặn đầu.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // getClaims: kiểm chữ ký JWT ngay tại máy chủ web (khóa ES256), làm mới phiên khi hết hạn — không cần hỏi Supabase mỗi lần
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub } : null;

  const now = Date.now();
  const lastSeen = Number(request.cookies.get(LAST_SEEN)?.value) || now; // chưa có cookie (phiên cũ) → tính từ bây giờ
  const idle = !!user && now - lastSeen > IDLE_LIMIT_MS;
  // Chỉ đăng xuất phiên trên máy này; máy khác của cùng người vẫn giữ phiên
  if (idle) await supabase.auth.signOut({ scope: "local" });

  const isLogin = request.nextUrl.pathname.startsWith("/admin/dang-nhap");
  if ((!user || idle) && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/dang-nhap";
    url.search = idle ? "?het-phien=1" : "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c)); // giữ lệnh xóa cookie phiên của signOut
    response = redirect;
  }
  response.cookies.set(LAST_SEEN, String(now), LAST_SEEN_COOKIE);
  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
