"use client";
import { useMemo, useState, useTransition } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import { readXlsx } from "@/lib/excel/read-xlsx";
import { TEMPLATE_COLUMNS, TEMPLATE_SHEET, detectAndParse, markDuplicates, type ImportRow } from "@/lib/excel/parse-products";
import { buildXlsx, downloadBlob, type Cell } from "@/lib/excel/write-xlsx";
import { importProducts, type ImportResult } from "./actions";
import { formatVnd } from "@/lib/shop";

type Sub = { slug: string; name: string; parent: string };
const STEPS = ["1 · Chọn file", "2 · Xem trước & kiểm lỗi", "3 · Xác nhận"];
const WIDTHS = [22, 36, 12, 14, 14, 16, 18, 22, 24, 24, 16, 12, 8, 14, 36, 44, 44, 18, 14, 14];

// File mẫu: sheet SanPham (2 dòng ví dụ, cột Giá nhập + 10% có công thức), Hướng dẫn, Danh mục
function downloadTemplate(subs: Sub[]) {
  const ex = (r: number, v: Cell[]): Cell[] => v.map((x, i) => (i === 5 ? { formula: `IF(E${r}="","",ROUND(E${r}*1.1,0))` } : x));
  const rows: Cell[][] = [
    [...TEMPLATE_COLUMNS],
    ex(2, ["QUATDUNG-SENKO-DD1602", "Quạt đứng Senko DD1602 47W", "Cái", 520000, 410000, null, "Quạt", "Đồ gia dụng", "Quạt", "Quạt đứng", "Senko", "Kho 1", 5, 2,
      "Công suất: 47W\nSải cánh: 40cm\nĐiều khiển: nút nhấn", "Quạt đứng Senko chạy êm, gió mạnh.\nThân thép sơn tĩnh điện, bền.", "1. Lắp quạt đúng chiều, siết chặt ốc giữ cánh.\n2. Cắm điện 220V, chọn cấp gió.\n3. Rút phích điện trước khi vệ sinh.", "12 tháng", "Việt Nam", "Việt Nam"]),
    ex(3, ["AMSIEUTOC-PANA-17", "Ấm siêu tốc Panasonic 1.7L", "Cái", 650000, 520000, null, "Ấm siêu tốc", "Đồ gia dụng", "Ấm siêu tốc", "", "Panasonic", "Kệ A2", 8, 3,
      "Dung tích: 1.7 lít\nCông suất: 2200W", "Đun sôi nhanh, tự ngắt khi cạn nước.", "1. Đổ nước trong mức cho phép.\n2. Bật công tắc, ấm tự ngắt khi nước sôi.", "12 tháng theo hãng", "Nhật Bản", "Malaysia"]),
  ];
  const guide: Cell[][] = [
    ["Cột", "Cách nhập"],
    ["Mã hàng hóa", "Bắt buộc. Mã đã có trên web → web hiện bảng đối chiếu để bạn tick xác nhận thay đổi. Mã mới → thêm thẳng."],
    ["Tên sản phẩm, Đơn vị tính, Giá bán", "Bắt buộc. Giá tính bằng đồng, chỉ gõ số (ví dụ 520000)."],
    ["Giá nhập", "Tùy chọn. Giá nhập + 10% tự tính; web dùng con số này làm giá vốn để tính lãi."],
    ["Danh mục", "Danh mục cha như Gia dụng. Dùng cùng Danh mục con để phân loại chính xác."],
    ["Danh mục con", "Tên danh mục con có trong sheet “Danh mục”; đây là giá trị dùng để gắn sản phẩm vào web."],
    ["Phân loại", "Phân loại: nhóm nhỏ trong Danh mục con; một sản phẩm có thể có nhiều loại, ngăn bằng dấu chấm phẩy (vd. Quạt sàn; Quạt công nghiệp). Ô có nội dung thay toàn bộ Phân loại cũ sau khi bạn xác nhận; loại chưa có sẽ được tạo khi xác nhận. Để trống = giữ nguyên."],
    ["Ngành hàng", "Nhóm sản phẩm như Quạt hoặc Ấm siêu tốc. Các giá trị đã nhập sẽ tự hiện thành thẻ ngành hàng ở trang chủ."],
    ["Thông số, Mô tả", "Mỗi dòng một nội dung (trong ô Excel bấm Alt + Enter để xuống dòng). Thông số dạng “Tên: giá trị” hiện thành bảng."],
    ["Hướng dẫn sử dụng", "Các bước dùng sản phẩm, mỗi bước một dòng (Alt + Enter để xuống dòng), tối đa 3.000 ký tự. Hiện ở trang sản phẩm. Ô trống = giữ nguyên."],
    ["Tồn", "Số hàng đang có, là số nguyên từ 0 đến 100.000; ô trống = giữ nguyên; cần quyền chỉnh tồn. Sản phẩm mới: tồn đầu kỳ. Sản phẩm đã có: tick xác nhận để đặt đúng số tồn mới."],
    ["Ô để trống", "Với sản phẩm đã có: ô trống = giữ nguyên thông tin cũ trên web."],
  ];
  downloadBlob(buildXlsx([
    { name: TEMPLATE_SHEET, rows, widths: WIDTHS },
    { name: "Hướng dẫn", rows: guide, widths: [34, 110] },
    { name: "Danh mục", rows: [["Danh mục", "Thuộc nhóm"], ...subs.map((x) => [x.name, x.parent])], widths: [30, 30] },
  ]), "Mau_nhap_san_pham_TanTruongTin.xlsx");
}

