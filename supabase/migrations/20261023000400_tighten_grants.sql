-- Postgres mặc định cho PUBLIC quyền gọi hàm mới → thu lại cho hàm chỉ dành cho người đã đăng nhập
revoke execute on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;
-- Hàm nội bộ: chỉ chạy trong RLS / hàm khác
revoke execute on all functions in schema private from public;
grant execute on function private.has_perm(text), private.is_staff(), private.is_owner() to anon, authenticated;
grant execute on function private.require(text) to authenticated;
