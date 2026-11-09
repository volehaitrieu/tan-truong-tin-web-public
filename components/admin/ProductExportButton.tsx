"use client";
import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";
import { ExportColumnsDialog } from "@/components/admin/ExportColumnsDialog";
import { exportProducts, getExportOptions } from "@/app/admin/(shell)/san-pham/actions";
import { buildXlsx, downloadBlob } from "@/lib/excel/write-xlsx";
import { TEMPLATE_SHEET } from "@/lib/excel/parse-products";
import { FILTER_KEYS, type ProductSearchParams } from "@/lib/admin/products-params";

// Xuất Excel đúng những SP đang tìm/lọc (bỏ qua trang và số dòng mỗi trang); không lọc = tất cả SP.
// Tên sheet giống mẫu Nhập Excel để sửa xong nhập lại được.
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" }); // YYYY-MM-DD

export function ProductExportButton({ total, ids }: { total: number; ids?: number[] }) {
  const params = useSearchParams();
  const openerRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<{ withCost: boolean } | null>(null);
  const [error, setError] = useState("");
  const open = async () => {
    setBusy(true);
    setError("");
    try { setDialog(await getExportOptions()); }
    catch { setError("Không mở được bảng chọn cột. Vui lòng thử lại."); }
    finally { setBusy(false); }
  };
  const run = async (groups: string[]) => {
    setBusy(true);
    setError("");
    try {
      const sp: ProductSearchParams = {};
      for (const k of FILTER_KEYS) { const v = params.get(k); if (v) sp[k] = v; }
      const result = await exportProducts(sp, { ids, groups });
      if (!result.ok) { setError(result.error); return; }
      const widths = result.rows[0].map((h) => (h === "Tên sản phẩm" || h === "Mô tả" || h === "Link ảnh" ? 45 : 16));
      downloadBlob(buildXlsx([{ name: TEMPLATE_SHEET, rows: result.rows, widths }]), `San_pham_${today()}.xlsx`);
      setDialog(null);
    } catch {
      setError("Không xuất được file. Vui lòng kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span data-selection-keep="">
    <button ref={openerRef} type="button" onClick={() => void open()} disabled={busy || total === 0}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-ctl)] border border-line bg-surface px-3.5 text-sm font-medium text-ink hover:border-brand hover:text-brand disabled:opacity-50">
      <FileDown className="size-4" aria-hidden />{busy ? "Đang xuất…" : ids ? "Xuất Excel" : `Xuất Excel (${total})`}
    </button>
    {dialog && <ExportColumnsDialog openerRef={openerRef} total={total} withCost={dialog.withCost} busy={busy} error={error} onClose={() => setDialog(null)} onDownload={(groups) => void run(groups)} />}
    {error && !dialog && <span role="alert" className="block text-xs text-danger">{error}</span>}
    </span>
  );
}
