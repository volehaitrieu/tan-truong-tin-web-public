// Mã VietQR (chuẩn NAPAS 247) tạo ngay trên máy: không gọi dịch vụ ngoài, không gửi số tài khoản đi đâu.
// Chỉ gồm hàm thuần (không cần máy chủ) nên dùng được ở cả trình duyệt lẫn máy chủ.

export type ShopBank = { bin: string; account_no: string; account_name: string };

// Mã BIN các ngân hàng phổ biến (NAPAS). Cần quét thử bằng app ngân hàng thật để chắc chắn trước khi mở bán.
export const BANKS: { bin: string; name: string }[] = [
  { bin: "970436", name: "Vietcombank" },
  { bin: "970415", name: "VietinBank" },
  { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" },
  { bin: "970407", name: "Techcombank" },
  { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" },
  { bin: "970432", name: "VPBank" },
  { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank" },
  { bin: "970437", name: "HDBank" },
  { bin: "970441", name: "VIB" },
  { bin: "970443", name: "SHB" },
  { bin: "970448", name: "OCB" },
  { bin: "970426", name: "MSB" },
  { bin: "970440", name: "SeABank" },
  { bin: "970431", name: "Eximbank" },
  { bin: "970449", name: "LPBank" },
  { bin: "970428", name: "Nam A Bank" },
  { bin: "970425", name: "ABBank" },
];

export const bankName = (bin: string) => BANKS.find((b) => b.bin === bin)?.name ?? "";

// Đọc cột settings.bank (jsonb) an toàn: sai hình dạng = coi như chưa cài.
export function parseBank(v: unknown): ShopBank | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const bin = String(o.bin ?? "");
  const account_no = String(o.account_no ?? "");
  const account_name = String(o.account_name ?? "");
  if (!/^\d{6}$/.test(bin) || !/^\d{6,19}$/.test(account_no)) return null;
  return { bin, account_no, account_name: account_name.slice(0, 60) };
}

export function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

// Nội dung chuyển khoản: chỉ chữ/số, tối đa 25 ký tự (mã đơn dạng TTT001064).
export const transferNote = (code: string) => code.replace(/[^A-Za-z0-9]/g, "").slice(0, 25);

export function vietQrPayload(bank: ShopBank, amount: number, note: string): string {
  const account = tlv("00", bank.bin) + tlv("01", bank.account_no);
  const merchant = tlv("00", "A000000727") + tlv("01", account) + tlv("02", "QRIBFTTA");
  const amt = Number.isFinite(amount) && amount > 0 ? String(Math.round(amount)) : "";
  const body =
    tlv("00", "01") +
    tlv("01", amt ? "12" : "11") +
    tlv("38", merchant) +
    tlv("53", "704") +
    (amt ? tlv("54", amt) : "") +
    tlv("58", "VN") +
    (note ? tlv("62", tlv("08", transferNote(note))) : "") +
    "6304";
  return body + crc16(body);
}
