// Kiểu dữ liệu + hàm tiện ích dùng chung cho web bán hàng.
// Dữ liệu thật lấy từ Supabase qua lib/catalog.ts (file này không còn dữ liệu mẫu).

export type Category = {
  slug: string;
  name: string;
  icon: "wrench" | "plug" | "cable" | "bulb" | "fan" | "drill" | "bolt" | "home";
  subs: string[];
  subcategories?: { slug: string; name: string; count: number }[];
  count: number; // số mặt hàng hiển thị trên ô danh mục (mẫu)
};

export type Product = {
  sku: string;
  name: string;
  brand: string;
  industry: string;
  cat: string; // slug danh mục
  sub: string;
  classification?: string; // các Phân loại nối bằng ", " (hiển thị gọn ở giỏ hàng)
  classifications?: string[]; // một SP có thể thuộc nhiều Phân loại (bộ lọc HOẶC)
  price: number;
  old?: number; // giá gốc khi đang khuyến mãi
  unit: string;
  stock: boolean; // false → "Liên hệ" (vẫn đặt trước được)
  image: string;
  spec: string; // 1 dòng thông số chính trên thẻ
  specs: [string, string][];
  specNotes?: string[]; // dòng thông số không có dấu ":"
  description?: string; // HTML đã làm sạch
  usageGuide?: string[]; // các bước hướng dẫn sử dụng (mỗi dòng một bước)
  warranty: string;
};

// Trang danh sách chỉ cần dữ liệu để vẽ thẻ và lọc: bỏ mô tả dài, hướng dẫn, ghi chú thông số (chỉ dùng ở trang chi tiết) cho trang nhẹ hơn.
export const listProduct = (p: Product): Product => ({ ...p, description: undefined, usageGuide: undefined, specNotes: undefined });

export const ORDER_STEPS = ["Chờ xác nhận", "Đã xác nhận", "Đang giao / Sẵn sàng lấy", "Hoàn thành"];

// Tìm không dấu: "quat treo" khớp "Quạt treo"
export const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export const discountPct = (p: Product) => (p.old ? Math.round((1 - p.price / p.old) * 100) : 0);

// Số sản phẩm mỗi lượt "Xem thêm". Khung chờ máy chủ và lưới client dùng chung để không nhảy layout.
// Trang chủ lưới 5 cột trên desktop nên lấy 15 (3 hàng đủ); các trang có cột lọc lưới 4 cột nên lấy 12.
// Mỗi lần chỉ hiện 8 sản phẩm; lướt tới đâu tải thêm tới đó (ProductBrowser).
export const PAGE_SIZE = 8;
export const HOME_PAGE_SIZE = 8;
