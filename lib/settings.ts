import "server-only";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { parseBank, type ShopBank } from "@/lib/vietqr";

// Cài đặt cửa hàng (bảng settings, 1 dòng). Ai cũng đọc được (RLS); chỉ người có quyền "settings" sửa.
export type ShopSettings = {
  shop: { name?: string; tagline?: string; address?: string; phone?: string; phone2?: string; hours?: string; shipping_policy?: string };
  inner_ship_fee: number | null; // null = "báo sau"
  free_ship_threshold: number | null;
  return_policy: string | null;
  bank: ShopBank | null; // tài khoản nhận chuyển khoản (VietQR); null = chưa cài
};

export const getSettings = cache(async (): Promise<ShopSettings> => {
  const { data } = await createPublicClient().from("settings").select("shop, inner_ship_fee, free_ship_threshold, return_policy, bank").eq("id", 1).maybeSingle();
  if (!data) return { shop: {}, inner_ship_fee: null, free_ship_threshold: null, return_policy: null, bank: null };
  return { ...(data as Omit<ShopSettings, "bank">), bank: parseBank((data as { bank?: unknown }).bank) };
});
