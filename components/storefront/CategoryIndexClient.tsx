"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { CategoryIcon } from "@/components/storefront/CategoryIcon";
import type { CategoryMenuTab } from "@/lib/catalog";

type Props = { menu: CategoryMenuTab[]; onNavigate?: (href: string) => void };

export function CategoryIndexClient({ menu, onNavigate }: Props) {
  const [selectedSlug, setSelectedSlug] = useState(menu[0]?.slug ?? "");
  const [contentVisible, setContentVisible] = useState(true);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = menu.find((category) => category.slug === selectedSlug) ?? menu[0];

  function selectCategory(category: CategoryMenuTab) {
    if (category.slug === selected?.slug) return;
    setContentVisible(false);
    setSelectedSlug(category.slug);
    window.requestAnimationFrame(() => setContentVisible(true));
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = (index + 1) % menu.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = (index - 1 + menu.length) % menu.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = menu.length - 1;
    else return;
    event.preventDefault();
    const category = menu[next];
    selectCategory(category);
    tabRefs.current[next]?.focus();
  }

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!onNavigate) return;
    event.preventDefault();
    onNavigate(href);
  }

  if (!selected) return <p className="px-4 py-8 text-center text-sm text-ink-2">Danh mục đang được cập nhật.</p>;

  return (
    <div className="flex min-h-0 flex-1 gap-2 bg-ground">
      <div role="tablist" aria-label="Danh mục" aria-orientation="vertical" className="w-[100px] shrink-0 self-stretch overflow-y-auto rounded-b-2xl bg-sunk">
        {menu.map((category, index) => {
          const active = category.slug === selected.slug;
          return (
            <button
              key={category.slug}
              ref={(element) => { tabRefs.current[index] = element; }}
              id={`category-tab-${category.slug}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`category-panel-${category.slug}`}
              tabIndex={active ? 0 : -1}
              onClick={() => selectCategory(category)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={`relative flex h-[60px] w-full items-center border-t border-line px-2 py-3 pl-4 text-left text-[12px] leading-[18px] transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-brand first:border-t-0 ${active ? "bg-surface font-semibold text-ink" : "text-ink motion-safe:hover:bg-surface/70"}`}
            >
              {active ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[2.4px] bg-brand" /> : null}
              <span className="line-clamp-3 break-words">{category.name}</span>
            </button>
          );
        })}
      </div>

      <section
        key={selected.slug}
        id={`category-panel-${selected.slug}`}
        role="tabpanel"
        aria-labelledby={`category-tab-${selected.slug}`}
        tabIndex={0}
        className={`min-w-0 flex-1 self-stretch overflow-y-auto rounded-tl-lg bg-surface p-2 transition-[opacity,transform] duration-[180ms] ease-out motion-reduce:transform-none motion-reduce:transition-none ${contentVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}
      >
        {selected.children.length ? (
          <section className="mb-4 last:mb-0">
            <h2 className="mb-2 mt-0.5 text-[12px] font-bold uppercase leading-[18px] text-ink">{selected.name}</h2>
            <div className="grid grid-cols-3">
              {selected.children.map((child) => {
                const href = `/danh-muc/${child.slug}`;
                return (
                  <Link
                    key={child.slug}
                    href={href}
                    onClick={(event) => navigate(event, href)}
                    className="group flex h-[95px] min-w-0 flex-col items-center rounded-lg px-0.5 py-0.5 text-center active:scale-[0.96] motion-safe:transition-transform motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                  >
                    <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-tint text-ink-2">
                      {child.image ? <Image src={child.image} alt="" fill sizes="48px" className="object-contain p-1" /> : <CategoryIcon icon={selected.icon} className="size-7" />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 min-h-9 w-full break-words text-[12px] leading-[18px] text-ink group-hover:text-ink">{child.name}</span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : <p className="py-6 text-center text-xs text-ink-2">Danh mục đang được cập nhật.</p>}
      </section>
    </div>
  );
}
