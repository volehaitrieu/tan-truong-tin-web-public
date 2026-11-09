"use client";
import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { submitQuote } from "@/app/(store)/actions";

// Kiểm tra ô nhập ở trình duyệt, rồi gửi lên server (server kiểm lại + chống spam).
export function QuoteForm({ initial = "" }: { initial?: string }) {
  const [list, setList] = useState(initial);
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ list?: string; phone?: string }>({});
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  if (sent)
    return (
      <div className="mt-5 rounded-md bg-white p-6 text-center" role="status">
        <CircleCheck className="mx-auto size-12 text-ok" aria-hidden />
        <p className="mt-3 font-semibold">Shop đã nhận yêu cầu báo giá.</p>
        <p className="mt-1 text-sm text-ink-2">Shop sẽ gọi số {phone} trong giờ mở cửa (7:45 – 20:30).</p>
      </div>
    );

  return (
    <form
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const err = {
          list: list.trim() ? "" : "Ghi ít nhất một món và số lượng, ví dụ “Ống PVC Φ21 × 50 cây”.",
          phone: /^0\d{9}$/.test(phone.replace(/\D/g, "")) ? "" : "Số điện thoại cần 10 số, bắt đầu bằng 0.",
        };
        setErrors(err);
        if (err.list || err.phone) return;
        setBusy(true);
        const res = await submitQuote(list, phone);
        setBusy(false);
        if (res.ok) setSent(true);
        else setErrors({ phone: res.error });
      }}
      className="mt-5 space-y-4 rounded-md bg-white p-4 sm:p-6"
    >
      <label className="block text-sm font-medium">
        Danh sách món cần báo giá *
        <textarea value={list} onChange={(e) => setList(e.target.value)} rows={5} className={`mt-1 w-full rounded-md border p-3 text-[15px] outline-none focus:border-brand ${errors.list ? "border-danger" : "border-line"}`} placeholder={"Ống PVC Bình Minh Φ21 × 50 cây\nDây Cadivi 2x2.5 × 3 cuộn"} />
        {errors.list && <span role="alert" className="mt-1 block text-[13px] font-normal text-danger">{errors.list}</span>}
      </label>
      <label className="block text-sm font-medium">
        Số điện thoại *
        <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" className={`num mt-1 h-12 w-full rounded-md border px-3 text-[15px] outline-none focus:border-brand ${errors.phone ? "border-danger" : "border-line"}`} />
        {errors.phone && <span role="alert" className="mt-1 block text-[13px] font-normal text-danger">{errors.phone}</span>}
      </label>
      <button type="submit" disabled={busy} className="h-12 w-full rounded-md bg-brand font-semibold text-white hover:bg-brand-deep disabled:opacity-60">{busy ? "Đang gửi…" : "Gửi yêu cầu báo giá"}</button>
    </form>
  );
}
