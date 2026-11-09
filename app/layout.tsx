import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: { default: "Tân Trường Tín", template: "%s · Tân Trường Tín" },
  description: "Điện nước · Kim khí · Dụng cụ · Quạt · Gia dụng — 379 đường 2/4, Bắc Nha Trang.",
  icons: { icon: "/brand/logo-64-favicon.png" },
  // Giai đoạn thử: không cho Google lập chỉ mục (bỏ dòng này khi mở bán)
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fefcf9",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full" suppressHydrationWarning>{children}</body>
    </html>
  );
}