// File dòng lỗi: đúng các cột mẫu + cột Ghi chú
function downloadErrors(bad: ImportRow[]) {
  const rows: Cell[][] = [[...TEMPLATE_COLUMNS, "Ghi chú"]];
  bad.forEach((r, i) => {
    const raw = r.raw ?? {
      "Mã hàng hóa": r.sku, "Tên sản phẩm": r.name, "Đơn vị tính": r.unit, "Giá bán": Number.isFinite(r.price) ? String(r.price) : "",
      "Giá nhập": r.cost != null && Number.isFinite(r.cost) ? String(r.cost) : "", "Ngành hàng": r.industry ?? "", "Danh mục": "", "Danh mục con": "", "Phân loại": r.classifications?.join("; ") ?? "", "Thương hiệu": r.brand ?? "",
      "Tồn": r.qty != null ? String(r.qty) : "", "Tồn tối thiểu": r.minQty != null ? String(r.minQty) : "", "Thông số": r.spec ?? "", "Hướng dẫn sử dụng": r.usageGuide ?? "", "Bảo hành": r.warranty ?? "", "Xuất xứ": r.origin ?? "",
    } as Record<string, string>;
    rows.push([...TEMPLATE_COLUMNS.map((c, ci) => (ci === 5 ? { formula: `IF(E${i + 2}="","",ROUND(E${i + 2}*1.1,0))` } : raw[c] ?? "")), `Dòng ${r.line}: ${r.errors.join("; ")}`]);
  });
  downloadBlob(buildXlsx([{ name: TEMPLATE_SHEET, rows, widths: [...WIDTHS, 50] }]), "San_pham_loi.xlsx");
}

