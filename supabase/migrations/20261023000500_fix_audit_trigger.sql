-- Sửa lỗi: "cannot cast type public.products to jsonb" khiến mọi lần sửa SP/giá nhập/quyền thất bại
create or replace function private.audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare row_json jsonb := to_jsonb(coalesce(new, old));
begin
  if (select auth.uid()) is null or current_setting('ttt.inventory_sync', true) = 'on' then return coalesce(new, old); end if;
  insert into public.audit_log (actor, action, target, details)
  values ((select auth.uid()), lower(tg_op) || ':' || tg_table_name,
          row_json ->> (case when tg_table_name = 'products' then 'sku' when tg_table_name = 'product_costs' then 'product_id'
                             when tg_table_name = 'role_permissions' then 'permission' else 'id' end),
          case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)) else row_json end);
  return coalesce(new, old);
end $$;
