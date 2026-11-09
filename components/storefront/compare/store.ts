"use client";

import { useSyncExternalStore } from "react";
import { addSku, normalizeSkus, parseStored, removeSku, serializeStored, STORAGE_KEY, type AddResult } from "@/lib/compare";

// Một kho dùng chung cho cả trang: chỉ đọc sessionStorage MỘT lần, các nút đăng ký nhận thay đổi từ đây
// (không thêm bộ lắng nghe window cho từng thẻ). Chỉ lưu mã hàng; giá/tồn kho/thông số luôn lấy từ máy chủ.
let skus: string[] = [];
let loaded = false;
let notice: { id: number; text: string } | null = null;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    skus = parseStored(window.sessionStorage.getItem(STORAGE_KEY));
  } catch {
    // Bộ nhớ bị chặn (vd. Safari riêng tư): dùng bộ nhớ trong trang, tải lại có thể mất lựa chọn.
  }
}

function commit(next: string[]) {
  skus = next;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, serializeStored(next));
  } catch {}
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** null = chưa khởi tạo xong ở trình duyệt (lúc render trên máy chủ / trước khi gắn giao diện). */
function snapshot() {
  load();
  return skus;
}

export function useCompareSkus(): string[] | null {
  return useSyncExternalStore<string[] | null>(subscribe, snapshot, () => null);
}

export function useCompareNotice() {
  return useSyncExternalStore(subscribe, () => notice, () => null);
}

export function notify(text: string) {
  notice = { id: (notice?.id ?? 0) + 1, text };
  listeners.forEach((fn) => fn());
}

export function addCompare(sku: string): AddResult {
  load();
  const result = addSku(skus, sku);
  if (result.status === "added") commit(result.list);
  return result;
}

export function removeCompare(sku: string) {
  load();
  commit(removeSku(skus, sku));
}

export function replaceCompare(next: string[]) {
  load();
  const list = normalizeSkus(next);
  if (list.length === skus.length && list.every((sku, i) => sku === skus[i])) return;
  commit(list);
}

export function clearCompare() {
  load();
  commit([]);
}
