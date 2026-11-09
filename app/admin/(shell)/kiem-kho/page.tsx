import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { COUNT_STATUS, getRound, listRounds } from "@/lib/admin/counts";
import { getCategories } from "@/lib/catalog";
import { CreateRoundForm, RoundDetail } from "./CountClient";

export const metadata: Metadata = { title: "Kiểm kho" };

export default async function CountsPage({ searchParams }: PageProps<"/admin/kiem-kho">) {
  const me = await requireStaff();
  const { dot } = await searchParams;
  const rounds = await listRounds();
  const selectedId = Number(typeof dot === "string" ? dot : "") || rounds.find((r) => r.status !== "closed")?.id || rounds[0]?.id;
  const [round, categories] = await Promise.all([selectedId ? getRound(selectedId) : null, me.role === "owner" ? getCategories() : []]);
  const tone = { counting: "warn", pending: "info", closed: "ok" } as const;

  return (
    <>
      <PageHeader title="Kiểm kho" sub="Đối chiếu số tồn trên hệ thống với hàng thật." />
      {me.role === "owner" && <div className="mb-4"><CreateRoundForm categories={categories} /></div>}
      {rounds.length === 0 ? (
        <p className="rounded-lg border border-line bg-white p-6 text-center text-sm text-ink-2">Chưa có đợt kiểm kho nào.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <nav aria-label="Các đợt kiểm kho" className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {rounds.map((r) => (
              <Link key={r.id} href={`/admin/kiem-kho?dot=${r.id}`} aria-current={r.id === selectedId ? "page" : undefined}
                className={`min-w-56 shrink-0 rounded-lg border p-3 text-sm lg:min-w-0 ${r.id === selectedId ? "border-brand bg-brand-tint" : "border-line bg-white"}`}>
                <b className="block">{r.name}</b>
                <span className="text-xs text-ink-2">{r.scope} · {r.counted}/{r.total}</span>
                <span className="mt-1 block"><Badge tone={tone[r.status]}>{COUNT_STATUS[r.status]}</Badge></span>
              </Link>
            ))}
          </nav>
          {round && (
            <Card pad title={`${round.name} · ${round.scope ?? ""}`} action={<Badge tone={tone[round.status]}>{COUNT_STATUS[round.status]}</Badge>}>
              <RoundDetail id={round.id} status={round.status} items={round.items} isOwner={me.role === "owner"} canCount={me.perms.has("count_stock")} />
            </Card>
          )}
        </div>
      )}
    </>
  );
}
