// Hiện ngay khi bấm chuyển mục (trong lúc máy chủ chuẩn bị dữ liệu) — không còn cảm giác "đứng hình".
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Đang tải" className="animate-pulse motion-reduce:animate-none">
      <div className="mb-2 h-7 w-56 rounded bg-sunk" />
      <div className="mb-6 h-4 w-80 max-w-full rounded bg-sunk" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg bg-sunk" />)}
      </div>
      <div className="mt-4 space-y-2 rounded-lg border border-line p-4">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 rounded bg-sunk" />)}
      </div>
    </div>
  );
}
