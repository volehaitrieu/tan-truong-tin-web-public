import { Check } from "lucide-react";
import { ORDER_STEPS } from "@/lib/mock/store";

// Các bước trạng thái đơn: đã qua (xanh, dấu tích) · đang ở (viền xanh) · chưa tới (xám)
export function OrderSteps({ current }: { current: number }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-4 sm:gap-2">
      {ORDER_STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-3 sm:flex-col sm:text-center">
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${
              i < current ? "bg-brand text-white" : i === current ? "border-2 border-brand bg-white text-brand" : "bg-sunk text-ink-2"
            }`}
            aria-hidden
          >
            {i < current ? <Check className="size-4" /> : i + 1}
          </span>
          <span className={`text-sm ${i <= current ? "font-semibold text-ink" : "text-ink-2"}`}>
            {s}
            {i === current && <span className="sr-only"> (hiện tại)</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
