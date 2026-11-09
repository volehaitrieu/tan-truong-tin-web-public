import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Lớp bảo vệ ở trình duyệt: chống nhúng trang (clickjacking), chống đoán kiểu file, giới hạn nguồn tải mã.
// Next dùng mã inline nên script-src cần 'unsafe-inline'; chỉ cho kết nối tới chính web + Supabase của shop.
// Ô xác minh Cloudflare Turnstile (đăng nhập, đổi mật khẩu) cần tải mã và khung từ challenges.cloudflare.com.
const turnstile = "https://challenges.cloudflare.com";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${turnstile}${isDev ? " 'unsafe-eval'" : ""}`,
  `frame-src 'self' ${turnstile}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}`,
  "font-src 'self' data:",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// next/image chỉ tải ảnh ngoài đã khai báo: chỉ cho phép thư mục ảnh sản phẩm công khai trên Supabase của shop.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : null;

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  // Cho phép mở bản chạy thử từ điện thoại cùng mạng Wi-Fi
  allowedDevOrigins: ["192.168.5.122", "192.168.1.64"],
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, port: "", pathname: "/storage/v1/object/public/product-images/**", search: "" }]
      : [],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Nhớ tạm trang đã mở 30 giây trên trình duyệt: quay lại trang vừa xem hiện ngay, không chờ máy chủ.
  // Thao tác lưu (server action) vẫn làm mới dữ liệu ngay.
  experimental: { staleTimes: { dynamic: 30 } },
  // Trang quản trị chủ yếu là dữ liệu động theo người đăng nhập, nên tắt cacheComponents mặc định của Next 16.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
