import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatVnd } from "@/lib/shop";

export const metadata: Metadata = { title: "Giao dịch chuyển khoản" };

type Payment = {
  id: number; transaction_id: string; account_number: string; transfer_amount: number;
  transfer_type: string; payment_code: string | null; content: string | null; order_id: number | null;
  status: "matched" | "review" | "ignored"; review_reason: string | null; created_at: string;
};

export default async function PaymentsPage() {
  await requireStaff("process_orders");
  const db = await createClient();
  const { data, error } = await db.from("sepay_transactions")
    .select("id, transaction_id, account_number, transfer_amount, transfer_type, payment_code, content, order_id, status, review_reason, created_at")
    .order("created_at", { ascending: false }).limit(100);
  if (error) throw error;
  const rows = (data ?? []) as Payment[];
  const orderIds = [...new Set(rows.flatMap((r) => r.order_id === null ? [] : [r.order_id]))];
  const { data: orders } = orderIds.length ? await db.from("orders").select("id, code").in("id", orderIds) : { data: [] };
  const codes = new Map((orders ?? []).map((o) => [o.id, o.code]));

  return <>
    <PageHeader title="Giao dịch chuyển khoản" sub="Giao dịch SePay mới nhất; chỉ giao dịch đúng mã, đúng tài khoản và đủ tổng tiền mới tự xác nhận đơn." />
    {rows.length === 0 ? <p className="rounded-lg border border-line bg-white p-6 text-center text-sm text-ink-2">Chưa nhận được giao dịch nào.</p> :
      <ul className="divide-y divide-line rounded-lg border border-line bg-white">
        {rows.map((row) => <li key={row.id} className="space-y-1 p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="num">{formatVnd(row.transfer_amount)}{row.transfer_type === "in" ? " nhận vào" : " chuyển ra"}</b>
            <span className={row.status === "matched" ? "font-semibold text-ok" : "font-semibold text-gold-ink"}>{row.status === "matched" ? "Đã khớp đơn" : row.status === "ignored" ? "Đã bỏ qua" : "Cần kiểm tra"}</span>
          </div>
          <p className="break-all text-xs text-ink-2">Mã giao dịch: {row.transaction_id} · Tài khoản: {row.account_number}</p>
          <p>Nội dung: <span className="break-words">{row.content || "(trống)"}</span></p>
          <p className="text-ink-2">Mã đơn nhận diện: {row.payment_code || "không thấy"}{row.order_id && codes.has(row.order_id) ? <> · <Link className="font-semibold text-brand underline" href={`/admin/don-hang/${codes.get(row.order_id)}`}>{codes.get(row.order_id)}</Link></> : ""}</p>
          {row.review_reason && <p role="status" className="text-gold-ink">{row.review_reason}</p>}
          <time className="block text-xs text-ink-2" dateTime={row.created_at}>{new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(row.created_at))}</time>
        </li>)}
      </ul>}
  </>;
}
