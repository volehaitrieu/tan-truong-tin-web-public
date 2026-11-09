import "server-only";
import { orderMessage, quoteMessage, type OrderNotice } from "@/lib/notify/messages";

// Báo đơn mới / yêu cầu báo giá qua Telegram. Token và mã nhóm chỉ lấy từ biến môi trường
// (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, tùy chọn SITE_URL) — không lưu trong mã, không ghi vào nhật ký, không vào cơ sở dữ liệu.
// Gửi lỗi KHÔNG làm hỏng đơn hàng: mọi hàm ở đây không bao giờ ném lỗi.

const TIMEOUT_MS = 4000;
const MAX = 3900; // Telegram giới hạn 4096 ký tự

export const telegramConfigured = () => !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID;

export async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return { ok: false, error: "Chưa cài mã bot Telegram trên máy chủ." };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, MAX), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok) return { ok: true };
    // Không in nội dung phản hồi (có thể chứa mã nhóm); chỉ phân loại lỗi để báo cho chủ shop.
    if (res.status === 401 || res.status === 404) return { ok: false, error: "Mã bot không đúng hoặc bot đã bị xóa." };
    if (res.status === 400 || res.status === 403) return { ok: false, error: "Bot chưa vào nhóm, hoặc mã nhóm không đúng." };
    if (res.status === 429) return { ok: false, error: "Telegram đang giới hạn tốc độ, thử lại sau ít phút." };
    return { ok: false, error: "Telegram báo lỗi, thử lại sau." };
  } catch {
    return { ok: false, error: "Không kết nối được Telegram (mạng chậm hoặc bị chặn)." };
  }
}

export type { OrderNotice };
export async function notifyOrder(o: OrderNotice) { return sendTelegram(orderMessage(o)); }
export async function notifyQuote(items: string, phone: string) { return sendTelegram(quoteMessage(items, phone)); }
