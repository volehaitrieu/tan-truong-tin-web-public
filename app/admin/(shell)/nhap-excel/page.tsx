import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { firstImage } from "@/components/admin/ProductCell";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseClassificationChange } from "@/lib/admin/classifications";
import { plain } from "@/lib/excel/parse-products";
import { ImportClient } from "./ImportClient";
import { ReviewTable, type PendingChange } from "./ReviewTable";

export const metadata: Metadata = { title: "Nhập Excel" };

export default async function ImportPage() {
  await requireStaff("import_excel");
  const db = await createClient();
  const [{ data: cats }, { data: brands }, { data: pending }] = await Promise.all([
    db.from("categories").select("id, parent_id, name, slug, sort").order("sort"),
    db.from("brands").select("name").order("name"),
    db.from("import_changes")
      .select("id, field, old_value, new_value, created_at, product:products(id, sku, name, images:product_images(url, sort))")
      .order("product_id").order("id").limit(5000),
  ]);
  const all = cats ?? [];
  const subs = all.filter((c) => c.parent_id !== null).map((c) => ({ slug: c.slug, name: c.name, parent: all.find((p) => p.id === c.parent_id)?.name ?? "" }));
  type R = { id: number; field: string; old_value: string | null; new_value: string | null; product: { id: number; sku: string; name: string; images: { url: string; sort: number }[] } };
  const changes: PendingChange[] = ((pending ?? []) as unknown as R[]).map((c) => {
    // Phân loại lưu dạng JSON {sub, names}: hiện danh sách "A; B" (mẫu N2) và số loại sẽ được tạo mới khi xác nhận.
    const cls = c.field === "classifications" ? parseClassificationChange(c.new_value ?? "") : null;
    const parent = cls ? all.find((x) => x.slug === cls.sub) : undefined;
    const fresh = cls && parent ? cls.names.filter((n) => !all.some((x) => x.parent_id === parent.id && plain(x.name) === plain(n))).length : 0;
    return {
      id: c.id, field: c.field, oldValue: c.old_value, newValue: cls ? cls.names.join("; ") : c.new_value ?? "",
      newNote: fresh ? `${fresh} loại mới` : undefined,
      productId: c.product.id, sku: c.product.sku, name: c.product.name, image: firstImage(c.product.images),
    };
  });
  return (
    <>
      <PageHeader title="Nhập Excel" sub="Sản phẩm mới được thêm ngay; sản phẩm đã có thì đối chiếu và tick xác nhận từng thay đổi." />
      {changes.length > 0 && <ReviewTable changes={changes} />}
      <ImportClient subs={subs} brands={(brands ?? []).map((b) => b.name)} />
    </>
  );
}
