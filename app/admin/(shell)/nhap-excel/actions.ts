"use server";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MAX_STOCK, finish, markDuplicates, plain, type ImportRow } from "@/lib/excel/parse-products";
import { htmlToText, sanitizeHtml, textToHtml } from "@/lib/rich-text";
import { costFromImport } from "@/lib/admin/products";
import { logEvent } from "@/lib/admin/audit";
import { ensureClassifications, isMissingTable, NOT_READY_ERROR, parseClassificationChange, PERMISSION_ERROR, setClassifications, slugify, type CatRow } from "@/lib/admin/classifications";

export type ImportResult =
  | { ok: true; added: number; pending: number; unchanged: number; skipped: number; stockSet: number; stockFailed: number; stockIgnored: boolean; classificationsCreated: number; blocked: string[] }
  | { ok: false; error: string };
const str = (v: unknown, max: number) => (v == null ? null : String(v).replace(/\r/g, "").trim().slice(0, max) || null);

// Các trường được so sánh khi SP đã có. Khóa = cột field trong bảng import_changes.
// "qty" (tồn kho) cần migration 20261106084208_import_changes_qty.sql đã chạy, nếu chưa bảng đối chiếu sẽ từ chối dòng tồn.
// "classifications" (nhiều Phân loại) cần migration 20261107000100_product_classifications.sql.
type Field = "name" | "unit" | "price" | "import_price" | "category" | "classifications" | "industry" | "brand" | "location" | "min_qty" | "qty" | "spec" | "description" | "usage_guide" | "warranty" | "origin" | "made_in";

type Db = Awaited<ReturnType<typeof createClient>>;
// Đặt số tồn đúng bằng `target`: tính chênh lệch với tồn lúc này rồi gọi hàm adjust_stock của cơ sở dữ liệu
// (kiểm quyền adjust_stock, khóa dòng, không cho âm, ghi lịch sử nhập kho kèm người thực hiện). Không ghi thẳng bảng inventory.
async function setStock(db: Db, productId: number, target: number, reason: "Nhập hàng" | "Kiểm kho"): Promise<string | null> {
  if (!Number.isSafeInteger(target) || target < 0 || target > MAX_STOCK) return "Số tồn không hợp lệ.";
  const { data, error } = await db.from("inventory").select("qty").eq("product_id", productId).maybeSingle();
  if (error || !data) return "Không đọc được tồn hiện tại.";
  const delta = target - data.qty;
  if (delta === 0) return null;
  const { error: e } = await db.rpc("adjust_stock", { p_product_id: productId, p_delta: delta, p_reason: reason, p_note: `Nhập Excel: tồn ${data.qty} → ${target}` });
  return e ? (/[À-ỹ]/.test(e.message) ? e.message : "Không ghi được số tồn.") : null;
}

