// Thông tin thật của cửa hàng — dùng chung cho mọi trang.
export const SHOP = {
  name: "Tân Trường Tín",
  tagline: "Điện nước · Kim khí · Dụng cụ · Quạt · Gia dụng",
  slogan: "Chất lượng tạo niềm tin, dịch vụ tạo khác biệt.",
  address: "379 đường 2/4, phường Bắc Nha Trang, Khánh Hòa",
  addressShort: "379 đường 2/4, Bắc Nha Trang",
  phone: "0948 732 064",
  phone2: "0793 783 379",
  hours: "7:45 – 20:30",
} as const;

const vnd = new Intl.NumberFormat("vi-VN");
export const formatVnd = (n: number) => `${vnd.format(n)}₫`;
export const formatNum = (n: number) => vnd.format(n);
