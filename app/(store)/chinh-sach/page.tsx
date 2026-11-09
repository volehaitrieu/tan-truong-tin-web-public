import type { Metadata } from "next";
import { MapPin, Phone } from "lucide-react";
import { POLICIES } from "@/components/storefront/StoreShell";
import { SHOP } from "@/lib/shop";
import { FLAT_SHIPPING_POLICY } from "@/lib/shipping";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Chính sách & giới thiệu" };

// Nội dung tạm — chủ shop sẽ chốt (xem docs/CHU_SHOP_CAN_CHUAN_BI.md)
const BODY: Record<string, { text: string; pending?: boolean }> = {
  "doi-tra": { text: "Chính sách đổi trả đang chờ chủ shop chốt (thời hạn, điều kiện, hàng không đổi). Trong lúc chờ, vui lòng gọi shop để được hỗ trợ.", pending: true },
  "bao-hanh": { text: "Sản phẩm có bảo hành được bảo hành theo chính sách của hãng. Mang sản phẩm kèm hóa đơn đến cửa hàng, shop hỗ trợ gửi bảo hành." },
  "van-chuyen": { text: "Nhận tại cửa hàng: miễn phí. Giao nội thành Nha Trang: phí theo khu vực, shop báo khi gọi xác nhận đơn. Gửi đi tỉnh qua SPX, GHTK: phí báo sau.", pending: true },
  "thanh-toan": { text: "Trả tiền mặt khi nhận hàng (COD) hoặc tại quầy." },
  "bao-mat": { text: "Shop chỉ dùng họ tên, số điện thoại và địa chỉ để xác nhận và giao đơn hàng; không chia sẻ cho bên khác ngoài đơn vị vận chuyển." },
  "gioi-thieu": { text: `Tân Trường Tín — ${SHOP.tagline.toLowerCase()} tại Nha Trang. “${SHOP.slogan}”` },
};

export const revalidate = 60;

export default async function PolicyPage() {
  const st = await getSettings();
  const body = (id: string) =>
    id === "doi-tra" && st.return_policy ? { text: st.return_policy }
    : id === "thanh-toan" && st.bank ? { text: "Trả tiền mặt khi nhận hàng (COD) hoặc tại quầy.\nChuyển khoản bằng mã QR: chọn “Chuyển khoản” ở bước thanh toán, mã QR hiện sau khi đặt hàng. Shop xác nhận đơn khi nhận được tiền." }
    : id === "van-chuyen" && st.shop.shipping_policy === FLAT_SHIPPING_POLICY ? { text: "Lấy tại cửa hàng: miễn phí. Giao hàng tận nơi: 15.000₫; miễn phí với đơn hàng từ 500.000₫." }
    : id === "van-chuyen" && st.inner_ship_fee !== null ? { text: `Nhận tại cửa hàng: miễn phí. Giao nội thành Nha Trang: ${new Intl.NumberFormat("vi-VN").format(st.inner_ship_fee)}₫${st.free_ship_threshold ? `, miễn phí cho đơn từ ${new Intl.NumberFormat("vi-VN").format(st.free_ship_threshold)}₫` : ""}. Gửi đi tỉnh qua SPX, GHTK: phí báo sau.` }
    : BODY[id];
  return (
    <article className="mx-auto max-w-[760px]">
      {/* Đã áp bảng màu mới (cờ data-theme-v2, xem globals.css) */}
      <div hidden data-theme-v2 />
      <h1 className="text-[28px] font-extrabold sm:text-[34px]">Chính sách & giới thiệu</h1>
      <nav aria-label="Mục lục" className="mt-4 flex flex-wrap gap-2">
        {POLICIES.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="flex min-h-10 items-center rounded-full bg-white px-4 text-sm font-medium hover:bg-brand-tint hover:text-brand">{label}</a>
        ))}
      </nav>
      <div className="mt-6 rounded-md bg-white px-5 sm:px-8">
        {POLICIES.map(([id, label]) => (
          <section key={id} id={id} className="scroll-mt-32 border-b border-line py-6 last:border-0">
            <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold">
              {label}
              {body(id).pending && <span className="rounded-full border border-line bg-sunk px-2 py-0.5 text-xs font-medium text-ink-2">Chờ chủ shop</span>}
            </h2>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-7 text-ink-2">{body(id).text}</p>
            {id === "gioi-thieu" && (
              <div className="mt-4 space-y-1.5 text-[15px]">
                <p className="flex gap-2"><MapPin className="mt-1 size-4 shrink-0 text-brand" aria-hidden />{SHOP.address} · mở cửa {SHOP.hours} hằng ngày</p>
                <p className="flex gap-2"><Phone className="mt-1 size-4 shrink-0 text-brand" aria-hidden /><a href="tel:0948732064" className="font-semibold text-brand">{SHOP.phone}</a> · <a href="tel:0793783379" className="text-brand">{SHOP.phone2}</a></p>
              </div>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}
