"use client";
import { useEffect, useRef, useState } from "react";
import { Bold, Heading, Italic, Link2, List, ListOrdered, Palette, Pilcrow, RemoveFormatting, Underline } from "lucide-react";
import { sanitizeHtml } from "@/lib/rich-text";

// Ô soạn mô tả kiểu Word (gọn): tiêu đề, đậm/nghiêng/gạch chân, danh sách, liên kết, màu chữ.
// Dán từ web/Word → tự làm sạch, chỉ giữ định dạng cho phép. Server làm sạch lại khi lưu.
const COLORS = ["#111827", "#dc2626", "#ea580c", "#ca8a04", "#15803d", "#1d4ed8", "#7c3aed"];

export function RichTextEditor({ value, onChange, label }: { value: string; onChange: (html: string) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState(false);

  // Nạp nội dung ban đầu một lần (không ghi đè khi đang gõ)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = () => onChange(ref.current?.innerHTML ?? "");
  const cmd = (name: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, arg);
    emit();
  };
  const btn = "grid size-9 place-items-center rounded text-ink-2 hover:bg-brand-tint hover:text-brand";

  return (
    <div className="rounded border border-line focus-within:border-brand">
      <div className="relative flex flex-wrap gap-0.5 border-b border-line bg-ground p-1" role="toolbar" aria-label="Định dạng mô tả">
        <button type="button" title="Tiêu đề" aria-label="Tiêu đề" className={btn} onClick={() => cmd("formatBlock", "<h3>")}><Heading className="size-4" /></button>
        <button type="button" title="Đoạn thường" aria-label="Đoạn thường" className={btn} onClick={() => cmd("formatBlock", "<p>")}><Pilcrow className="size-4" /></button>
        <span className="mx-1 w-px bg-line" />
        <button type="button" title="In đậm" aria-label="In đậm" className={btn} onClick={() => cmd("bold")}><Bold className="size-4" /></button>
        <button type="button" title="In nghiêng" aria-label="In nghiêng" className={btn} onClick={() => cmd("italic")}><Italic className="size-4" /></button>
        <button type="button" title="Gạch chân" aria-label="Gạch chân" className={btn} onClick={() => cmd("underline")}><Underline className="size-4" /></button>
        <span className="mx-1 w-px bg-line" />
        <button type="button" title="Gạch đầu dòng" aria-label="Gạch đầu dòng" className={btn} onClick={() => cmd("insertUnorderedList")}><List className="size-4" /></button>
        <button type="button" title="Đánh số" aria-label="Đánh số" className={btn} onClick={() => cmd("insertOrderedList")}><ListOrdered className="size-4" /></button>
        <span className="mx-1 w-px bg-line" />
        <button type="button" title="Gắn liên kết" aria-label="Gắn liên kết" className={btn} onClick={() => {
          const url = window.prompt("Dán đường link (bắt đầu bằng https://):", "https://");
          if (url && /^https?:\/\/\S+$/i.test(url.trim())) cmd("createLink", url.trim());
        }}><Link2 className="size-4" /></button>
        <button type="button" title="Màu chữ" aria-label="Màu chữ" aria-expanded={palette} className={btn} onClick={() => setPalette((v) => !v)}><Palette className="size-4" /></button>
        <button type="button" title="Xóa định dạng" aria-label="Xóa định dạng" className={btn} onClick={() => cmd("removeFormat")}><RemoveFormatting className="size-4" /></button>
        {palette && (
          <div className="absolute left-1 top-full z-20 mt-1 flex gap-1 rounded border border-line bg-white p-2 shadow-lg">
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Màu ${c}`} className="size-7 rounded-full border border-line" style={{ background: c }}
                onMouseDown={(e) => e.preventDefault()} onClick={() => { cmd("foreColor", c); setPalette(false); }} />
            ))}
          </div>
        )}
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          const text = e.clipboardData.getData("text/plain");
          if (html) document.execCommand("insertHTML", false, sanitizeHtml(html));
          else document.execCommand("insertText", false, text);
          emit();
        }}
        className="rich-text min-h-40 px-3 py-2 text-sm outline-none"
      />
    </div>
  );
}
