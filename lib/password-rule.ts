// Luật mật khẩu mới (chủ shop chốt 3/11/2026): từ 8 ký tự, có cả chữ và số, không bắt buộc ký tự đặc biệt (cũng không cấm).
// Dùng chung cho đăng ký khách (trình duyệt) và đổi mật khẩu quản trị (máy chủ). Trả về lời báo lỗi tiếng Việt, "" nếu hợp lệ.
// Chữ tính theo Unicode nên mật khẩu có dấu tiếng Việt vẫn hợp lệ.
export function passwordProblem(pw: string): string {
  if (pw.length < 8) return "Mật khẩu cần ít nhất 8 ký tự.";
  return /\p{L}/u.test(pw) && /\d/.test(pw) ? "" : "Mật khẩu cần có cả chữ và số.";
}
