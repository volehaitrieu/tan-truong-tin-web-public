"use client";

export function PrintButton({ label = "In phiếu" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="h-11 rounded bg-brand px-4 font-semibold text-white">
      {label}
    </button>
  );
}
