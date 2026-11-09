import { createPublicClient } from "@/lib/supabase/public";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 16_384) return Response.json({ success: false }, { status: 413 });

  const rawBody = await request.text();
  if (!rawBody || Buffer.byteLength(rawBody, "utf8") > 16_384) return Response.json({ success: false }, { status: 413 });
  const timestamp = request.headers.get("x-sepay-timestamp");
  const signature = request.headers.get("x-sepay-signature");
  if (!timestamp || !signature) return Response.json({ success: false }, { status: 401 });

  const { error } = await createPublicClient().rpc("sepay_receive", {
    p_raw_body: rawBody,
    p_timestamp: timestamp,
    p_signature: signature,
  });
  if (error) {
    const status = /signature|timestamp|secret/i.test(error.message) ? 401 : 500;
    return Response.json({ success: false }, { status });
  }
  // Một số cấu hình webhook SePay cũ chỉ chấp nhận 201.
  return Response.json({ success: true }, { status: 201 });
}
