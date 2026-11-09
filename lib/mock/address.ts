// Địa giới mới (2 cấp: Tỉnh/Thành → Phường/Xã). Dữ liệu mẫu rút gọn — sẽ thay bằng danh sách đầy đủ.
export const PROVINCES: Record<string, string[]> = {
  "Khánh Hòa": ["Phường Bắc Nha Trang", "Phường Nha Trang", "Phường Tây Nha Trang", "Phường Nam Nha Trang", "Phường Cam Ranh", "Phường Ninh Hòa", "Xã Diên Khánh", "Xã Cam Lâm"],
  "Đắk Lắk": ["Phường Buôn Ma Thuột", "Phường Tuy Hòa", "Xã Krông Pắc"],
  "Lâm Đồng": ["Phường Xuân Hương - Đà Lạt", "Phường Phan Thiết", "Xã Đức Trọng"],
  "TP. Hồ Chí Minh": ["Phường Sài Gòn", "Phường Bến Thành", "Phường Thủ Đức"],
};
// Giao nội thành: chỉ các phường của Nha Trang
export const isInner = (province: string, ward: string) => province === "Khánh Hòa" && /Nha Trang/.test(ward);
