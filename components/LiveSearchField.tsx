"use client";
import { useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { LIVE_DELAY_MS, useUrlParams } from "@/lib/use-url-params";

// Ô tìm kiếm lọc ngay khi gõ, dùng chung cho quản trị và web bán hàng. Chỉ lo hành vi; giao diện nhận qua className.
// param: tên tham số trên URL (quản trị dùng "q", trang tìm kiếm của web bán hàng dùng "query").
export function LiveSearchField({ param, initial = "", placeholder, label, targetPath, className = "", inputClassName = "", maxLength = 80, autoFocus }: {
  param: string; initial?: string; placeholder: string; label: string; targetPath?: string;
  className?: string; inputClassName?: string; maxLength?: number; autoFocus?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  // URL đổi từ nơi khác (ô tìm đầu trang, nút Back) → cập nhật chữ trong ô, trừ lúc người dùng đang gõ ở đây.
  const [seen, setSeen] = useState(initial);
  if (initial !== seen) {
    setSeen(initial);
    if (!focused) setValue(initial);
  }
  const { update, pending } = useUrlParams();
  const set = (next: string, delay = LIVE_DELAY_MS) => {
    setValue(next);
    update({ [param]: next.trim() || null }, delay, targetPath);
  };
  return (
    <label role="search" className={`relative flex items-center ${className}`}>
      <span className="sr-only">{label}</span>
      {pending ? <Loader2 className="absolute left-3 size-4 animate-spin text-brand" aria-hidden /> : <Search className="absolute left-3 size-4 text-ink-2" aria-hidden />}
      <input
        type="search" value={value} maxLength={maxLength} placeholder={placeholder} autoFocus={autoFocus} enterKeyHint="search"
        onChange={(e) => set(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); set(value, 0); } }}
        className={`w-full pl-9 pr-9 [&::-webkit-search-cancel-button]:appearance-none ${inputClassName}`}
      />
      {value && (
        <button type="button" onClick={() => set("", 0)} aria-label="Xóa tìm kiếm" className="absolute right-1.5 grid size-8 place-items-center rounded-full text-ink-2 hover:bg-sunk">
          <X className="size-4" />
        </button>
      )}
    </label>
  );
}
