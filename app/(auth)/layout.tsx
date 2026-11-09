// Trang đăng nhập / đăng ký khách đứng riêng: không đầu trang, chân trang, thanh dưới, nút Gọi/Zalo của web bán hàng.
// Địa chỉ vẫn là /tai-khoan/dang-nhap và /tai-khoan/dang-ky (nhóm thư mục (auth) không đổi địa chỉ).
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="min-h-dvh bg-[#F1EDEA] bg-[linear-gradient(180deg,#F1EDEA_0%,#F3F0E9_32%,#EFE9E6_58%,#EFE6E4_82%,#F0E6E5_100%)] md:grid md:place-items-center md:p-8">
      {children}
    </main>
  );
}
