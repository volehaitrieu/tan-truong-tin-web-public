import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, type Staff } from "@/lib/auth";
import { AUDIT_GROUPS, type AuditFilter } from "@/lib/admin/audit-params";

// Đọc nhật ký thao tác (RLS: chỉ người có quyền view_audit — mặc định chỉ chủ shop) và diễn giải thành câu dễ đọc.
export type AuditEntry = { id: number; at: string; who: string; label: string; target: string; detail: string };
export type AuditPerson = { id: string; name: string };

const ACTION: Record<string, string> = {
  "insert:products": "Thêm sản phẩm", "update:products": "Sửa sản phẩm", "delete:products": "Xóa sản phẩm",
  "insert:product_costs": "Nhập giá nhập", "update:product_costs": "Sửa giá nhập", "delete:product_costs": "Xóa giá nhập",
  "update:role_permissions": "Đổi quyền", "update:profiles": "Sửa nhân viên", "insert:staff": "Thêm nhân viên",
  "update:settings": "Sửa cài đặt", "login": "Đăng nhập", "export:products": "Xuất Excel sản phẩm", "import:products": "Nhập Excel",
};
const FIELD: Record<string, string> = {
  price: "giá bán", sale_price: "giá KM", sale_from: "KM từ", sale_to: "KM đến", name: "tên", is_visible: "hiển thị",
  cost_price: "giá nhập", import_price: "giá nhập", allowed: "cho phép", role: "vai trò", is_active: "hoạt động", inner_ship_fee: "phí ship nội thành",
};
const IGNORE = new Set(["updated_at", "search_text", "in_stock"]);
const fmt = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

type Details = Record<string, unknown> | null;

// Sửa: liệt kê trường đổi "cũ → mới"
function changes(d: Details) {
  const old = d?.old as Record<string, unknown> | undefined, next = d?.new as Record<string, unknown> | undefined;
  if (!old || !next) return "";
  return Object.keys(next)
    .filter((k) => !IGNORE.has(k) && JSON.stringify(old[k]) !== JSON.stringify(next[k]))
    .map((k) => `${FIELD[k] ?? k}: ${String(old[k] ?? "—")} → ${String(next[k] ?? "—")}`)
    .join(" · ");
}

// "iPhone · Safari" từ chuỗi user-agent của trình duyệt
function deviceLabel(ua: string) {
  const os = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android"
    : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : "Máy khác";
  const browser = /Zalo/i.test(ua) ? "Zalo" : /Edg/.test(ua) ? "Edge" : /CriOS|Chrome\//.test(ua) ? "Chrome"
    : /FxiOS|Firefox/.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${os} · ${browser}` : os;
}

function detail(action: string, d: Details) {
  switch (action) {
    case "login":
      return [d?.device ? deviceLabel(String(d.device)) : "", d?.ip ? `IP ${d.ip}` : ""].filter(Boolean).join(" · ");
    case "export:products": {
      const filtered = Object.keys((d?.filter as object | undefined) ?? {}).length > 0;
      return `${d?.with_cost ? "Có cột giá nhập" : "Không có cột giá nhập"} · ${filtered ? "theo bộ lọc đang xem" : "tất cả sản phẩm"}`;
    }
    case "import:products":
      return `Thêm ${d?.added ?? 0} · chờ duyệt ${d?.pending ?? 0} · không đổi ${d?.unchanged ?? 0} · bỏ qua ${d?.skipped ?? 0}`;
    case "insert:staff":
      return [d?.name, ROLE_LABEL[d?.role as Staff["role"]]].filter(Boolean).join(" · ");
    case "insert:products":
    case "delete:products":
      return String(d?.name ?? "");
    default:
      return changes(d);
  }
}

// Mọi người từng có tài khoản (kể cả đã khóa) — để lọc và hiện tên người làm
export async function listAuditPeople(): Promise<AuditPerson[]> {
  const db = await createClient();
  const { data, error } = await db.from("profiles").select("id, full_name").order("full_name");
  if (error) throw error;
  return (data ?? []).map((p) => ({ id: p.id, name: p.full_name }));
}

// Ngày theo giờ Việt Nam → mốc thời gian: from = đầu ngày, to = hết ngày (đầu ngày hôm sau)
const dayStart = (d: string, plusDays = 0) => new Date(Date.parse(`${d}T00:00:00+07:00`) + plusDays * 86_400_000).toISOString();

// Bọc trong object: câu truy vấn Supabase là "thenable", trả thẳng từ hàm async sẽ bị chạy luôn
async function filteredLog(f: AuditFilter, columns: string, head = false) {
  const db = await createClient();
  let query = db.from("audit_log").select(columns, { count: "exact", head });
  if (f.who) query = query.eq("actor", f.who);
  if (f.act) query = query.in("action", [...AUDIT_GROUPS[f.act].actions]);
  if (f.from) query = query.gte("created_at", dayStart(f.from));
  if (f.to) query = query.lt("created_at", dayStart(f.to, 1));
  return { db, query };
}

// Nhật ký giá nhập lưu mã số SP → đổi sang mã hàng cho dễ đọc (SP đã xóa thì không còn mã)
async function costTargetSkus(db: Awaited<ReturnType<typeof createClient>>, ids: number[]) {
  const valid = [...new Set(ids.filter(Number.isSafeInteger))];
  if (!valid.length) return new Map<number, string>();
  const { data, error } = await db.from("products").select("id, sku").in("id", valid);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id as number, p.sku as string]));
}

export async function listAuditLog(f: AuditFilter, people: AuditPerson[], opts: { page: number; perPage: number }) {
  // Đếm trước để kẹp số trang (link cũ / sửa tay ?page= quá lớn vẫn hiện trang cuối thay vì lỗi)
  const { count, error: countError } = await (await filteredLog(f, "id", true)).query;
  if (countError) throw countError;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / opts.perPage));
  const page = Math.min(Math.max(1, opts.page), pages);
  const { db, query } = await filteredLog(f, "id, actor, action, target, details, created_at");
  const { data, error } = await query
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range((page - 1) * opts.perPage, page * opts.perPage - 1);
  if (error) throw error;

  const who = new Map(people.map((p) => [p.id, p.name]));
  type Row = { id: number; actor: string | null; action: string; target: string | null; details: Details; created_at: string };
  const rows = (data ?? []) as unknown as Row[];
  const skuOf = await costTargetSkus(db, rows.filter((r) => r.action.endsWith(":product_costs")).map((r) => Number(r.target)));
  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id, at: fmt.format(new Date(r.created_at)), who: (r.actor && who.get(r.actor)) || "Nhân viên", label: ACTION[r.action] ?? r.action,
    target: r.action.endsWith(":product_costs") ? skuOf.get(Number(r.target)) ?? `SP #${r.target} (đã xóa)` : r.target ?? "",
    detail: detail(r.action, r.details).slice(0, 240),
  }));
  return { entries, total, page, pages, perPage: opts.perPage };
}
