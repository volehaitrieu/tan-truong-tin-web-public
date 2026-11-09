// Mỗi lần chuyển trang, nội dung hiện dần nhẹ (chỉ độ mờ để không làm lệch các thanh cố định; tắt khi máy bật giảm chuyển động).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
