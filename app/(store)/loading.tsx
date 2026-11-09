// Màn chờ khi chuyển trang trong khu bán hàng: khung xám nhấp nhẹ đúng chỗ nội dung sẽ hiện, tránh cảm giác đứng hình.
export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="animate-pulse space-y-4">
      <div hidden data-theme-v2 />
      <span className="sr-only">Đang tải…</span>
      <div className="h-9 w-2/3 max-w-xs rounded-lg bg-sunk" />
      <div className="h-11 w-full rounded-full bg-sunk" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-surface p-2">
            <div className="aspect-square rounded-lg bg-sunk" />
            <div className="h-4 w-4/5 rounded bg-sunk" />
            <div className="h-5 w-1/2 rounded bg-sunk" />
          </div>
        ))}
      </div>
    </div>
  );
}