export function ImportClient({ subs, brands }: { subs: Sub[]; brands: string[] }) {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [format, setFormat] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [defaultSub, setDefaultSub] = useState("");
  const [show, setShow] = useState<"all" | "error" | "nocat">("all");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const subName = useMemo(() => new Map(subs.map((s) => [s.slug, `${s.parent} › ${s.name}`])), [subs]);

  async function onFile(f: File | undefined) {
    setError(""); setRows(null); setResult(null);
    if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) return setError("Chỉ nhận file .xlsx (Excel).");
    try {
      // Mẫu KHO XHD: CHỈ đọc sheet DMHH (bỏ qua TON KHO)
      const sheets = await readXlsx(f);
      delete sheets["TON KHO"];
      const parsed = detectAndParse(sheets, brands, subs);
      setRows(markDuplicates(parsed.rows));
      setFormat(parsed.format);
      setFileName(f.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đọc được file.");
    }
  }

  const bad = rows?.filter((r) => r.errors.length) ?? [];
  const nocat = rows?.filter((r) => !r.errors.length && !r.sub) ?? [];
  const ok = rows ? rows.length - bad.length - (defaultSub ? 0 : nocat.length) : 0;
  const visible = (rows ?? []).filter((r) => (show === "error" ? r.errors.length : show === "nocat" ? !r.sub && !r.errors.length : true)).slice(0, 300);
  const step = result?.ok ? 2 : rows ? 1 : 0;

  return (
    <>
      <ol className="mb-5 grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => <li key={s} className={`rounded-lg p-3 text-center text-xs font-semibold sm:text-sm ${i <= step ? "bg-brand text-white" : "bg-white text-ink-2"}`}>{s}</li>)}
      </ol>

      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-white p-6 text-center hover:border-brand">
        <FileSpreadsheet className="size-10 text-brand" aria-hidden />
        <b>{fileName || "Chọn file Excel (.xlsx)"}</b>
        <span className="text-sm text-ink-2">File mẫu của web, mẫu DMHH (KHO XHD — chỉ đọc sheet DMHH) hoặc file quạt (Import_SanPham)</span>
        <input type="file" accept=".xlsx" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => downloadTemplate(subs)} className="inline-flex min-h-11 items-center gap-2 rounded border border-brand px-4 text-sm font-semibold text-brand hover:bg-brand-tint">
          <Download className="size-4" aria-hidden />Tải file Excel mẫu
        </button>
        <span className="text-xs text-ink-2">Gồm 2 dòng ví dụ, hướng dẫn và danh sách danh mục.</span>
      </div>
      {error && <p role="alert" className="mt-3 rounded bg-[#fef2f2] p-3 text-sm text-danger">{error}</p>}

      {rows && !result?.ok && (
        <section className="mt-4 rounded-lg border border-line bg-white p-4">
          <p className="text-sm">Mẫu: <b>{format}</b> · {rows.length} dòng · <span className="text-ok">{ok} dòng sẽ nhập</span> · <span className="text-danger">{bad.length} dòng lỗi (bỏ qua)</span> · <span className="text-ask">{nocat.length} dòng chưa rõ danh mục</span></p>
          {nocat.length > 0 && (
            <label className="mt-3 block text-sm">Danh mục cho {nocat.length} dòng chưa phân loại (để trống = bỏ qua các dòng này)
              <select value={defaultSub} onChange={(e) => setDefaultSub(e.target.value)} className="mt-1 h-11 w-full rounded border border-line bg-white px-3 sm:w-96">
                <option value="">— Bỏ qua —</option>
                {subs.map((s) => <option key={s.slug} value={s.slug}>{s.parent} › {s.name}</option>)}
              </select>
            </label>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {bad.length > 0 && (
              <button onClick={() => downloadErrors(bad)} className="inline-flex min-h-11 items-center gap-2 rounded border border-danger px-3 text-sm font-semibold text-danger hover:bg-[#fef2f2]">
                <Download className="size-4" aria-hidden />Xuất file sản phẩm lỗi ({bad.length})
              </button>
            )}
            {([["all", "Tất cả"], ["error", `Dòng lỗi (${bad.length})`], ["nocat", `Chưa rõ danh mục (${nocat.length})`]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setShow(k)} className={`min-h-11 rounded border px-3 text-sm ${show === k ? "border-brand bg-brand-tint text-brand" : "border-line"}`}>{l}</button>
            ))}
          </div>
          <div className="mt-3 max-h-[60vh] overflow-auto rounded border border-line">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ground text-left text-xs text-ink-2"><tr>{["Dòng", "SKU", "Tên", "Đơn vị", "Giá bán", "Tồn", "Ngành hàng", "Danh mục", "Phân loại", "Tình trạng"].map((h) => <th key={h} className="px-2 py-2 font-semibold">{h}</th>)}</tr></thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.line} className={`border-t border-line ${r.errors.length ? "bg-[#fef2f2]" : ""}`}>
                    <td className="num px-2 py-1.5 text-ink-2">{r.line}</td>
                    <td className="num px-2">{r.sku}</td>
                    <td className="px-2">{r.name}</td>
                    <td className="px-2">{r.unit}</td>
                    <td className="num px-2">{Number.isFinite(r.price) ? formatVnd(r.price) : "—"}</td>
                    <td className="num px-2">{r.qty == null ? "Giữ nguyên" : Number.isFinite(r.qty) ? r.qty.toLocaleString("vi-VN") : "Không hợp lệ"}</td>
                    <td className="px-2">{r.industry ?? "—"}</td>
                    <td className="px-2 text-ink-2">{r.sub ? subName.get(r.sub) : defaultSub ? subName.get(defaultSub) : "—"}</td>
                    <td className="px-2">{r.classifications?.join("; ") ?? "Giữ nguyên"}</td>
                    <td className="px-2">{r.errors.length ? <span className="text-danger">{r.errors.join(", ")}</span> : <span className="text-ok">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.length === 300 && <p className="p-2 text-xs text-ink-2">Chỉ hiện 300 dòng đầu.</p>}
          </div>
          <p className="mt-3 text-[13px] text-ink-2">Mã mới được thêm ngay. Mã đã có: thông tin khác với web hiện ở bảng “Thay đổi chờ xác nhận” để bạn tick từng mục. Cột Tồn: sản phẩm mới dùng làm tồn đầu kỳ; sản phẩm đã có cần tick xác nhận để đặt đúng số tồn mới. Ô trống giữ nguyên, số 0 đặt hết hàng. Cần quyền chỉnh tồn kho.</p>
          <button disabled={pending || rows.length - bad.length <= 0} onClick={() => start(async () => setResult(await importProducts(rows.filter((r) => !r.errors.length), defaultSub || null)))}
            className="mt-3 h-12 rounded bg-brand px-5 font-semibold text-white disabled:opacity-50">{pending ? "Đang nhập…" : `Nhập ${rows.length - bad.length} dòng hợp lệ`}</button>
          {result && !result.ok && <p role="alert" className="mt-2 text-sm text-danger">{result.error}</p>}
        </section>
      )}
      {result?.ok && (
        <p role="status" className="mt-4 rounded-lg bg-brand-tint p-4 text-sm">
          Đã nhập xong: <b>{result.added}</b> sản phẩm mới, <b>{result.pending}</b> thay đổi chờ xác nhận (bảng phía trên), {result.unchanged} sản phẩm không đổi, {result.skipped} dòng bỏ qua.
          {result.classificationsCreated > 0 && <span className="mt-2 block">Đã tạo {result.classificationsCreated} Phân loại mới.</span>}
          {result.blocked.length > 0 && <span className="mt-2 block">Bỏ qua {result.blocked.length} sản phẩm: {result.blocked.slice(0, 5).join("; ")}{result.blocked.length > 5 ? "…" : ""}</span>}
          <span className="mt-2 block">Đã ghi tồn đầu kỳ cho {result.stockSet} sản phẩm mới.</span>
          {result.stockFailed > 0 && <span className="mt-2 block" role="alert">Chưa ghi được tồn cho {result.stockFailed} sản phẩm mới. Sản phẩm đã được tạo; hãy nhập lại file và xác nhận mục Tồn kho trong bảng đối chiếu.</span>}
          {result.stockIgnored && <span className="mt-2 block" role="alert">Đã bỏ qua cột Tồn vì bạn chưa có quyền chỉnh tồn kho.</span>}
        </p>
      )}
    </>
  );
}
