import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  FolderTree,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShoppingCart,
  TicketPercent,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

// perm: quyền cần có để thấy mục này (không có = mọi nhân viên)
export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: Permission };

// 13 mục menu Admin — thứ tự theo docs/GIAO_DIEN_BAN_GIAO.md (A0).
export const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/don-hang", label: "Đơn hàng", icon: ReceiptText, perm: "process_orders" },
  { href: "/admin/giao-dich", label: "Giao dịch", icon: CreditCard, perm: "process_orders" },
  { href: "/admin/ban-tai-quay", label: "Bán tại quầy", icon: ShoppingCart, perm: "pos_sale" },
  { href: "/admin/san-pham", label: "Sản phẩm", icon: Package },
  { href: "/admin/nhap-excel", label: "Nhập Excel", icon: FileSpreadsheet, perm: "import_excel" },
  { href: "/admin/ton-kho", label: "Tồn kho", icon: Boxes },
  { href: "/admin/kiem-kho", label: "Kiểm kho", icon: ClipboardCheck },
  { href: "/admin/danh-muc", label: "Danh mục & thương hiệu", icon: FolderTree, perm: "edit_products" },
  { href: "/admin/khuyen-mai", label: "Khuyến mãi", icon: TicketPercent, perm: "edit_price" },
  { href: "/admin/bao-cao", label: "Báo cáo", icon: BarChart3, perm: "view_reports" },
  { href: "/admin/nhan-vien", label: "Nhân viên & quyền", icon: UserCog, perm: "manage_staff" },
  { href: "/admin/nhat-ky", label: "Nhật ký thao tác", icon: ScrollText, perm: "view_audit" },
  { href: "/admin/cai-dat", label: "Cài đặt", icon: Settings, perm: "settings" },
];

// 4 tab đầu trên thanh đáy điện thoại; còn lại nằm trong "Thêm".
// 4 tab chính ở thanh đáy điện thoại, đúng thứ tự hiển thị; các mục khác (kể cả Bán tại quầy) nằm trong "Thêm".
export const MOBILE_TABS = ["/admin", "/admin/don-hang", "/admin/san-pham", "/admin/ton-kho"];

// Các mục menu người này được thấy
export function visibleNav(perms: readonly Permission[]) {
  return ADMIN_NAV.filter((n) => !n.perm || perms.includes(n.perm));
}

export function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
}
