"use client";
import { useActionState, useState, startTransition } from "react";
import { saveSettings, sendTestTelegram, type SettingsState } from "./actions";
import type { ShopSettings } from "@/lib/settings";
import { FLAT_SHIPPING_POLICY } from "@/lib/shipping";
import { BANKS } from "@/lib/vietqr";

const input = "mt-1 h-11 w-full rounded border border-line bg-white px-3 text-sm";
const section = "rounded-lg border border-line bg-white p-4 sm:p-5";

export function SettingsForm({ s, telegramReady, sepayReady, sepayAvailable }: { s: ShopSettings; telegramReady: boolean; sepayReady: boolean; sepayAvailable: boolean }) {
  const [test, setTest] = useState<{ busy?: boolean; ok?: boolean; error?: string }>({});
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  return (
    <form onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; const fd = new FormData(form); const secret = form.elements.namedItem("sepay_webhook_secret"); if (secret instanceof HTMLInputElement) secret.value = ""; startTransition(() => action(fd)); }} className="space-y-4">
      <section className={section}>
        <h2 className="mb-3 font-semibold">Thông tin cửa hàng</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Tên cửa hàng<input name="name" defaultValue={s.shop.name} maxLength={80} className={input} /></label>
          <label className="text-sm">Ngành hàng<input name="tagline" defaultValue={s.shop.tagline} maxLength={120} className={input} /></label>
          <label className="text-sm sm:col-span-2">Địa chỉ<input name="address" defaultValue={s.shop.address} maxLength={200} className={input} /></label>
          <label className="text-sm">SĐT/Zalo chính<input name="phone" defaultValue={s.shop.phone} maxLength={20} inputMode="tel" className={input} /></label>
          <label className="text-sm">SĐT phụ<input name="phone2" defaultValue={s.shop.phone2} maxLength={20} inputMode="tel" className={input} /></label>
          <label className="text-sm">Giờ mở cửa<input name="hours" defaultValue={s.shop.hours} maxLength={40} className={input} /></label>
        </div>
      </section>

      <section className={section}>
        <h2 className="mb-1 font-semibold">Giao hàng & phí ship</h2>
        {s.shop.shipping_policy === FLAT_SHIPPING_POLICY ? <p className="text-sm">Đang áp dụng phí giao hàng 15.000₫; miễn phí từ đơn 500.000₫. Lấy tại cửa hàng miễn phí.</p> : <>
        <p className="mb-3 text-[13px] text-ink-2">Lấy tại cửa hàng miễn phí. Giao hàng tận nơi: theo mức phí và ngưỡng miễn phí đang cấu hình.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Phí ship nội thành Nha Trang (đồng)
            <input name="inner_ship_fee" defaultValue={s.inner_ship_fee ?? ""} inputMode="numeric" maxLength={9} placeholder="Ví dụ 20000" className={`${input} num`} />
          </label>
          <label className="text-sm">Miễn phí ship nội thành cho đơn từ (đồng)
            <input name="free_ship_threshold" defaultValue={s.free_ship_threshold ?? ""} inputMode="numeric" maxLength={11} placeholder="Để trống = không miễn phí" className={`${input} num`} />
          </label>
        </div>
        </>}
      </section>

      <section className={section}>
        <h2 className="mb-1 font-semibold">Thanh toán</h2>
        <p className="text-sm">COD — tiền mặt khi nhận hàng: <b className="text-ok">Đang bật</b></p>
        <p className="mt-1 text-sm">Chuyển khoản VietQR: {s.bank ? <b className="text-ok">Đang bật</b> : <span className="rounded-full bg-gold-tint px-2 py-0.5 text-xs font-medium text-gold-ink">Chưa cài</span>}</p>
        <p className="mb-3 mt-1 text-[13px] text-ink-2">Điền tài khoản nhận tiền của shop để khách chọn “Chuyển khoản” và thấy mã QR đúng số tiền. Để trống cả ba ô = tắt chuyển khoản. Sau khi lưu, nên tự đặt một đơn thử và quét mã bằng app ngân hàng để chắc chắn.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Ngân hàng
            <select name="bank_bin" defaultValue={s.bank?.bin ?? ""} className={input}>
              <option value="">— Chưa chọn —</option>
              {BANKS.map((b) => <option key={b.bin} value={b.bin}>{b.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Số tài khoản
            <input name="bank_account_no" defaultValue={s.bank?.account_no ?? ""} inputMode="numeric" autoComplete="off" maxLength={24} className={`${input} num`} />
          </label>
          <label className="text-sm sm:col-span-2">Tên chủ tài khoản
            <input name="bank_account_name" defaultValue={s.bank?.account_name ?? ""} autoComplete="off" maxLength={60} className={input} placeholder="Viết hoa không dấu, giống tên trên thẻ" />
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-line bg-ground p-3">
          <h3 className="font-semibold">Tự xác nhận chuyển khoản SePay</h3>
          <p className="mt-1 text-[13px] text-ink-2">Trạng thái webhook: <b className={sepayReady ? "text-ok" : "text-gold-ink"}>{!sepayAvailable ? "Chưa cài phần nhận webhook ở cơ sở dữ liệu" : sepayReady ? "Đã có mã bảo mật" : "Chưa kết nối"}</b></p>
          <p className="mt-1 text-[13px] text-ink-2">Sau khi SQL webhook được duyệt và website được cập nhật lên tên miền chính, tạo webhook HMAC-SHA256 trong SePay rồi dán mã bí mật vào đây. Mã được lưu riêng trong vùng bảo mật của cơ sở dữ liệu, không hiển thị lại sau khi lưu. Để trống khi lưu các cài đặt khác thì giữ nguyên mã hiện tại.</p>
          <label className="mt-3 block text-sm">Mã bí mật webhook SePay
            <input name="sepay_webhook_secret" type="password" autoComplete="new-password" minLength={24} maxLength={500} disabled={!sepayAvailable} className={`${input} disabled:bg-ground disabled:text-ink-2`} placeholder={sepayReady ? "Đã lưu — chỉ nhập nếu cần thay mã" : "Dán mã SePay tạo khi cấu hình webhook"} />
          </label>
          <p className="mt-2 break-all text-xs text-ink-2">Địa chỉ webhook cần nhập tại SePay: https://tantruongtin.com/api/sepay/webhook</p>
        </div>
      </section>

      <section className={section}>
        <h2 className="mb-1 font-semibold">Thông báo đơn mới qua Telegram</h2>
        {telegramReady ? (
          <>
            <p className="text-sm">Bot báo đơn: <b className="text-ok">Đã cài</b>. Có đơn mới hoặc yêu cầu báo giá, bot gửi tin vào nhóm Telegram của shop.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" disabled={test.busy} onClick={async () => { setTest({ busy: true }); setTest({ ...(await sendTestTelegram()) }); }} className="h-11 rounded border border-line px-4 text-sm font-semibold hover:bg-brand-tint disabled:opacity-60">{test.busy ? "Đang gửi…" : "Gửi tin thử"}</button>
              {test.ok && <span role="status" className="text-sm text-ok">Đã gửi. Kiểm tra nhóm Telegram.</span>}
              {test.error && <span role="alert" className="text-sm text-danger">{test.error}</span>}
            </div>
          </>
        ) : (
          <p className="text-sm"><span className="rounded-full bg-gold-tint px-2 py-0.5 text-xs font-medium text-gold-ink">Chưa cài</span> — cần tạo bot Telegram rồi dán mã vào cấu hình máy chủ (xem docs/website-v2/viec/bao-don-telegram/HUONG_DAN_TAO_BOT.md).</p>
        )}
      </section>

      <section className={section}>
        <h2 className="mb-1 font-semibold">Chính sách đổi trả & bảo hành</h2>
        <p className="mb-2 text-[13px] text-ink-2">Nội dung này hiện ở trang Chính sách. Để trống = hiện “Chờ chủ shop”.</p>
        <textarea name="return_policy" defaultValue={s.return_policy ?? ""} rows={5} maxLength={5000} className="w-full rounded border border-line p-3 text-sm" placeholder="Ví dụ: Đổi trả trong 7 ngày nếu sản phẩm còn nguyên tem, hộp và hóa đơn…" />
      </section>

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] flex items-center gap-3 rounded-lg border border-line bg-white p-3 md:bottom-2">
        <button disabled={pending} className="h-11 rounded bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60">{pending ? "Đang lưu…" : "Lưu thay đổi"}</button>
        {state.ok && <span role="status" className="text-sm text-ok">Đã lưu.</span>}
        {state.error && <span role="alert" className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
