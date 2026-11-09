"use client";
import { startTransition, useActionState, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { addBrand, addCategory, renameCategory, type CatState } from "./actions";

const input = "h-11 w-full rounded border border-line bg-white px-3 text-sm";
const submit = (action: (fd: FormData) => void) => (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  const form = e.currentTarget;
  const fd = new FormData(form);
  startTransition(() => action(fd));
};

export function AddCategoryForm({ parents }: { parents: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<CatState, FormData>(addCategory, {});
  return (
    <form onSubmit={submit(action)} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <select name="parent_id" aria-label="Danh mục cha" className={input}>{parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <input name="name" aria-label="Tên danh mục con" placeholder="Tên danh mục con mới" maxLength={80} className={input} />
      <button disabled={pending} className="h-11 rounded bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">Thêm</button>
      {state.error && <p role="alert" className="text-sm text-danger sm:col-span-3">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-ok sm:col-span-3">Đã thêm.</p>}
    </form>
  );
}

export function AddBrandForm() {
  const [state, action, pending] = useActionState<CatState, FormData>(addBrand, {});
  return (
    <form onSubmit={submit(action)} className="flex flex-wrap gap-2">
      <input name="name" aria-label="Tên thương hiệu" placeholder="Tên thương hiệu mới" maxLength={60} className={`${input} flex-1`} />
      <button disabled={pending} className="h-11 rounded bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">Thêm</button>
      {state.error && <p role="alert" className="w-full text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="w-full text-sm text-ok">Đã thêm.</p>}
    </form>
  );
}

export function CategoryName({ id, name }: { id: number; name: string }) {
  const [edit, setEdit] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!edit)
    return (
      <span className="flex items-center gap-1">
        {name}
        <button aria-label={`Đổi tên ${name}`} onClick={() => setEdit(true)} className="grid size-11 -my-2 place-items-center rounded text-brand hover:bg-brand-tint"><Pencil className="size-4" /></button>
      </span>
    );
  return (
    <span className="flex flex-wrap items-center gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} maxLength={80} aria-label="Tên mới" className="h-10 rounded border border-line px-2 text-sm" />
      <button disabled={pending} onClick={() => start(async () => { const r = await renameCategory(id, value); if (r.ok) setEdit(false); setError(r.error ?? ""); })} className="h-10 rounded bg-brand px-3 text-sm text-white">Lưu</button>
      <button onClick={() => { setEdit(false); setValue(name); }} className="h-10 rounded border border-line px-3 text-sm">Hủy</button>
      {error && <span role="alert" className="text-sm text-danger">{error}</span>}
    </span>
  );
}
