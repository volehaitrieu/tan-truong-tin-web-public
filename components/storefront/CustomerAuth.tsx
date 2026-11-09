"use client";

import Link from "next/link";
import Image from "next/image";
import { Fragment, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Eye, EyeOff, Lock, Mail, Phone, Search, UserRound } from "lucide-react";
import { TurnstileWidget, useCaptcha } from "@/components/TurnstileWidget";
import { bounceField, rippleAt, shakeField } from "@/lib/ui-effects";
import { SHOP } from "@/lib/shop";
import { passwordProblem } from "@/lib/password-rule";

// Đăng nhập / Đăng ký khách hàng (giao diện v2, trang đứng riêng). CHƯA nối máy chủ: bấm gửi chỉ kiểm tra ô nhập rồi báo rõ là tài khoản đang chuẩn bị.
// Khách vẫn đặt hàng và tra cứu đơn không cần tài khoản. Không nhắc điểm, mã giảm giá, ưu đãi, thông báo (chủ shop chưa chốt).
// Kiểu theo bản mẫu chủ shop gửi 3/11/2026: ảnh mặt tiền phía trên mép dưới rõ nét, tấm nền kem bo góc lớn trượt lên đè ảnh, tiêu đề căn trái,
// tiến trình ngang, ô nhập xám đặc có viền mảnh (viền để ô đủ rõ so với nền), nút đen mực, "Tôi đã có tài khoản" là chữ gạch chân.
// Nút Google chỉ hiện khi đặt NEXT_PUBLIC_GOOGLE_LOGIN=1 (xem thử nội bộ); trên web thật phải ẩn cho tới khi nối xong.
const GOOGLE_READY = process.env.NEXT_PUBLIC_GOOGLE_LOGIN === "1";
const GREEN = "#3E9B6A";

type Key = "name" | "phone" | "email" | "password" | "password2" | "need";
type Vals = Partial<Record<Key, string>>;
const STEPS: { key: Key; optional?: boolean }[] = [
  { key: "name" }, { key: "phone" }, { key: "email", optional: true }, { key: "password" }, { key: "password2" }, { key: "need", optional: true },
];

// Trả về lời báo lỗi tiếng Việt, hoặc "" nếu ô hợp lệ (ô tùy chọn để trống là hợp lệ)
function check(key: Key, vals: Vals, login = false): string {
  const v = (vals[key] ?? "").trim();
  switch (key) {
    case "name": return v.length >= 2 ? "" : "Bạn nhập họ tên giúp shop nhé.";
    case "phone": return /^0\d{9}$/.test(v.replace(/\D/g, "")) ? "" : "Số điện thoại cần 10 số, bắt đầu bằng 0.";
    case "email": return v === "" || /^\S+@\S+\.\S+$/.test(v) ? "" : "Email chưa đúng dạng, ví dụ ten@gmail.com.";
    case "password":
      // Đăng nhập chỉ cần có nhập; luật mới (từ 8 ký tự, có cả chữ và số, không bắt buộc ký tự đặc biệt) áp khi tạo mật khẩu
      if (login) return v === "" ? "Bạn nhập mật khẩu giúp shop nhé." : "";
      return passwordProblem(v);
    case "password2": return v !== "" && v === (vals.password ?? "").trim() ? "" : "Hai mật khẩu chưa giống nhau.";
    default: return "";
  }
}

// Ô xám đặc #EBE6E8 + viền #918B85 (viền đạt khoảng 3:1 so với nền kem, ô xám một mình chỉ khoảng 1,2:1)
const boxCls = (invalid: boolean) =>
  `relative flex h-[52px] items-center rounded-[20px] border bg-[#EBE6E8] transition-[border-color,box-shadow] duration-150 focus-within:shadow-[0_0_0_3px_rgba(24,24,24,0.14)] ${invalid ? "border-danger" : "border-[#918B85] focus-within:border-[#181818]"}`;
const inputCls = "h-full w-full min-w-0 bg-transparent pl-12 pr-4 text-[15px] text-[#181818] outline-none shadow-none focus-visible:!rounded-none focus-visible:!shadow-none placeholder:text-[#6B655E]";

