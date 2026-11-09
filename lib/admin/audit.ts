import "server-only";
import type { createClient } from "@/lib/supabase/server";

// Việc không đi qua bảng dữ liệu nên trigger không tự ghi được → máy chủ web ghi qua hàm log_event trong DB.
// Danh sách phải khớp hàm public.log_event (DB kiểm quyền từng việc; người ghi luôn là người đang đăng nhập).
export type LogAction = "login" | "export:products" | "import:products" | "insert:staff";

// Trả false nếu không ghi được; nơi gọi tự quyết định có chặn thao tác hay không.
export async function logEvent(db: Awaited<ReturnType<typeof createClient>>, action: LogAction, target: string | null, details?: Record<string, unknown>) {
  const { error } = await db.rpc("log_event", { p_action: action, p_target: target, p_details: details ?? null });
  return !error;
}
