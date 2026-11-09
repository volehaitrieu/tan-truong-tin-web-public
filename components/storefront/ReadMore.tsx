"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

function ExpandButton({ id, expanded, onClick, label = "Xem thêm" }: { id: string; expanded: boolean; onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      aria-controls={id}
      aria-expanded={expanded}
      onClick={onClick}
      className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-semibold text-brand hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {expanded ? "Thu gọn" : label}
      <ChevronDown className={`size-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
    </button>
  );
}

export function ReadMoreLines({ children }: { children: ReactNode }) {
  const id = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Render the control in server HTML; measure after hydration to hide it for short content.
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const measure = () => {
      if (!expanded) setHasMore(node.scrollHeight > node.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children, expanded]);

  return (
    <div>
      <div ref={contentRef} id={id} className={expanded ? "" : "line-clamp-6"}>
        {children}
      </div>
      {hasMore && <ExpandButton id={id} expanded={expanded} onClick={() => setExpanded((value) => !value)} />}
    </div>
  );
}

export function ReadMoreSpecs({ rows, notes = [] }: { rows: [string, string][]; notes?: string[] }) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, 6);

  return (
    <>
      <dl id={id} className="divide-y divide-brand-line text-sm">
        {visibleRows.map(([key, value], index) => (
          <div key={`${key}-${index}`} className="flex justify-between gap-4 py-2.5">
            <dt className="text-ink-2">{key}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {expanded && notes.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{notes.map((note) => <li key={note}>{note}</li>)}</ul>}
      {(rows.length > 6 || notes.length > 0) && <ExpandButton id={id} expanded={expanded} onClick={() => setExpanded((value) => !value)} label={rows.length > 6 ? `Xem thêm ${rows.length - 6} mục` : "Xem thêm"} />}
    </>
  );
}