// Ghi SP từ Excel. Kiểm lại toàn bộ ở server (không tin dữ liệu xem trước), bỏ qua dòng lỗi.
// SP mới → thêm thẳng. SP đã có → thay đổi đưa vào bảng chờ duyệt (import_changes), chưa ghi đè.
// Quyền: import_excel + edit_price (vì có giá bán/giá nhập). RLS + trigger trong DB kiểm thêm lần nữa.
export async function importProducts(input: ImportRow[], defaultSub: string | null): Promise<ImportResult> {
  const staff = await requireStaff("import_excel");
  await requireStaff("edit_price");
  const canCost = staff.perms.has("view_cost");
  const canStock = staff.perms.has("adjust_stock");
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: "Không có dòng nào để nhập." };
  if (input.length > 5000) return { ok: false, error: "Tối đa 5.000 dòng mỗi lần." };

  const db = await createClient();
  const { data: cats, error: categoryError } = await db.from("categories").select("id, slug, name, parent_id");
  if (categoryError) return { ok: false, error: "Không tải được danh mục. Vui lòng thử lại trước khi nhập sản phẩm." };
  const { error: industryError } = await db.from("products").select("industry").limit(0);
  if (industryError) return { ok: false, error: industryError.code === "42703" || industryError.code === "PGRST204"
    ? "Chức năng Ngành hàng chưa được cập nhật trên hệ thống. Vui lòng hoàn tất cập nhật trước khi nhập Excel."
    : "Không kiểm tra được dữ liệu sản phẩm. Vui lòng thử lại trước khi nhập Excel." };
  // Cột Hướng dẫn sử dụng cần migration 20261108000100_product_usage_guide.sql; chưa có thì từ chối file có cột này.
  const { error: guideError } = await db.from("products").select("usage_guide").limit(0);
  const guideReady = !guideError;
  const catId = new Map((cats ?? []).map((c) => [c.slug, c.id]));
  const catById = new Map<number, CatRow>((cats ?? []).map((c) => [c.id, c]));
  const resolvedSub = (r: ImportRow) => r.sub && catId.has(r.sub) ? r.sub : defaultSub && catId.has(defaultSub) ? defaultSub : null;
  const rows = markDuplicates(input.map((r) => finish({
    line: Number(r.line) || 0, sku: String(r.sku ?? "").toUpperCase().slice(0, 40), name: String(r.name ?? "").trim(),
    unit: String(r.unit ?? "").trim(), price: Number(r.price), cost: r.cost == null ? null : Number(r.cost),
    minQty: r.minQty == null ? null : Math.max(0, Math.min(100000, Number(r.minQty) || 0)),
    qty: r.qty == null ? null : Number(r.qty), // finish() báo lỗi dòng nếu không phải số nguyên 0–100.000
    sub: resolvedSub(r),
    classifications: Array.isArray(r.classifications) ? r.classifications.slice(0, 21).map((name) => String(name).replace(/\s+/g, " ").trim().slice(0, 81)).filter(Boolean) : null,
    industry: str(r.industry, 80),
    brand: str(r.brand, 60), spec: str(r.spec, 3000),
    attributes: Object.fromEntries(Object.entries(r.attributes ?? {}).slice(0, 20).map(([k, v]) => [k.slice(0, 30), String(v).slice(0, 120)])),
    warranty: str(r.warranty, 100), origin: str(r.origin, 100), location: str(r.location, 40), madeIn: str(r.madeIn, 100),
    description: str(r.description, 10000), usageGuide: str(r.usageGuide, 3000), errors: [],
  }, (() => {
    const sub = catById.get(catId.get(resolvedSub(r) ?? "") ?? -1);
    return !!sub && (sub.parent_id === null || catById.get(sub.parent_id)?.parent_id !== null);
  })())));
  const good = rows.filter((r) => r.errors.length === 0 && /^[A-Z0-9][A-Z0-9-]{1,40}$/.test(r.sku));
  if (!good.length) return { ok: false, error: "Không có dòng hợp lệ (kiểm tra mã, giá, danh mục)." };

  if (!guideReady && good.some((r) => r.usageGuide)) return { ok: false, error: "Hệ thống chưa được cập nhật để lưu Hướng dẫn sử dụng. Liên hệ người quản trị kỹ thuật trước khi nhập cột này." };
  // Phân loại (nhiều) cần bảng liên kết; chưa có thì từ chối file có cột Phân loại.
  const wantsClassifications = good.some((r) => r.classifications?.length);
  const { error: linkError } = await db.from("product_classifications").select("product_id").limit(0);
  if (wantsClassifications && isMissingTable(linkError)) return { ok: false, error: NOT_READY_ERROR };
  const canEditProducts = staff.perms.has("edit_products");
  if (wantsClassifications && !canEditProducts) return { ok: false, error: PERMISSION_ERROR };
  const usedSlugs = new Set((cats ?? []).map((c) => c.slug));
  let classificationsCreated = 0;
  const targetCategory = (r: ImportRow) => catId.get(r.sub ?? "");
  // Danh mục con hiện tại của SP (trước chuyển đổi, SP cũ có thể còn gắn thẳng vào Phân loại cấp 3).
  const subOf = (id: number | null | undefined) => {
    const cat = id ? catById.get(id) : undefined;
    const parent = cat?.parent_id ? catById.get(cat.parent_id) : undefined;
    return cat && parent?.parent_id ? parent.id : cat?.id ?? null;
  };
  const categoryPath = (id: number | null | undefined) => {
    const cat = id ? catById.get(id) : undefined;
    const parent = cat?.parent_id ? catById.get(cat.parent_id) : undefined;
    return cat ? parent?.parent_id ? `${parent.name} > ${cat.name}` : cat.name : null;
  };
  const nameKey = (x: string[]) => [...new Set(x.map((n) => n.toLocaleLowerCase("vi")))].sort().join("|");

  // Thương hiệu mới
  const brandNames = [...new Set(good.map((r) => r.brand).filter(Boolean))] as string[];
  if (brandNames.length) await db.from("brands").upsert(brandNames.map((name) => ({ name, slug: slugify(name) })), { onConflict: "name", ignoreDuplicates: true });
  const { data: brands } = await db.from("brands").select("id, name");
  const brandId = new Map((brands ?? []).map((b) => [b.name, b.id]));
  const brandName = new Map((brands ?? []).map((b) => [b.id, b.name]));

  // SP đã có
  type Old = {
    id: number; sku: string; name: string; unit: string; price: number; category_id: number | null; industry: string | null; brand_id: number | null;
    spec_line: string | null; description: string | null; usage_guide?: string | null; warranty: string | null; origin: string | null; made_in: string | null;
    inventory: { min_qty: number; location: string; qty: number } | null;
  };
  const old = new Map<string, Old>();
  for (let i = 0; i < good.length; i += 500) {
    const { data, error } = await db.from("products")
      .select(`id, sku, name, unit, price, category_id, industry, brand_id, spec_line, description, ${guideReady ? "usage_guide, " : ""}warranty, origin, made_in, inventory(min_qty, location, qty)`)
      .in("sku", good.slice(i, i + 500).map((r) => r.sku));
    if (error) return { ok: false, error: "Không đọc được sản phẩm hiện có để đối chiếu. Vui lòng thử lại." };
    for (const p of (data ?? []) as unknown as Old[]) old.set(p.sku, p);
  }
  // Phân loại hiện có của SP cũ (bảng liên kết; trước chuyển đổi thì suy từ danh mục cấp 3).
  const links = new Map<number, number[]>();
  if (!linkError && old.size) {
    const ids = [...old.values()].map((p) => p.id);
    for (let i = 0; i < ids.length; i += 500) {
      const { data, error } = await db.from("product_classifications").select("product_id, classification_id").in("product_id", ids.slice(i, i + 500));
      if (error) return { ok: false, error: "Không đọc được Phân loại hiện có để đối chiếu. Vui lòng thử lại." };
      for (const l of data ?? []) links.set(l.product_id, [...(links.get(l.product_id) ?? []), l.classification_id]);
    }
  }
  const currentNames = (p: Old) => {
    const fromLinks = (links.get(p.id) ?? []).map((id) => catById.get(id)?.name).filter((n): n is string => !!n);
    if (fromLinks.length) return fromLinks;
    const legacy = p.category_id ? catById.get(p.category_id) : undefined;
    return legacy && subOf(p.category_id) !== p.category_id ? [legacy.name] : [];
  };
  const costs = new Map<number, number | null>();
  if (canCost && old.size) {
    const { data } = await db.from("product_costs").select("product_id, import_price, cost_price").in("product_id", [...old.values()].map((p) => p.id));
    for (const c of data ?? []) costs.set(c.product_id, c.import_price ?? c.cost_price);
  }

  // 1) SP mới → thêm thẳng. Tồn trong file (nếu có quyền chỉnh tồn) ghi qua adjust_stock thành "Nhập hàng".
  let stockSet = 0;
  let stockFailed = 0;
  const fresh = good.filter((r) => !old.has(r.sku));
  for (const r of fresh.filter((x) => !x.sub)) r.errors.push("Chưa có danh mục");
  const toAdd = fresh.filter((r) => r.sub);
  for (let i = 0; i < toAdd.length; i += 500) {
    const batch = toAdd.slice(i, i + 500);
    const { data: saved, error } = await db.from("products").insert(batch.map((r) => ({
      sku: r.sku, name: r.name, slug: r.sku.toLowerCase(), unit: r.unit, price: r.price, category_id: targetCategory(r),
      industry: r.industry,
      brand_id: r.brand ? brandId.get(r.brand) ?? null : null, spec_line: r.spec, attributes: r.attributes,
      warranty: r.warranty, origin: r.origin, made_in: r.madeIn ?? null,
      description: r.description ? sanitizeHtml(textToHtml(r.description)) : null,
      ...(guideReady && r.usageGuide ? { usage_guide: r.usageGuide } : {}),
    }))).select("id, sku");
    if (error) return { ok: false, error: `Lỗi khi ghi lô ${i / 500 + 1}: ${/[À-ỹ]/.test(error.message) ? error.message : "vui lòng thử lại"}` };
    const id = new Map((saved ?? []).map((p) => [p.sku, p.id]));
    const c = batch.filter((r) => r.cost !== null).map((r) => ({ product_id: id.get(r.sku), import_price: r.cost, cost_price: costFromImport(r.cost!) }));
    if (c.length && canCost) await db.from("product_costs").upsert(c, { onConflict: "product_id" });
    for (const r of batch.filter((x) => x.minQty !== null || x.location))
      await db.from("inventory").update({ ...(r.minQty !== null ? { min_qty: r.minQty } : {}), ...(r.location ? { location: r.location } : {}) }).eq("product_id", id.get(r.sku));
    const withStock = canStock ? batch.filter((r) => r.qty != null && r.qty > 0 && id.has(r.sku)) : [];
    for (let k = 0; k < withStock.length; k += 10) {
      const results = await Promise.all(withStock.slice(k, k + 10).map((r) => setStock(db, id.get(r.sku)!, r.qty!, "Nhập hàng")));
      for (const m of results) if (m) stockFailed++; else stockSet++;
    }
    await db.from("product_images").insert([...id.values()].map((pid) => ({ product_id: pid, url: "/ai/hardware-hero.jpg", is_illustration: true })));
    // SP mới có Phân loại: tạo loại thiếu dưới đúng Danh mục con rồi gắn trong một giao dịch.
    for (const r of batch.filter((x) => x.classifications?.length && id.has(x.sku))) {
      const parent = catById.get(targetCategory(r)!)!;
      const ensured = await ensureClassifications(db, catById, usedSlugs, parent, r.classifications!, canEditProducts);
      if (!ensured.ok) return { ok: false, error: `Đã thêm sản phẩm ${r.sku} nhưng chưa gắn được Phân loại: ${ensured.error}` };
      classificationsCreated += ensured.created;
      const linkErr = await setClassifications(db, id.get(r.sku)!, parent.id, ensured.ids);
      if (linkErr) return { ok: false, error: `Đã thêm sản phẩm ${r.sku} nhưng chưa gắn được Phân loại: ${linkErr}` };
    }
  }

  // 2) SP đã có → so sánh từng trường có giá trị trong file (ô trống = giữ nguyên)
  const changes: { product_id: number; field: Field; old_value: string | null; new_value: string }[] = [];
  let unchanged = 0;
  const blocked: string[] = [];
  for (const r of good.filter((x) => old.has(x.sku))) {
    const p = old.get(r.sku)!;
    const before = changes.length;
    const subId = targetCategory(r);
    const subChanged = !!subId && subOf(p.category_id) !== subId;
    const oldNames = currentNames(p);
    // Đổi Danh mục con mà ô Phân loại trống trong khi SP đang có Phân loại → không đoán; báo để ghi Phân loại mới.
    if (subChanged && !r.classifications && oldNames.length) { blocked.push(`${r.sku}: đổi Danh mục con thì phải ghi Phân loại mới`); continue; }
    const cmp = (field: Field, oldV: string | null | undefined, newV: string | null | undefined) => {
      if (newV == null || newV === "") return;
      if ((oldV ?? "").trim() !== newV.trim()) changes.push({ product_id: p.id, field, old_value: oldV ?? null, new_value: newV });
    };
    cmp("name", p.name, r.name);
    cmp("unit", p.unit, r.unit);
    cmp("price", String(p.price), String(r.price));
    if (canCost && r.cost !== null) cmp("import_price", costs.has(p.id) && costs.get(p.id) != null ? String(costs.get(p.id)) : null, String(r.cost));
    if (subChanged) cmp("category", categoryPath(subOf(p.category_id)), categoryPath(subId));
    // Ô có nội dung thay TOÀN BỘ Phân loại cũ (so như tập hợp: khác thứ tự không tính là đổi); ô trống giữ nguyên.
    if (r.classifications?.length && r.sub && (subChanged || nameKey(oldNames) !== nameKey(r.classifications)))
      changes.push({ product_id: p.id, field: "classifications", old_value: oldNames.length ? oldNames.join("; ") : null, new_value: JSON.stringify({ sub: r.sub, names: r.classifications }) });
    cmp("industry", p.industry, r.industry);
    cmp("brand", p.brand_id ? brandName.get(p.brand_id) ?? null : null, r.brand);
    cmp("location", p.inventory?.location ?? null, r.location);
    if (r.minQty !== null) cmp("min_qty", String(p.inventory?.min_qty ?? 0), String(r.minQty));
    if (canStock && r.qty != null) cmp("qty", String(p.inventory?.qty ?? 0), String(r.qty));
    cmp("spec", p.spec_line, r.spec);
    cmp("description", p.description ? htmlToText(p.description) : null, r.description);
    cmp("usage_guide", p.usage_guide ?? null, r.usageGuide);
    cmp("warranty", p.warranty, r.warranty);
    cmp("origin", p.origin, r.origin);
    cmp("made_in", p.made_in, r.madeIn);
    if (changes.length === before) unchanged++;
  }
  for (let i = 0; i < changes.length; i += 500) {
    const { error } = await db.from("import_changes").upsert(changes.slice(i, i + 500), { onConflict: "product_id,field" });
    if (error) return { ok: false, error: "Không lưu được bảng đối chiếu, vui lòng thử lại." };
  }
  revalidatePath("/", "layout");
  const result = {
    added: toAdd.length, pending: changes.length, unchanged, skipped: rows.length - good.length + (fresh.length - toAdd.length) + blocked.length,
    stockSet, stockFailed, classificationsCreated, blocked: blocked.slice(0, 50), stockIgnored: !canStock && good.some((r) => r.qty != null), // có cột Tồn nhưng người nhập chưa có quyền chỉnh tồn
  };
  // Từng SP thêm/sửa đã có trigger ghi; đây là dòng tóm tắt cả lần nhập. Dữ liệu đã ghi nên lỗi nhật ký không chặn kết quả.
  await logEvent(db, "import:products", `${input.length} dòng`, result);
  return { ok: true, ...result };
}

