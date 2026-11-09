"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteOrder } from "@/app/admin/(shell)/don-hang/actions";

export function DeleteOrderButton({ orderId, code }: { orderId: number; code: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const remove = () => startTransition(async () => {
    setError("");
    try {
      const result = await deleteOrder(orderId);
      if (!result.ok) {
        setError(result.error ?? "Không xóa được đơn hàng.");
        return;
      }
      dialog.current?.close();
      router.replace("/admin/don-hang");
      router.refresh();
    } catch {
      setError("Không kết nối được. Đơn hàng chưa được xác nhận là đã xóa; hãy tải lại trang để kiểm tra.");
    }
  });

  return (
    <>
      <button type="button" onClick={() => { setError(""); dialog.current?.showModal(); }}
        className="inline-flex h-11 items-center gap-1.5 rounded border border-danger px-3 text-sm font-semibold text-danger hover:bg-[#fef2f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger">
        <Trash2 className="size-4" aria-hidden="true" />Xóa đơn
      </button>
      <dialog ref={dialog} aria-labelledby="delete-order-title"
        onCancel={(event) => { if (pending) event.preventDefault(); }}
        onClose={() => setError("")}
        className="w-[min(calc(100%-2rem),28rem)] rounded-lg p-0 shadow-xl backdrop:bg-ink/50">
        <div className="p-5">
          <h2 id="delete-order-title" className="font-semibold">Xóa đơn {code}?</h2>
          <p className="mt-2 text-sm text-ink-2">Chỉ xóa được đơn đã hủy và chưa thanh toán. Thao tác này xóa vĩnh viễn các món hàng và lịch sử trạng thái của đơn, không thể khôi phục.</p>
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => dialog.current?.close()}
              className="h-11 rounded border border-line px-4 text-sm font-medium disabled:opacity-50">Giữ lại</button>
            <button type="button" disabled={pending} onClick={remove}
              className="h-11 rounded bg-danger px-4 text-sm font-semibold text-white disabled:opacity-50">
              {pending ? "Đang xóa…" : "Xóa đơn này"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
