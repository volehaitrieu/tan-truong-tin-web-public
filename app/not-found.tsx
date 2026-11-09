import Link from "next/link";
import { SearchX } from "lucide-react";
import { StoreShell } from "@/components/storefront/StoreShell";

export default function NotFound() {
  return (
    <StoreShell>
      <div className="mx-auto max-w-xl rounded-md bg-white px-6 py-12 text-center">
        <SearchX className="mx-auto size-12 text-brand" aria-hidden />
        <h1 className="mt-3 text-2xl font-extrabold">Không tìm thấy trang này</h1>
        <p className="mt-2 text-ink-2">Đường dẫn có thể đã sai hoặc sản phẩm không còn bán. Thử tìm món bạn cần, hoặc gọi shop 0948 732 064.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex h-11 items-center rounded-md bg-brand px-5 font-semibold text-white">Về trang chủ</Link>
          <Link href="/danh-muc" className="inline-flex h-11 items-center rounded-md border border-brand px-5 font-semibold text-brand">Xem sản phẩm</Link>
        </div>
      </div>
    </StoreShell>
  );
}
