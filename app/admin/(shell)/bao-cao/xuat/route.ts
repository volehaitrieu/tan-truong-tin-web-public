import { getStaff } from "@/lib/auth";
import { buildReport } from "@/lib/admin/reports";

// Xuất báo cáo dạng CSV (mở bằng Excel). Có BOM UTF-8 để Excel hiện đúng tiếng Việt.
export async function GET(req: Request) {
  const me = await getStaff();
  if (!me || !me.perms.has("view_reports")) return new Response("Không có quyền", { status: 403 });
  const n = [7, 30, 90].includes(Number(new URL(req.url).searchParams.get("ngay"))) ? Number(new URL(req.url).searchParams.get("ngay")) : 7;
  const r = await buildReport(n, me.perms.has("view_profit") && me.perms.has("view_cost"));
  // Chặn công thức Excel (CSV injection): ô bắt đầu bằng = + - @ được thêm dấu '
  const esc = (v: string | number) => {
    let s = String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows: (string | number)[][] = [
    ["Báo cáo Tân Trường Tín", `${n} ngày gần nhất`],
    [],
    ["Ngày", "Doanh thu (đ)", "Số đơn"],
    ...r.days.map((d) => [d.day, d.revenue, d.orders]),
    [],
    ["Tổng doanh thu", r.revenue], ["Tổng số đơn", r.orders], ["Giá trị đơn trung bình", r.avg],
    ...(r.profit !== null ? [["Lãi gộp", r.profit]] : []),
    [],
    ["Sản phẩm bán chạy", "Số lượng", "Doanh thu (đ)"],
    ...r.top.map((t) => [t.name, t.qty, t.revenue]),
  ];
  const csv = "﻿" + rows.map((row) => row.map(esc).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bao-cao-${n}-ngay.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
