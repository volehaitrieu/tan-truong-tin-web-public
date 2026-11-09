import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { getRound } from "@/lib/admin/counts";
import { CountPad } from "../../CountClient";

export const metadata: Metadata = { title: "Đếm kho" };

// Trang đếm cho NV kho trên điện thoại
export default async function CountPadPage({ params }: PageProps<"/admin/kiem-kho/[dot]/dem">) {
  await requireStaff("count_stock");
  const { dot } = await params;
  const round = Number.isInteger(Number(dot)) ? await getRound(Number(dot)) : null;
  if (!round) notFound();
  return (
    <>
      <PageHeader title={round.name} crumbs={[{ label: "Kiểm kho", href: `/admin/kiem-kho?dot=${round.id}` }, { label: "Đếm" }]} sub={round.scope ?? ""} />
      {round.status === "closed" ? <p className="rounded-lg bg-white p-4 text-sm">Đợt này đã chốt, không đếm thêm được.</p> : <CountPad id={round.id} items={round.items} />}
    </>
  );
}
