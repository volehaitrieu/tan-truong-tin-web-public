"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "ttt-favorite-products";
const EVENT = "ttt-favorites-change";

function readFavorites() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function FavoriteButton({ sku, name }: { sku: string; name: string }) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const sync = () => setFavorite(readFavorites().includes(sku));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [sku]);

  const toggle = () => {
    const current = readFavorites();
    const next = current.includes(sku) ? current.filter((item) => item !== sku) : [...current, sku];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
      setFavorite(next.includes(sku));
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Keep the control usable in this page even when browser storage is unavailable.
      setFavorite((value) => !value);
    }
  };

  return (
    <button type="button" onClick={toggle} aria-label={favorite ? `Bỏ ${name} khỏi yêu thích` : `Thêm ${name} vào yêu thích`} aria-pressed={favorite} className="group absolute right-0.5 top-0.5 z-10 grid size-10 place-items-center rounded-full text-ink transition-colors hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-brand">
      {/* Vòng trắng nhỏ 32px; vùng bấm vẫn 40px */}
      <span className="grid size-8 place-items-center rounded-full bg-white/95 shadow-sm"><Heart className={`size-4 ${favorite ? "fill-danger text-danger" : ""}`} aria-hidden /></span>
    </button>
  );
}