// Xác nhận các thay đổi đã tick → ghi vào SP, xóa khỏi bảng chờ. Thay đổi chưa tick giữ nguyên.
export async function applyChanges(ids: number[]): Promise<{ ok: boolean; applied: number; error?: string }> {
  const staff = await requireStaff("import_excel");
  await requireStaff("edit_price");
  if (!Array.isArray(ids) || !ids.length || ids.length > 5000 || !ids.every(Number.isSafeInteger)) return { ok: false, applied: 0, error: "Chưa chọn thay đổi nào." };
  const db = await createClient();
  const { data, error } = await db.from("import_changes").select("id, product_id, field, new_value").in("id", ids);
  if (error || !data) return { ok: false, applied: 0, error: "Không đọc được bảng đối chiếu." };
  const { data: cats, error: catsError } = await db.from("categories").select("id, slug, name, parent_id");
  if (catsError) return { ok: false, applied: 0, error: "Không đọc được danh mục để xác nhận thay đổi." };
  const resolveCategory = (value: string) => {
    const parts = value.split(" > ");
    const matches = (cats ?? []).filter((c) => plain(c.name) === plain(parts.at(-1) ?? "") && (parts.length === 1 || (parts.length === 2 && (cats ?? []).some((p) => p.id === c.parent_id && plain(p.name) === plain(parts[0])))));
    return matches.length === 1 ? matches[0].id : null;
  };

  // Gom theo SP để mỗi SP chỉ ghi 1 lần mỗi bảng
  const byProduct = new Map<number, { id: number; field: Field; v: string }[]>();
  for (const c of data) byProduct.set(c.product_id, [...(byProduct.get(c.product_id) ?? []), { id: c.id, field: c.field as Field, v: c.new_value ?? "" }]);
  const done: number[] = [];
  const failed: string[] = [];
  const stockErrors: string[] = [];
  const canStock = staff.perms.has("adjust_stock");
  const catById = new Map<number, CatRow>((cats ?? []).map((c) => [c.id, c]));
  const catBySlug = new Map((cats ?? []).map((c) => [c.slug, c]));
  const usedSlugs = new Set((cats ?? []).map((c) => c.slug));
  const reasons: string[] = [];
  for (const [pid, list] of byProduct) {
    const categoryChange = list.find((c) => c.field === "category");
    const categoryId = categoryChange ? resolveCategory(categoryChange.v) : null;
    if (categoryChange && categoryId === null) { failed.push(String(pid)); continue; }
    // Phân loại: tạo loại thiếu (khi xác nhận), rồi đặt Danh mục con + thay toàn bộ liên kết trong một giao dịch DB.
    const classChange = list.find((c) => c.field === "classifications");
    if (classChange) {
      const payload = parseClassificationChange(classChange.v);
      const parent = payload ? catBySlug.get(payload.sub) : undefined;
      if (!payload || !parent || (categoryId !== null && categoryId !== parent.id)) { failed.push(String(pid)); reasons.push("Phân loại không khớp Danh mục con"); continue; }
      const ensured = await ensureClassifications(db, catById, usedSlugs, parent, payload.names, staff.perms.has("edit_products"));
      const linkErr = ensured.ok ? await setClassifications(db, pid, parent.id, ensured.ids) : ensured.error;
      if (linkErr) { failed.push(String(pid)); reasons.push(linkErr); continue; }
      // Hàm DB đã đặt luôn Danh mục con theo Phân loại → dòng chờ "Danh mục con" của SP này (nếu chưa tick) không còn ý nghĩa.
      await db.from("import_changes").delete().eq("product_id", pid).eq("field", "category");
    }
    const prod: Record<string, unknown> = {};
    const inv: Record<string, unknown> = {};
    let importPrice: number | null = null;
    let qtyTarget: number | null = null;
    for (const { field, v } of list) {
      if (field === "name") prod.name = v.slice(0, 200);
      else if (field === "unit") prod.unit = v.slice(0, 30);
      else if (field === "price") prod.price = Number(v);
      else if (field === "spec") prod.spec_line = v.slice(0, 3000);
      else if (field === "description") prod.description = sanitizeHtml(textToHtml(v));
      else if (field === "warranty") prod.warranty = v.slice(0, 100);
      else if (field === "origin") prod.origin = v.slice(0, 100);
      else if (field === "made_in") prod.made_in = v.slice(0, 100);
      else if (field === "usage_guide") prod.usage_guide = v.slice(0, 3000);
      else if (field === "category" && !classChange) prod.category_id = categoryId;
      else if (field === "industry") prod.industry = v.slice(0, 80);
      else if (field === "brand") {
        await db.from("brands").upsert({ name: v, slug: slugify(v) }, { onConflict: "name", ignoreDuplicates: true });
        const { data: b } = await db.from("brands").select("id").eq("name", v).maybeSingle();
        prod.brand_id = b?.id ?? null;
      } else if (field === "location") inv.location = v.slice(0, 40) || "Kho 1";
      else if (field === "min_qty") inv.min_qty = Math.max(0, Math.min(100000, Number(v) || 0));
      else if (field === "qty") qtyTarget = Number(v);
      else if (field === "import_price") importPrice = Number(v);
    }
    if (prod.category_id === null) delete prod.category_id;
    // Tồn: đặt đúng số đã tick (tính lại chênh lệch theo tồn lúc bấm xác nhận, không theo tồn lúc nhập file)
    let stockError: string | null = null;
    if (qtyTarget !== null) {
      stockError = canStock ? await setStock(db, pid, qtyTarget, "Kiểm kho") : "Bạn chưa có quyền chỉnh tồn kho.";
      if (stockError) stockErrors.push(stockError);
    }
    const errs = [
      stockError,
      Object.keys(prod).length ? (await db.from("products").update(prod).eq("id", pid)).error : null,
      Object.keys(inv).length ? (await db.from("inventory").update(inv).eq("product_id", pid)).error : null,
      importPrice !== null && staff.perms.has("view_cost") && Number.isSafeInteger(importPrice)
        ? (await db.from("product_costs").upsert({ product_id: pid, import_price: importPrice, cost_price: costFromImport(importPrice) })).error : null,
    ].filter(Boolean);
    if (errs.length) { failed.push(String(pid)); for (const e of errs) if (typeof e === "object" && e && "message" in e && /[À-ỹ]/.test(String(e.message))) reasons.push(String(e.message)); }
    else done.push(...list.map((x) => x.id));
  }
  if (done.length) await db.from("import_changes").delete().in("id", done);
  revalidatePath("/admin/nhap-excel");
  revalidatePath("/", "layout");
  return failed.length
    ? { ok: false, applied: done.length, error: `Đã ghi ${done.length} thay đổi; sản phẩm ${failed.join(", ")} không ghi được (${reasons[0] ?? "kiểm tra danh mục/phân loại và giá khuyến mãi"}${stockErrors.length ? `; tồn kho: ${stockErrors[0]}` : ""}).` }
    : { ok: true, applied: done.length };
}
