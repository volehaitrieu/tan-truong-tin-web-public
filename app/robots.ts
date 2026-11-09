import type { MetadataRoute } from "next";

// GIAI ĐOẠN THỬ: chặn mọi công cụ tìm kiếm. Khi mở bán, đổi thành cho phép trang bán hàng (chặn /admin).
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
