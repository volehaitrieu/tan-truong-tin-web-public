type Props = { size?: number; subtitle?: string; subtitleClassName?: string; tone?: "brand" | "light" };

// Cửa hàng chưa dùng logo hình: chỉ chữ thương hiệu màu cobalt (chủ shop chốt 3/11/2026, áp dụng toàn bộ trang).
// `size` giữ để các nơi gọi cũ không phải đổi: cỡ chữ ≈ nửa size.
export function Logo({ size = 36, subtitle, subtitleClassName = "", tone = "brand" }: Props) {
  return (
    <span className="flex flex-col leading-tight">
      <span className={`font-bold tracking-tight ${tone === "light" ? "text-white" : "text-brand"}`} style={{ fontSize: Math.max(15, Math.round(size / 2)) }}>
        Tân Trường Tín
      </span>
      {subtitle && (
        <span className={`text-xs ${tone === "light" ? "text-white/70" : "text-ink-2"} ${subtitleClassName}`}>{subtitle}</span>
      )}
    </span>
  );
}
