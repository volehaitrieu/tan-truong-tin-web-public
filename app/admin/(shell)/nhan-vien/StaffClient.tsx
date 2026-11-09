"use client";
import { useActionState, useState, useTransition, startTransition } from "react";
import { addStaff, setActive, setPermission, type AddStaffState } from "./actions";

type Person = { id: string; full_name: string; phone: string | null; role: "owner" | "order_staff" | "stock_staff"; is_active: boolean };
const ROLE_LABEL = { owner: "Chủ shop", order_staff: "NV đơn", stock_staff: "NV kho" } as const;
const input = "mt-1 h-11 w-full rounded border border-line bg-white px-3 text-sm";

export function AddStaffForm() {
  const [state, action, pending] = useActionState<AddStaffState, FormData>(addStaff, {});
  return (
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }} className="grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end">
      <label className="text-sm">Họ tên<input name="name" maxLength={80} required className={input} /></label>
      <label className="text-sm">Số điện thoại (dùng để đăng nhập)<input name="phone" inputMode="tel" maxLength={14} required className={`${input} num`} /></label>
      <label className="text-sm">Vai trò
        <select name="role" className={input} defaultValue="order_staff">
          <option value="order_staff">NV đơn</option>
          <option value="stock_staff">NV kho</option>
        </select>
      </label>
      <button disabled={pending} className="h-11 rounded bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Đang tạo…" : "Thêm nhân viên"}</button>
      {state.error && <p role="alert" className="text-sm text-danger sm:col-span-4">{state.error}</p>}
      {state.ok && (
        <p role="status" className="rounded bg-gold-tint p-3 text-sm text-gold-ink sm:col-span-4">
          Đã tạo tài khoản <b className="num">{state.phone}</b>. Mật khẩu tạm: <b className="num select-all">{state.password}</b> — chỉ hiện 1 lần, hãy đưa trực tiếp cho nhân viên.
        </p>
      )}
    </form>
  );
}

export function StaffList({ people, meId }: { people: Person[]; meId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="rounded-lg border border-line bg-white">
      <ul className="divide-y divide-line">
        {people.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
            <span className="grid size-10 place-items-center rounded-full bg-brand-tint font-bold text-brand">{(p.full_name || "?").charAt(0).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <b className="block text-sm">{p.full_name}</b>
              <span className="num text-xs text-ink-2">{p.phone} · {ROLE_LABEL[p.role]}</span>
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.is_active ? "bg-[#ecfdf5] text-brand" : "bg-sunk text-ink-2"}`}>{p.is_active ? "Đang hoạt động" : "Đã khóa"}</span>
            {p.role !== "owner" && p.id !== meId && (
              <button disabled={pending} onClick={() => start(async () => { const r = await setActive(p.id, !p.is_active); setError(r.error ?? ""); })}
                className="min-h-11 rounded border border-line px-3 text-sm disabled:opacity-50">
                {p.is_active ? "Khóa" : "Mở khóa"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="p-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function PermissionMatrix({ perms, matrix, editable }: { perms: { key: string; label: string }[]; matrix: Record<string, Record<string, boolean>>; editable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const roles = ["owner", "order_staff", "stock_staff"] as const;
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      <table className="w-full text-sm">
        <thead className="bg-ground text-xs text-ink-2">
          <tr><th className="p-3 text-left font-semibold">Quyền</th>{roles.map((r) => <th key={r} className="p-3 font-semibold">{ROLE_LABEL[r]}</th>)}</tr>
        </thead>
        <tbody>
          {perms.map((p) => (
            <tr key={p.key} className="border-t border-line">
              <td className="p-3">{p.label}</td>
              {roles.map((r) => (
                <td key={r} className="p-1 text-center">
                  <label className="inline-grid size-11 place-items-center">
                    <input type="checkbox" className="size-5" aria-label={`${p.label} — ${ROLE_LABEL[r]}`}
                      checked={r === "owner" ? true : !!matrix[r]?.[p.key]}
                      disabled={r === "owner" || !editable || pending}
                      onChange={(e) => start(async () => { const res = await setPermission(r, p.key, e.target.checked); setError(res.error ?? ""); })} />
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {error && <p role="alert" className="p-3 text-sm text-danger">{error}</p>}
      <p className="border-t border-line p-3 text-xs text-ink-2">Đổi quyền có hiệu lực ngay ở lần tải trang kế tiếp của nhân viên. Chủ shop luôn có mọi quyền.</p>
    </div>
  );
}
