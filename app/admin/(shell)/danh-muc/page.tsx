import type { Metadata } from "next";
import { Card, PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddBrandForm, AddCategoryForm, CategoryName } from "./CatClient";

export const metadata: Metadata = { title: "Danh mục & thương hiệu" };

export default async function CategoriesPage() {
  await requireStaff("edit_products");
  const db = await createClient();
  const [{ data: cats }, { data: brands }, { data: products }] = await Promise.all([
    db.from("categories").select("id, parent_id, name, slug, sort").order("sort").order("name"),
    db.from("brands").select("id, name").order("name"),
    db.from("products").select("category_id, brand_id"),
  ]);
  const all = cats ?? [];
  const parents = all.filter((c) => c.parent_id === null);
  const count = (id: number) => (products ?? []).filter((p) => p.category_id === id).length;
  const brandCount = (id: number) => (products ?? []).filter((p) => p.brand_id === id).length;

  return (
    <>
      <PageHeader title="Danh mục & thương hiệu" sub="8 danh mục cha cố định; thêm/đổi tên danh mục con và thương hiệu." />
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card pad title="Danh mục">
          <AddCategoryForm parents={parents.map((p) => ({ id: p.id, name: p.name }))} />
          <ul className="mt-4 divide-y divide-line">
            {parents.map((p) => {
              const subs = all.filter((c) => c.parent_id === p.id);
              return (
                <li key={p.id} className="py-3">
                  <b className="text-sm">{p.name}</b>
                  <span className="num ml-2 text-xs text-ink-2">{subs.reduce((s, c) => s + count(c.id), count(p.id))} SP</span>
                  <ul className="mt-1 space-y-0.5 pl-3">
                    {subs.map((c) => (
                      <li key={c.id} className="flex min-h-11 items-center justify-between gap-2 text-sm">
                        <CategoryName id={c.id} name={c.name} />
                        <span className="num text-xs text-ink-2">{count(c.id)} SP</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card pad title="Thương hiệu">
          <AddBrandForm />
          <ul className="mt-4 flex flex-wrap gap-2">
            {(brands ?? []).map((b) => (
              <li key={b.id} className="rounded-full bg-sunk px-3 py-1.5 text-sm">{b.name} <span className="num text-xs text-ink-2">{brandCount(b.id)}</span></li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
