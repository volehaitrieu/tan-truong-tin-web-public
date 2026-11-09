import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_CLOCK_SKEW_SECONDS = 300;

export type SePayTransaction = {
  id: string | number;
  accountNumber: string;
  transferAmount: number;
  transferType: string;
  code?: string | null;
  content?: string | null;
};

export function parseSePayTransaction(value: unknown): SePayTransaction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const id = typeof o.id === "string" || typeof o.id === "number" ? String(o.id) : "";
  const amount = Number(o.transferAmount);
  const accountNumber = typeof o.accountNumber === "string" ? o.accountNumber : "";
  const transferType = typeof o.transferType === "string" ? o.transferType.toLowerCase() : "";
  if (!id || id.length > 100 || !/^\d+$/.test(accountNumber) || !Number.isSafeInteger(amount) || amount < 0 || !["in", "out"].includes(transferType)) return null;
  return {
    id,
    accountNumber,
    transferAmount: amount,
    transferType,
    code: typeof o.code === "string" ? o.code.slice(0, 200) : null,
    content: typeof o.content === "string" ? o.content.slice(0, 2000) : null,
  };
}

export function verifySePaySignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  nowMs?: number;
}) {
  const timestamp = Number(input.timestamp);
  if (!Number.isSafeInteger(timestamp) || !input.signature || !input.secret) return false;
  if (Math.abs(Math.floor((input.nowMs ?? Date.now()) / 1000) - timestamp) > MAX_CLOCK_SKEW_SECONDS) return false;
  const match = /^sha256=([\da-f]{64})$/i.exec(input.signature);
  if (!match) return false;
  const expected = createHmac("sha256", input.secret).update(`${timestamp}.${input.rawBody}`, "utf8").digest();
  const received = Buffer.from(match[1], "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