// Một bước trong form. `data-step-box` để hiệu ứng rung tìm đúng ô.
// Ô tùy chọn ghi "(không bắt buộc)" bằng chữ mờ nhỏ (không bẻ giữa chừng: nhãn dài thì cả khối xuống dòng dưới); ô bắt buộc không ghi gì,
// chỉ có chữ ẩn "(bắt buộc)" cho máy đọc màn hình.
function Step({ no, label, required, optional, icon, error, children, tall }: { no?: number; label: ReactNode; required?: boolean; optional?: boolean; icon: ReactNode; error?: string; children: ReactNode; tall?: boolean }) {
  return (
    <label className="group block">
      <span className="mb-1.5 block text-sm font-semibold leading-snug text-[#181818] transition duration-150 group-focus-within:-translate-y-0.5">
        {no && <>{no}. </>}{label}
        {required && <span className="sr-only"> (bắt buộc)</span>}
        {optional && <> <span className="inline-block whitespace-nowrap text-xs font-normal text-[#6B655E]">(không bắt buộc)</span></>}
      </span>
      <span data-step-box className={`${boxCls(!!error)} ${tall ? "!h-auto min-h-[52px] items-start" : ""}`}>
        <span className={`pointer-events-none absolute left-4 grid size-5 place-items-center text-[#6B655E] ${tall ? "top-[15px]" : ""}`} aria-hidden>{icon}</span>
        {children}
      </span>
      {error && <span role="alert" className="mt-1.5 block text-sm text-danger">{error}</span>}
    </label>
  );
}

