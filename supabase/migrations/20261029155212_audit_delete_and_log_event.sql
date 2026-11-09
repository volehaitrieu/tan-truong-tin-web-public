-- Nhật ký thao tác: ghi thêm việc xóa sản phẩm (trước đây chỉ ghi thêm/sửa),
-- và cho máy chủ web ghi các việc không đi qua bảng: đăng nhập, xuất/nhập Excel, thêm nhân viên.
drop trigger if exists audit_products on public.products;
create trigger audit_products after insert or update or delete on public.products
  for each row execute function private.audit();

-- Người ghi luôn là người đang đăng nhập (auth.uid()), không ghi hộ người khác được; mỗi việc cần đúng quyền.
-- Danh sách việc phải khớp lib/admin/audit.ts. Nhật ký vẫn không ai sửa/xóa được (bảng không có policy ghi).
create or replace function public.log_event(p_action text, p_target text default null, p_details jsonb default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not coalesce(case p_action
      when 'login' then private.is_staff()
      when 'export:products' then private.is_staff()
      when 'import:products' then private.has_perm('import_excel')
      when 'insert:staff' then private.has_perm('manage_staff')
    end, false) then
    raise exception 'Không được ghi nhật ký này' using errcode = '42501';
  end if;
  if pg_column_size(p_details) > 8000 then
    raise exception 'Chi tiết nhật ký quá dài' using errcode = '22023';
  end if;
  insert into public.audit_log (actor, action, target, details)
  values ((select auth.uid()), p_action, left(p_target, 200), p_details);
end $$;

revoke execute on function public.log_event(text, text, jsonb) from public, anon;
grant execute on function public.log_event(text, text, jsonb) to authenticated;
