// Dãy số trang để hiện: luôn có trang đầu, trang cuối, trang hiện tại và các trang kề bên;
// khoảng bị bỏ qua hiện bằng "…". Ví dụ trang 3/100: 1 2 3 4 … 98 99 100.
export type PageItem = number | "gap";

export function pageList(current: number, total: number, around = 1, edge = 1): PageItem[] {
  const keep = new Set<number>();
  for (let i = 1; i <= Math.min(edge, total); i++) keep.add(i);
  for (let i = Math.max(1, total - edge + 1); i <= total; i++) keep.add(i);
  for (let i = Math.max(1, current - around); i <= Math.min(total, current + around); i++) keep.add(i);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: PageItem[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev === 2) out.push(prev + 1); // chỉ thiếu 1 trang → hiện luôn số đó thay vì "…"
    else if (prev !== undefined && n - prev > 2) out.push("gap");
    out.push(n);
  });
  return out;
}

// "51–100/101": khoảng SP đang hiện trên tổng số SP khớp bộ lọc
export const shownRange = (page: number, perPage: number, total: number) =>
  total === 0 ? { from: 0, to: 0 } : { from: (page - 1) * perPage + 1, to: Math.min(page * perPage, total) };
