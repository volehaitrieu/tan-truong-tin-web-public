import { requireStaff } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ClipboardList, PackageX, Wallet } from "lucide-react";
import { Badge, ButtonLink, Card, OwnerOnly, PageHeader } from "@/components/admin/ui";
import { ProductCell, stockClass } from "@/components/admin/ProductCell";
import { createClient } from "@/lib/supabase/server";
import { listStock } from "@/lib/admin/inventory";
import { DELIVERY_LABEL, STATUS_LABEL, STATUS_TONE, type OrderRow } from "@/lib/admin/orders";
import { formatNum, formatVnd } from "@/lib/shop";

export const metadata: Metadata = { title: "Tổng quan" };

const TZ = "Asia/Ho_Chi_Minh";
const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD theo giờ VN

// 7 ngày gần nhất theo giờ VN (tách khỏi component để không gọi Date.now() trong lúc render)
function last7Days() {
  const now = Date.now();
  return { since: new Date(now - 7 * 864e5), days: Array.from({ length: 7 }, (_, i) => dayKey(new Date(now - (6 - i) * 864e5))), now: new Date(now) };
}

// Số liệu thật: đơn 7 ngày (chỉ người xem được đơn), doanh thu (chỉ người có quyền báo cáo), tồn sắp hết.
export default async function DashboardPage() {
  const staff = await requireStaff();
  const canOrders = staff.perms.has("process_orders") || staff.perms.has("pos_sale");
  const canRevenue = staff.perms.has("view_reports");
  const db = await createClient();
  const { since, days, now } = last7Days();
  const [ordersRes, stock] = await Promise.all([
    canOrders
      ? db.from("orders").select("id, code, customer_name, phone, delivery, status, payment_status, subtotal, shipping_fee, needs_restock, created_at")
          .gte("created_at", since.toISOString()).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as OrderRow[] }),
    listStock(),
  ]);
  const orders = (ordersRes.data ?? []) as OrderRow[];
  const valid = orders.filter((o) => o.status !== "cancelled");
  const REVENUE_7D = days.map((d) => ({
    day: `${d.slice(8)}/${d.slice(5, 7)}`,
    value: valid.filter((o) => dayKey(new Date(o.created_at)) === d).reduce((s, o) => s + o.subtotal, 0),
  }));
  const countOn = (d: string) => orders.filter((o) => dayKey(new Date(o.created_at)) === d).length;
  const today = REVENUE_7D[6].value;
  const yesterday = REVENUE_7D[5].value;
  const pending = orders.filter((o) => o.status === "pending").length;
  const max = Math.max(1, ...REVENUE_7D.map((d) => d.value));
  const LOW_STOCK = stock.filter((p) => p.stock <= p.min && p.min > 0).slice(0, 8);
  const todo = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled").slice(0, 6);
  const dateLabel = new Intl.DateTimeFormat("vi-VN", { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(now);

  const stats = [
    ...(canRevenue ? [{ label: "Doanh thu hôm nay", value: formatVnd(today), note: `Hôm qua ${formatVnd(yesterday)}`, icon: Wallet, owner: true }] : []),
    ...(canOrders
      ? [
          { label: "Đơn mới hôm nay", value: String(countOn(days[6])), note: `Hôm qua ${countOn(days[5])} đơn`, icon: ClipboardList, owner: false },
          { label: "Chờ xác nhận", value: String(pending), note: "Cần gọi khách xác nhận", icon: AlertTriangle, owner: false },
        ]
      : []),
    { label: "Sản phẩm sắp hết", value: String(stock.filter((p) => p.stock <= p.min && p.min > 0).length), note: "Tồn ≤ tồn tối thiểu", icon: PackageX, owner: false },
  ];

  return (
    <>
      <PageHeader title="Tổng quan" sub={dateLabel} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon, owner }) => (
          <div key={label} className="rounded-[var(--radius-card)] border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[13px] text-ink-2">{label}</span>
              <Icon className="size-5 text-brand" aria-hidden />
            </div>
            <p className="num mt-2 text-xl font-bold md:text-2xl">{value}</p>
            <p className="mt-1 text-xs text-ink-2">{note}</p>
            {owner && <div className="mt-2"><OwnerOnly /></div>}
          </div>
        ))}
      </div>

      {canOrders && <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        {canRevenue && <Card title="Doanh thu 7 ngày" action={<OwnerOnly />}>
          <div className="flex h-56 items-end gap-2 px-4 pb-3 pt-6 md:gap-4" role="img" aria-label="Biểu đồ doanh thu 7 ngày">
            {REVENUE_7D.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="num text-[11px] text-ink-2">{(d.value / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr</span>
                <div className="w-full max-w-10 rounded-t bg-brand" style={{ height: `${Math.max(2, (d.value / max) * 150)}px` }} />
                <span className="text-[11px] text-ink-2">{d.day}</span>
              </div>
            ))}
          </div>
        </Card>}

        <Card title="Đơn cần xử lý" action={<Link href="/admin/don-hang" className="-my-2 inline-flex min-h-11 items-center text-sm font-medium text-brand hover:underline">Xem tất cả</Link>}>
          <ul className="divide-y divide-line">
            {todo.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-2">Không có đơn cần xử lý.</li>}
            {todo.map((o) => (
              <li key={o.code}>
                <Link href={`/admin/don-hang/${o.code}`} className="flex items-center gap-3 px-4 py-3 hover:bg-ground">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="num text-sm font-semibold">{o.code}</span>
                      {o.shipping_fee === null && o.delivery !== "pickup" && <Badge tone="gold">Chưa có phí ship</Badge>}
                    </span>
                    <span className="block truncate text-[13px] text-ink-2">
                      {o.customer_name} · {DELIVERY_LABEL[o.delivery]}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className="num text-sm font-semibold">{formatVnd(o.subtotal + (o.shipping_fee ?? 0))}</span>
                    <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>}

      <Card title="Sắp hết hàng" className="mt-4" action={<ButtonLink href="/admin/ton-kho" variant="secondary">Mở Tồn kho</ButtonLink>}>
        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold text-ink-2">
                <th className="px-4 py-2.5">Sản phẩm</th>
                <th className="px-4 py-2.5 text-right">Tồn / tối thiểu</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {LOW_STOCK.map((p) => (
                <tr key={p.sku} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5"><ProductCell name={p.name} sku={p.sku} image={p.image} size={44} /></td>
                  <td className="num px-4 text-right">
                    <span className={stockClass(p.stock, p.min)}>{formatNum(p.stock)}</span> / {formatNum(p.min)} {p.unit}
                  </td>
                  <td className="px-4">{p.stock === 0 ? <Badge tone="danger">Hết hàng</Badge> : <Badge tone="warn">Sắp hết</Badge>}</td>
                  <td className="px-4 text-right">
                    <Link href="/admin/ton-kho" className="font-medium text-brand hover:underline">Điều chỉnh</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="divide-y divide-line md:hidden">
          {LOW_STOCK.map((p) => (
            <li key={p.sku} className="flex items-center gap-3 px-4 py-3">
              <ProductCell name={p.name} sku={p.sku} image={p.image} size={44} className="flex-1 text-sm" extra={<span className="block">Còn <span className={stockClass(p.stock, p.min)}>{p.stock}</span>/{p.min} {p.unit}</span>} />
              {p.stock === 0 ? <Badge tone="danger">Hết hàng</Badge> : <Badge tone="warn">Sắp hết</Badge>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
