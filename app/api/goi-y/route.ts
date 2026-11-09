import { buildSuggest } from "@/lib/suggest";

// Gợi ý tìm kiếm cho ô tìm kiếm của khách. Dùng GET (không dùng server action) để trình duyệt gọi song song,
// hủy được lần gõ cũ và nhớ tạm kết quả: server action xếp hàng từng cái một nên gõ nhanh bị đơ.
// Chỉ đọc dữ liệu công khai (giống trang tìm kiếm). Nhớ tạm ngắn để giá không cũ quá lâu.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return Response.json(await buildSuggest(q), {
    headers: { "Cache-Control": "public, max-age=20, s-maxage=30, stale-while-revalidate=60" },
  });
}
