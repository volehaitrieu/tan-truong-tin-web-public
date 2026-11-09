// Chỉ dự tính để hiển thị. Phí ghi đơn được place_order quyết định ở DB.
export const FLAT_SHIPPING_POLICY = "flat_15000_v1";
export const FLAT_SHIPPING_FEE = 15_000;
export type DeliveryMethod = "pickup" | "inner" | "province";
export function shippingFee(method: DeliveryMethod, subtotal: number, policy: string | undefined, innerFee: number | null, freeFrom: number | null): number | null {
  if (method === "pickup") return 0;
  if (policy === FLAT_SHIPPING_POLICY) return subtotal >= 500_000 ? 0 : FLAT_SHIPPING_FEE;
  if (method !== "inner" || innerFee === null) return null;
  return freeFrom !== null && subtotal >= freeFrom ? 0 : innerFee;
}
// Biên nhận cũ không có phí: không tự áp phí mới cho đơn đã đặt.
export function receiptAmounts(subtotal: number, method: DeliveryMethod, fee?: number | null) {
  const shipping = fee === undefined ? (method === "pickup" ? 0 : null) : fee;
  return { subtotal, shippingFee: shipping, total: subtotal + (shipping ?? 0), shippingPending: shipping === null };
}