function PasswordInput({ name, label, autoComplete, invalid }: { name: string; label: string; autoComplete: string; invalid: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <input name={name} type={show ? "text" : "password"} autoComplete={autoComplete} placeholder={label} aria-invalid={invalid} className={`${inputCls} pr-14`} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"} className="absolute right-1 top-1 grid size-11 place-items-center rounded-2xl text-[#6B655E] hover:bg-black/5">
        {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
      </button>
    </>
  );
}

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function CustomerAuth({ mode }: { mode: "login" | "register" }) {
  const isLogin = mode === "login";
  const steps = isLogin ? STEPS.filter((s) => s.key === "phone").concat({ key: "password" }) : STEPS;
  const [vals, setVals] = useState<Vals>({});
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState(false);
  const captcha = useCaptcha();

  // Điền từ trên xuống: một bước tính là xong khi mọi bước phía trên đã xong và ô hợp lệ (ô tùy chọn để trống thì bỏ qua)
  const done: boolean[] = [];
  steps.forEach((s, i) => {
    const empty = (vals[s.key] ?? "").trim() === "";
    const pass = s.optional && empty ? true : check(s.key, vals, isLogin) === "";
    done.push((i === 0 || done[i - 1]) && pass);
  });
  const firstOpen = done.indexOf(false);
  const doneCount = done.filter(Boolean).length;
  const err = (key: Key) => (submitted ? check(key, vals, isLogin) : "");

  const onInput = (e: React.FormEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!t.name) return;
    setVals((v) => ({ ...v, [t.name]: t.value }));
    setNotice(false);
    bounceField(t.closest("label")?.querySelector<HTMLElement>("span:last-of-type") ?? t.parentElement);
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitted(true);
    // Chỉ rung khi bấm gửi mà ô bắt buộc còn TRỐNG (ô sai định dạng chỉ báo lỗi)
    steps.filter((s) => !s.optional && (vals[s.key] ?? "").trim() === "").forEach((s) => shakeField(e.currentTarget.querySelector(`[name=${s.key}]`)?.closest("[data-step-box]")));
    const bad = steps.find((s) => check(s.key, vals, isLogin) !== "");
    if (bad) {
      e.currentTarget.querySelector<HTMLElement>(`[name=${bad.key}]`)?.focus();
      setNotice(false);
      return;
    }
    captcha.renew();
    setNotice(true);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col overflow-hidden bg-[#FFFBF7] md:min-h-0 md:rounded-3xl md:border md:border-white/70 md:shadow-[0_24px_60px_-24px_rgba(24,24,24,0.35)]">
      <div className="relative h-[270px] shrink-0">
        <Image src="/shop/mat-tien.webp" alt="Mặt tiền cửa hàng Tân Trường Tín trên đường 2/4, Nha Trang" fill priority sizes="(min-width: 640px) 460px, 100vw" className="object-cover object-[50%_59%]" />
        <Link href="/" aria-label="Quay lại trang bán hàng" className="absolute left-3 top-3 z-10 inline-flex h-11 items-center gap-1.5 rounded-full bg-white pl-3 pr-4 text-sm font-semibold text-[#181818] shadow-[0_4px_14px_-6px_rgba(24,24,24,0.4)] transition duration-150 hover:bg-[#F6F2F3] active:scale-95">
          <ArrowLeft className="size-5" aria-hidden />Quay lại
        </Link>
      </div>
      <div className="relative -mt-7 flex flex-1 flex-col rounded-t-[28px] bg-[#FFFBF7] px-[22px] pb-8 pt-6">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#181818]">{isLogin ? "Đăng nhập" : "Đăng ký tài khoản"}</h1>
        {!isLogin && (
          <div className="mt-3">
            <p role="status" aria-live="polite" className="text-[13px] text-[#544E4B]">Đã xong {doneCount} trên {steps.length} bước</p>
            <div aria-hidden className="mt-2.5 flex items-center">
              {steps.map((s, i) => (
                <Fragment key={s.key}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full border-2 text-xs font-bold transition-colors duration-300 ${i === firstOpen ? "text-[#181818]" : "text-[#6B655E]"}`} style={{ borderColor: done[i] ? GREEN : i === firstOpen ? "#181818" : "#B8B2AB", background: done[i] ? GREEN : "#FFFBF7" }}>
                    {done[i] ? <Check className="size-4 text-white" strokeWidth={3} /> : i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#D5D0D0]">
                      <span className="block h-full w-full origin-left transition-transform duration-500 ease-out motion-reduce:transition-none" style={{ background: GREEN, transform: `scaleX(${done[i] ? 1 : 0})` }} />
                    </span>
                  )}
                </Fragment>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={submit} onInput={onInput} noValidate className="mt-5 flex flex-col gap-4">
          {!isLogin && (
            <Step no={isLogin ? undefined : 1} label="Họ tên" required icon={<UserRound className="size-5" />} error={err("name")}>
              <input name="name" autoComplete="name" maxLength={80} placeholder="Họ tên của bạn" aria-invalid={!!err("name")} className={inputCls} />
            </Step>
          )}
          <Step no={isLogin ? undefined : 2} label="Số điện thoại" required={!isLogin} icon={<Phone className="size-5" />} error={err("phone")}>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} placeholder="Số điện thoại của bạn" aria-invalid={!!err("phone")} className={inputCls} />
          </Step>
          {!isLogin && (
            <Step no={3} label="Email" optional icon={<Mail className="size-5" />} error={err("email")}>
              <input name="email" type="email" autoComplete="email" maxLength={120} placeholder="ten@gmail.com" aria-invalid={!!err("email")} className={inputCls} />
            </Step>
          )}
          <Step no={isLogin ? undefined : 4} label="Mật khẩu" required={!isLogin} icon={<Lock className="size-5" />} error={err("password")}>
            <PasswordInput name="password" label="Mật khẩu" autoComplete={isLogin ? "current-password" : "new-password"} invalid={!!err("password")} />
          </Step>
          {!isLogin && (
            <>
              <Step no={5} label="Nhập lại mật khẩu" required icon={<Lock className="size-5" />} error={err("password2")}>
                <PasswordInput name="password2" label="Nhập lại mật khẩu" autoComplete="new-password" invalid={!!err("password2")} />
              </Step>
              <Step no={6} label="Sản phẩm anh chị cần tìm là gì?" optional icon={<Search className="size-5" />} tall>
                {/* Hai dòng để gợi ý không bị cắt chữ trên màn hẹp */}
                <textarea name="need" rows={2} maxLength={120} placeholder="Tủ lạnh, Tai nghe, Màn hình rời,..." className={`${inputCls} resize-none py-3.5 leading-5`} />
              </Step>
            </>
          )}

          {captcha.enabled && <TurnstileWidget key={captcha.round} onStatus={captcha.setStatus} />}

          {notice && (
            <p role="status" className="rounded-2xl border border-[#D5D0D0] bg-[#F6F2F3] px-3.5 py-3 text-sm leading-6 text-[#181818]">
              Tài khoản khách hàng đang được chuẩn bị nên shop chưa lưu thông tin của bạn. Bạn vẫn đặt hàng và tra cứu đơn như bình thường, không cần tài khoản.
            </p>
          )}

          <button type="submit" disabled={captcha.waiting} onPointerDown={(e) => rippleAt(e, "rgba(255,255,255,0.35)")} className={`relative mt-1 flex h-[52px] w-full items-center justify-center overflow-hidden rounded-full bg-[#1B1B1B] text-[15px] font-semibold text-white transition duration-150 hover:bg-[#2F2F2F] active:scale-[0.98] disabled:opacity-60 ${done.every(Boolean) ? "" : "opacity-70"}`}>
            {captcha.waiting ? "Đang xác minh…" : isLogin ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
          {GOOGLE_READY && (
            <button type="button" onClick={() => { setSubmitted(false); setNotice(true); }} onPointerDown={(e) => rippleAt(e, "rgba(24,24,24,0.12)")} className="relative flex h-[52px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-full border border-[#E2DDDA] bg-white text-[15px] font-semibold text-[#181818] transition duration-150 hover:bg-[#F6F2F3] active:scale-[0.98]">
              <GoogleG />Tiếp tục với Google
            </button>
          )}
          <Link href={isLogin ? "/tai-khoan/dang-ky" : "/tai-khoan/dang-nhap"} className="mx-auto inline-flex h-11 items-center px-2 text-[15px] font-semibold text-[#181818] underline underline-offset-4">
            {isLogin ? "Tạo tài khoản mới" : "Tôi đã có tài khoản"}
          </Link>
          {isLogin && (
            <p className="-mt-2 text-center text-[13px] text-[#6B655E]">
              Quên mật khẩu? <a href="tel:0948732064" className="font-semibold text-[#181818] underline underline-offset-2">Gọi shop {SHOP.phone}</a>
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
