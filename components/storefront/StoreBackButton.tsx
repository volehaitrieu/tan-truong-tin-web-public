"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const HISTORY_KEY = "ttt-store-route-history-v1";
const MAX_HISTORY = 30;

function readHistory(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === "string" && entry.startsWith("/")).slice(-MAX_HISTORY)
      : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: string[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(-MAX_HISTORY)));
  } catch {
    // Navigation remains available through the home-page fallback when storage is blocked.
  }
}

export function StoreBackButton() {
  const pathname = usePathname();
  const router = useRouter();
  const currentPath = pathname || "/";
  const lastPath = useRef<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    let history = readHistory();

    if (lastPath.current === null) {
      let sameOriginReferrer = false;
      try {
        sameOriginReferrer = !!document.referrer && new URL(document.referrer).origin === window.location.origin;
      } catch {
        sameOriginReferrer = false;
      }
      if (!sameOriginReferrer) history = [];
      if (history.at(-1) !== currentPath) history.push(currentPath);
    } else if (lastPath.current !== currentPath && history.at(-1) !== currentPath) {
      history.push(currentPath);
    }

    history = history.slice(-MAX_HISTORY);
    writeHistory(history);
    lastPath.current = currentPath;
    setCanGoBack(history.length > 1);
  }, [currentPath]);

  useEffect(() => {
    function handlePopState() {
      const targetPath = window.location.pathname || "/";
      const history = readHistory();
      const targetIndex = history.lastIndexOf(targetPath);
      const nextHistory = targetIndex >= 0 ? history.slice(0, targetIndex + 1) : [...history, targetPath].slice(-MAX_HISTORY);
      writeHistory(nextHistory);
      lastPath.current = targetPath;
      setCanGoBack(nextHistory.length > 1);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (!pathname || currentPath === "/") return null;

  function goBack() {
    const history = readHistory();
    if (canGoBack && history.length > 1 && history.at(-1) === currentPath) {
      router.back();
      return;
    }
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Quay lại trang trước"
      className="mb-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2.5 text-sm font-medium text-brand transition-colors hover:bg-brand-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
    >
      <ArrowLeft className="size-5" aria-hidden="true" />
      Quay lại
    </button>
  );
}
