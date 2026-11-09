"use client";

// Trang báo lỗi cho khu bán hàng (thay vì màn hình lỗi mặc định): nói rõ cho khách và cho cách thử lại hoặc gọi shop.
export default function StoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <div hidden data-theme-v2 />
      <h1 className="text-2xl font-extrabold">Trang chưa tải được</h1>
      <p className="mt-2 text-ink-2">Có trục trặc tạm thời. Bạn thử tải lại, hoặc gọi shop 0948 732 064 để được hỗ trợ đặt hàng.</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={reset} className="h-12 rounded-full bg-brand px-6 font-semibold text-white hover:bg-brand-deep">Tải lại</button>
        <a href="tel:0948732064" className="inline-flex h-12 items-center justify-center rounded-full border border-line bg-surface px-6 font-semibold">Gọi shop</a>
      </div>
    </div>
  );
}
