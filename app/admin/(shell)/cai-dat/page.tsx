import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { telegramConfigured } from "@/lib/notify/telegram";
import { SettingsForm } from "./SettingsForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  await requireStaff("settings");
  const s = await getSettings();
  const db = await createClient();
  const { data: sepayReady, error: sepayError } = await db.rpc("sepay_webhook_is_configured");
  return (
    <>
      <PageHeader title="Cài đặt" sub="Thay đổi được ghi vào Nhật ký thao tác." />
      <SettingsForm s={s} telegramReady={telegramConfigured()} sepayReady={sepayReady === true} sepayAvailable={!sepayError} />
    </>
  );
}
