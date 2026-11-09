import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseSpecs, sanitizeHtml } from "@/lib/rich-text";

// Thông tin SP để xem nhanh / gửi khách (KHÔNG có giá nhập, tồn kho).
export type ProductPreview = {
  id: number; sku: string; name: string; unit: string; brand: string; price: number; salePrice: number | null;
  images: string[]; specs: [string, string][]; specNotes: string[]; description: string;
  warranty: string; origin: string; madeIn: string;
};

const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export async function getPreviews(ids: number[]): Promise<ProductPreview[]> {
  const clean = [...new Set(ids.filter((n) => Number.isSafeInteger(n) && n > 0))].slice(0, 200);
  if (!clean.length) return [];
  const db = await createClient();
  const [{ data }, { data: attrs }] = await Promise.all([
    db.from("products")
      .select("id, sku, name, unit, price, sale_price, sale_from, sale_to, spec_line, attributes, description, warranty, origin, made_in, brand:brands(name), images:product_images(url, sort)")
      .in("id", clean),
    db.from("categories").select("attribute_schema").neq("attribute_schema", "[]"),
  ]);
  const labels = new Map<string, { key: string; label: string; unit?: string }>();
  for (const c of attrs ?? []) for (const a of c.attribute_schema as { key: string; label: string; unit?: string }[]) labels.set(a.key, a);
  type R = {
    id: number; sku: string; name: string; unit: string; price: number; sale_price: number | null; sale_from: string | null; sale_to: string | null;
    spec_line: string | null; attributes: Record<string, string | number> | null; description: string | null; warranty: string | null;
    origin: string | null; made_in: string | null; brand: { name: string } | null; images: { url: string; sort: number }[];
  };
  const d = today();
  const byId = new Map(((data ?? []) as unknown as R[]).map((r) => {
    const parsed = parseSpecs(r.spec_line ?? "");
    const fromAttrs = Object.entries(r.attributes ?? {}).map(([k, v]) => {
      const l = labels.get(k);
      return [l?.label ?? k, `${v}${l?.unit ? " " + l.unit : ""}`] as [string, string];
    }).filter(([label]) => !parsed.rows.some(([n]) => n.toLowerCase() === label.toLowerCase()));
    const sale = r.sale_price != null && (!r.sale_from || r.sale_from <= d) && (!r.sale_to || r.sale_to >= d) ? r.sale_price : null;
    return [r.id, {
      id: r.id, sku: r.sku, name: r.name, unit: r.unit, brand: r.brand?.name ?? "", price: r.price, salePrice: sale,
      images: [...r.images].sort((a, b) => a.sort - b.sort).map((i) => i.url),
      specs: [...fromAttrs, ...parsed.rows], specNotes: parsed.notes,
      description: r.description ? sanitizeHtml(r.description) : "",
      warranty: r.warranty ?? "", origin: r.origin ?? "", madeIn: r.made_in ?? "",
    } satisfies ProductPreview];
  }));
  return clean.map((id) => byId.get(id)).filter(Boolean) as ProductPreview[];
}
