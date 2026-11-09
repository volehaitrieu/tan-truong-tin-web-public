"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type CatState = { ok?: boolean; error?: string };
const slugify = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const done = () => {
  revalidatePath("/admin/danh-muc");
  revalidatePath("/", "layout");
};

// Thêm danh mục con (dưới 1 trong 8 danh mục cha) hoặc thương hiệu. Quyền: edit_products (RLS kiểm lại).
export async function addCategory(_: CatState, form: FormData): Promise<CatState> {
  await requireStaff("edit_products");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  const parentId = Number(form.get("parent_id"));
  if (name.length < 2) return { error: "Nhập tên danh mục." };
  if (!Number.isInteger(parentId)) return { error: "Chọn danh mục cha." };
  const db = await createClient();
  const { error } = await db.from("categories").insert({ name, slug: slugify(name), parent_id: parentId, sort: 99 }).select("id").single();
  if (error) return { error: error.code === "23505" ? "Danh mục này đã có." : "Không thêm được danh mục." };
  done();
  return { ok: true };
}

export async function renameCategory(id: number, name: string): Promise<CatState> {
  await requireStaff("edit_products");
  const n = name.trim().slice(0, 80);
  if (n.length < 2 || !Number.isInteger(id)) return { error: "Tên chưa hợp lệ." };
  const db = await createClient();
  const { error } = await db.from("categories").update({ name: n }).eq("id", id).select("id").single();
  done();
  return error ? { error: "Không đổi được tên." } : { ok: true };
}

export async function addBrand(_: CatState, form: FormData): Promise<CatState> {
  await requireStaff("edit_products");
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (name.length < 2) return { error: "Nhập tên thương hiệu." };
  const db = await createClient();
  const { error } = await db.from("brands").insert({ name, slug: slugify(name) }).select("id").single();
  if (error) return { error: error.code === "23505" ? "Thương hiệu này đã có." : "Không thêm được thương hiệu." };
  done();
  return { ok: true };
}
