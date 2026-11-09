import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { ButtonLink, PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";

export const metadata: Metadata = { title: "Duyệt gợi ý AI" };

// Task 2.4 (nút AI trong admin) đã BỎ ngày 21/10 — thay bằng phân loại dữ liệu sẵn khi nhập Excel (Task 1.5).
export default async function AiReviewPage() {
  await requireStaff("edit_products");
  return (
    <>
      <PageHeader title="Duyệt gợi ý danh mục bằng AI" crumbs={[{ label: "Sản phẩm", href: "/admin/san-pham" }, { label: "Duyệt gợi ý AI" }]} />
      <div className="flex flex-col items-center rounded-lg border border-dashed border-line bg-white px-6 py-14 text-center">
        <Sparkles className="mb-3 size-8 text-brand" aria-hidden />
        <p className="font-semibold">Chưa dùng trong đợt này</p>
        <p className="mt-1 max-w-md text-sm text-ink-2">Danh mục được xếp sẵn khi nhập Excel (theo từ khóa trong tên). Dòng chưa rõ danh mục được chọn tay ở bước xem trước.</p>
        <div className="mt-5"><ButtonLink href="/admin/nhap-excel" variant="secondary">Mở Nhập Excel</ButtonLink></div>
      </div>
    </>
  );
}
