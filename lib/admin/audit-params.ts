// Bộ lọc màn Nhật ký thao tác — đọc từ URL, dùng chung cho máy chủ (truy vấn) và trình duyệt (ô lọc).
export const AUDIT_PER_PAGE_OPTIONS = [50, 100, 200] as const;
export const AUDIT_DEFAULT_PER_PAGE = 50;

// Nhóm việc để lọc; khóa = giá trị ?act= trên URL, actions = mã việc trong bảng audit_log
export const AUDIT_GROUPS = {
  products: { label: "Sản phẩm", actions: ["insert:products", "update:products", "delete:products"] },
  costs: { label: "Giá nhập", actions: ["insert:product_costs", "update:product_costs", "delete:product_costs"] },
  excel: { label: "Nhập / xuất Excel", actions: ["import:products", "export:products"] },
  login: { label: "Đăng nhập", actions: ["login"] },
  staff: { label: "Nhân viên & quyền", actions: ["insert:staff", "update:profiles", "update:role_permissions"] },
  settings: { label: "Cài đặt", actions: ["update:settings"] },
} as const;
export type AuditGroup = keyof typeof AUDIT_GROUPS;

export type AuditFilter = { who?: string; act?: AuditGroup; from?: string; to?: string };
export type AuditSearchParams = { [K in keyof AuditFilter]?: string } & { page?: string; per?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) ? s : undefined);

// Giá trị lạ trên URL (sửa tay, link cũ) bị bỏ qua thay vì báo lỗi
export function parseAuditFilter(sp: AuditSearchParams): AuditFilter {
  return {
    who: sp.who && UUID.test(sp.who) ? sp.who : undefined,
    act: sp.act && Object.hasOwn(AUDIT_GROUPS, sp.act) ? (sp.act as AuditGroup) : undefined,
    from: day(sp.from),
    to: day(sp.to),
  };
}

export const parseAuditPerPage = (s?: string) => AUDIT_PER_PAGE_OPTIONS.find((n) => String(n) === s) ?? AUDIT_DEFAULT_PER_PAGE;
