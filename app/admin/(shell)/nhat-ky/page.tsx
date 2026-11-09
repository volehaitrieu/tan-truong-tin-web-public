import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { AuditFilters } from "@/components/admin/AuditFilters";
import { Pagination } from "@/components/admin/Pagination";
import { requireStaff } from "@/lib/auth";
import { listAuditLog, listAuditPeople } from "@/lib/admin/audit-log";
import { AUDIT_DEFAULT_PER_PAGE, AUDIT_PER_PAGE_OPTIONS, parseAuditFilter, parseAuditPerPage, type AuditSearchParams } from "@/lib/admin/audit-params";

export const metadata: Metadata = { title: "Nhật ký thao tác" };

// Ai đã làm gì, lúc nào. Ghi tự động: trigger trong DB (sản phẩm, giá nhập, quyền, nhân viên, cài đặt)
// + máy chủ web (đăng nhập, xuất/nhập Excel, thêm nhân viên). Không ai sửa/xóa được nhật ký.
export default async function AuditPage({ searchParams }: { searchParams: Promise<AuditSearchParams> }) {
  await requireStaff("view_audit");
  const sp = await searchParams;
  const filter = parseAuditFilter(sp);
  const people = await listAuditPeople();
  const log = await listAuditLog(filter, people, { page: Number(sp.page) || 1, perPage: parseAuditPerPage(sp.per) });

  return (
    <>
      <PageHeader title="Nhật ký thao tác" sub="Chỉ xem · không ai sửa hoặc xóa được" />
      <AuditFilters key={JSON.stringify(filter)} people={people} init={filter} />
      {!log.entries.length ? (
        <p className="rounded-lg border border-line bg-white p-6 text-center text-sm text-ink-2">Không có thao tác nào khớp.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {log.entries.map((e) => (
            <li key={e.id} className="flex flex-wrap gap-x-4 gap-y-1 p-3 text-sm">
              <span className="num shrink-0 text-ink-2 sm:w-36">{e.at}</span>
              <span className="shrink-0 font-medium sm:w-32">{e.who}</span>
              <span className="min-w-0 flex-1 basis-full [overflow-wrap:anywhere] sm:basis-auto">
                {e.label}{e.target && <span className="num text-ink-2"> · {e.target}</span>}
                {e.detail && <small className="block text-ink-2">{e.detail}</small>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {log.total > 0 && (
        <Pagination page={log.page} pages={log.pages} perPage={log.perPage} total={log.total}
          perPageOptions={AUDIT_PER_PAGE_OPTIONS} defaultPerPage={AUDIT_DEFAULT_PER_PAGE} />
      )}
    </>
  );
}
