"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

type AnimatedDisclosureProps = {
  title: string;
  meta?: string;
  className: string;
  children: ReactNode;
};

export function AnimatedDisclosure({ title, meta, className, children }: AnimatedDisclosureProps) {
  const [open, setOpen] = useState(true);
  const panelId = useId();

  return (
    <section className={className}>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-16 w-full items-center gap-3 rounded-3xl px-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <span className="text-lg font-bold">{title}</span>
          {meta && <span className="num text-sm text-ink-2">{meta}</span>}
          <ChevronDown className={`ml-auto size-5 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </h2>
      <div
        id={panelId}
        aria-hidden={!open}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity,transform] duration-200 ease-out motion-reduce:transition-none ${open ? "grid-rows-[1fr] translate-y-0 opacity-100" : "grid-rows-[0fr] -translate-y-1 opacity-0"}`}
      >
        <div className="min-h-0 overflow-hidden">{children}</div>
      </div>
    </section>
  );
}
