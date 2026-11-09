"use client";

import { ArrowLeftRight, Check } from "lucide-react";
import { hasSku, MAX_COMPARE } from "@/lib/compare";
import { addCompare, notify, removeCompare, useCompareSkus } from "@/components/storefront/compare/store";

// variant "card": nút tròn 44px nằm cạnh nút Thêm vào giỏ trên thẻ (chủ shop chỉnh 08/11, thay cho góc ảnh); "inline": nút chữ ở trang chi tiết.
export function CompareButton({ sku, name, variant = "card" }: { sku: string; name: string; variant?: "card" | "inline" }) {
  const skus = useCompareSkus();
  const on = skus ? hasSku(skus, sku) : false;
  const full = !!skus && !on && skus.length >= MAX_COMPARE;

  const onClick = () => {
    // Chưa khởi tạo xong kho thì không nhận thao tác, tránh ghi đè lựa chọn vừa phục hồi.
    if (!skus) return;
    if (on) {
      removeCompare(sku);
      notify(`Đã bỏ ${name} khỏi so sánh.`);
      return;
    }
    const result = addCompare(sku);
    if (result.status === "full") notify(`Chỉ so sánh tối đa ${MAX_COMPARE} sản phẩm. Hãy bỏ một sản phẩm trước.`);
    else if (result.status === "added") notify(`Đã thêm ${name} vào so sánh (${result.list.length}/${MAX_COMPARE}).`);
  };

  const label = on ? `Bỏ ${name} khỏi so sánh` : `Thêm ${name} vào so sánh`;
  if (variant === "inline") {
    return (
      <button type="button" onClick={onClick} aria-pressed={on} aria-disabled={full || undefined} aria-label={label} className={`mt-1 flex min-h-11 items-center gap-2 text-sm font-semibold text-ink hover:underline ${full ? "opacity-60" : ""}`}>
        {on ? <Check className="size-4" aria-hidden /> : <ArrowLeftRight className="size-4" aria-hidden />}
        {on ? "Đã chọn để so sánh · bấm để bỏ" : "So sánh với sản phẩm khác"}
      </button>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-disabled={full || undefined} aria-label={label} title={on ? "Bỏ khỏi so sánh" : "So sánh"} className={`grid size-10 shrink-0 place-items-center rounded-full border transition-colors sm:size-11 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink hover:border-brand hover:text-brand"} ${full ? "opacity-50" : ""}`}>
      {on ? <Check className="size-5" aria-hidden /> : <ArrowLeftRight className="size-5" aria-hidden />}
    </button>
  );
}
