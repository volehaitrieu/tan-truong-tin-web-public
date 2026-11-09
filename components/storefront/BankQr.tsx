"use client";
import { useMemo, useState } from "react";
import qrcode from "qrcode-generator";
import { Check, Copy } from "lucide-react";
import { bankName, transferNote, vietQrPayload, type ShopBank } from "@/lib/vietqr";
import { formatVnd } from "@/lib/shop";

// Mã QR vẽ ngay trên máy từ nội dung VietQR (không gọi dịch vụ ngoài). Vẽ bằng thẻ path, không dùng innerHTML.
function QrSvg({ text }: { text: string }) {
  const { d, size } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let path = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { d: path, size: n };
  }, [text]);
  return (
    <svg viewBox={`-2 -2 ${size + 4} ${size + 4}`} role="img" aria-label="Mã QR chuyển khoản" shapeRendering="crispEdges" className="mx-auto size-60 max-w-full rounded-lg bg-white">
      <path d={d} fill="#000" />
    </svg>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0"><p className="text-xs text-ink-2">{label}</p><p className="num break-all font-semibold">{value}</p></div>
      <button
        type="button"
        onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); window.setTimeout(() => setDone(false), 1500); } catch {} }}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold hover:bg-brand-tint"
        aria-label={`Sao chép ${label.toLowerCase()}`}
      >
        {done ? <Check className="size-4 text-ok" aria-hidden /> : <Copy className="size-4" aria-hidden />}{done ? "Đã chép" : "Chép"}
      </button>
    </div>
  );
}

export function BankQr({ bank, amount, code, shippingPending = false }: { bank: ShopBank; amount: number; code: string; shippingPending?: boolean }) {
  const payload = vietQrPayload(bank, amount, code);
  const note = transferNote(code);
  return (
    <section className="mt-4 rounded-md bg-white p-5 sm:p-6" aria-labelledby="qr-title">
      <h2 id="qr-title" className="font-bold">Chuyển khoản bằng mã QR</h2>
      <p className="mt-1 text-[13px] text-ink-2">Mở app ngân hàng, chọn quét mã QR. Số tiền và nội dung đã điền sẵn; vui lòng giữ nguyên để hệ thống đối chiếu đúng đơn hàng.</p>
      <div className="mt-4"><QrSvg text={payload} /></div>
      <div className="mt-4 divide-y divide-line border-t border-line">
        <CopyRow label="Ngân hàng" value={bankName(bank.bin) || bank.bin} />
        <CopyRow label="Số tài khoản" value={bank.account_no} />
        {bank.account_name && <CopyRow label="Chủ tài khoản" value={bank.account_name} />}
        <CopyRow label={shippingPending ? "Số tiền hàng" : "Số tiền chuyển khoản"} value={formatVnd(amount)} />
        <CopyRow label="Nội dung chuyển khoản" value={note} />
      </div>
      <p className="mt-3 text-[13px] text-ink-2">{shippingPending ? "Mã QR chỉ gồm tiền hàng, chưa gồm phí giao hàng. Shop sẽ báo phần phí còn lại khi xác nhận đơn." : "Số tiền QR gồm tiền hàng và phí giao hàng đã hiển thị ở trên."} Giao dịch có số tiền sai sẽ cần shop kiểm tra thủ công.</p>
    </section>
  );
}
