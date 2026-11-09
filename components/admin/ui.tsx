import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, Lock } from "lucide-react";

export function PageHeader({
  title,
  crumbs,
  actions,
  sub,
}: {
  title: string;
  crumbs?: { label: string; href?: string }[];
  actions?: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Đường dẫn" className="mb-1 flex flex-wrap items-center gap-1 text-[13px] text-ink-2">
            {crumbs.map((c, i) => (
              <span key={c.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5" aria-hidden />}
                {c.href ? (
                  <Link href={c.href} className="hover:text-brand">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-xl font-bold leading-tight md:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-2">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// pad: thêm lề trong cho nội dung là chữ/ô nhập (bảng và danh sách tự có lề nên không cần)
export function Card({ title, action, children, className = "", pad = false }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`overflow-hidden rounded-xl border border-line bg-surface transition-colors duration-200 hover:border-[#d3e4d8] ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </header>
      )}
      {pad ? <div className="p-4">{children}</div> : children}
    </section>
  );
}

export type Tone = "ok" | "warn" | "info" | "danger" | "neutral" | "gold";

const TONES: Record<Tone, string> = {
  ok: "bg-[#ecfdf5] text-brand",
  warn: "bg-[#fef3c7] text-[#b45309]",
  info: "bg-[#eff6ff] text-[#1d4ed8]",
  danger: "bg-[#fef2f2] text-danger",
  neutral: "bg-sunk text-ink-2",
  gold: "bg-gold text-gold-ink",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function OwnerOnly({ label = "Chỉ chủ shop" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-2">
      <Lock className="size-3.5" aria-hidden /> {label}
    </span>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" }) {
  const cls =
    variant === "primary"
      ? "bg-brand text-white hover:bg-brand-deep"
      : "border border-line bg-surface text-ink hover:border-brand hover:text-brand";
  return (
    <Link href={href} className={`inline-flex h-10 items-center gap-1.5 rounded-[var(--radius-ctl)] px-3.5 text-sm font-medium transition-colors ${cls}`}>
      {children}
    </Link>
  );
}
