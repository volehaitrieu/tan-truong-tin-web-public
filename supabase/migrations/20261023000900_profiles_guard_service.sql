-- Chốt bảo vệ hồ sơ chỉ áp cho người dùng đăng nhập trên web; script bảo trì phía server (không có auth.uid) được phép.
-- (RLS đã chặn khách chưa đăng nhập sửa profiles, nên auth.uid() rỗng chỉ có thể là server.)
create or replace function private.profiles_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return new; end if;
  if new.id = (select auth.uid()) and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'Không thể tự đổi vai trò hoặc trạng thái của chính mình' using errcode = '42501';
  end if;
  if (old.role = 'owner' or new.role = 'owner') and not private.is_owner() then
    raise exception 'Chỉ chủ shop được thay đổi tài khoản chủ shop' using errcode = '42501';
  end if;
  return new;
end $$;
