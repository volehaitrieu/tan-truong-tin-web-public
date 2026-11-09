"use client";
import { X } from "lucide-react";
import { useUrlParams } from "@/lib/use-url-params";
import { AUDIT_GROUPS, type AuditFilter } from "@/lib/admin/audit-params";

// Thanh lọc màn Nhật ký: người làm, loại việc, khoảng ngày — lọc NGAY khi đổi (không tải lại trang).
// Trang gắn key theo bộ lọc nên các ô tự về đúng giá trị khi URL đổi (kể cả bấm "Xóa bộ lọc").
const field = "h-10 w-full rounded border border-line bg-white px-3 text-sm outline-none focus:border-brand";

export function AuditFilters({ people, init }: { people: { id: string; name: string }[]; init: AuditFilter }) {
  const { update, pending } = useUrlParams();
  const filtering = !!(init.who || init.act || init.from || init.to);
  return (
    <form role="search" onSubmit={(e) => e.preventDefault()}
      className={`mb-4 grid grid-cols-2 gap-2 lg:flex lg:items-center ${pending ? "opacity-60" : ""}`}>
      <select defaultValue={init.who ?? ""} onChange={(e) => update({ who: e.target.value })} className={`${field} lg:w-48`} aria-label="Người làm">
        <option value="">Mọi người</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select defaultValue={init.act ?? ""} onChange={(e) => update({ act: e.target.value })} className={`${field} lg:w-48`} aria-label="Loại việc">
        <option value="">Mọi việc</option>
        {Object.entries(AUDIT_GROUPS).map(([key, g]) => <option key={key} value={key}>{g.label}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <span className="shrink-0">Từ</span>
        <input type="date" defaultValue={init.from} max={init.to} onChange={(e) => update({ from: e.target.value })} className={`${field} num lg:w-40`} />
      </label>
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <span className="shrink-0">Đến</span>
        <input type="date" defaultValue={init.to} min={init.from} onChange={(e) => update({ to: e.target.value })} className={`${field} num lg:w-40`} />
      </label>
      {filtering && (
        <button type="button" onClick={() => update({ who: null, act: null, from: null, to: null })}
          className="col-span-2 inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded border border-line bg-white px-3 text-sm font-medium text-ink-2 hover:border-danger hover:text-danger lg:w-auto">
          <X className="size-4" aria-hidden />Xóa bộ lọc
        </button>
      )}
    </form>
  );
}
