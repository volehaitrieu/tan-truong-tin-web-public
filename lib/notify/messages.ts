// Soạn nội dung tin báo đơn (văn bản thuần). Tách riêng để kiểm thử được mà không cần gọi Telegram.
// Định dạng tiền riêng ở đây (không import lib/shop) để tệp này chạy được trong kiểm thử Node thuần.
const vnd = new Intl.NumberFormat("vi-VN");
const formatVnd = (n: number) => `${vnd.format(n)}₫`;

// Văn bản thuần (không dùng định dạng HTML/Markdown) để tên khách hay ghi chú không chèn được liên kết hoặc định dạng giả.
export const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

const DELIVERY: Record<string, string> = { pickup: "Lấy tại cửa hàng", inner: "Giao nội thành Nha Trang", province: "Gửi đi tỉnh" };

export type OrderNotice = {
  code: string; name: string; phone: string; delivery: string; province?: string; ward?: string; street?: string; note?: string;
  subtotal: number; shippingFee: number | null; items: { name: string; qty: number }[];
};

export function orderMessage(o: OrderNotice): string {
  const lines = [
    `ĐƠN MỚI ${clean(o.code, 30)}`,
    `Khách: ${clean(o.name, 80)} · ${clean(o.phone, 20)}`,
    `Nhận hàng: ${DELIVERY[o.delivery] ?? "Chưa rõ"}`,
  ];
  const addr = [o.street, o.ward, o.province].map((x) => clean(x, 120)).filter(Boolean).join(", ");
  if (addr) lines.push(`Địa chỉ: ${addr}`);
  lines.push("Món:");
  for (const it of o.items.slice(0, 30)) lines.push(`- ${Math.max(0, Math.floor(Number(it.qty) || 0))} × ${clean(it.name, 90)}`);
  if (o.items.length > 30) lines.push(`… và ${o.items.length - 30} món khác`);
  lines.push(`Tạm tính: ${formatVnd(o.subtotal)} · Phí ship: ${o.shippingFee == null ? "báo sau" : formatVnd(o.shippingFee)}`);
  const note = clean(o.note, 300);
  if (note) lines.push(`Ghi chú: ${note}`);
  const site = (process.env.SITE_URL || "").replace(/\/+$/, "");
  if (site) lines.push(`Mở đơn: ${site}/admin/don-hang/${encodeURIComponent(o.code)}`);
  return lines.join("\n");
}

export function quoteMessage(items: string, phone: string): string {
  return [`YÊU CẦU BÁO GIÁ`, `SĐT: ${clean(phone, 20)}`, `Nội dung: ${clean(items, 600)}`].join("\n");
}

