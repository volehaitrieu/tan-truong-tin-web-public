-- Tạo đợt kiểm kho: chụp số tồn hệ thống của các SP trong danh mục (gồm danh mục con). Chỉ chủ shop.
create or replace function public.count_create(p_name text, p_category_slug text default null)
returns bigint language plpgsql security definer set search_path = ''
as $$
declare v_id bigint; v_cat bigint;
begin
  if not private.is_owner() then raise exception 'Chỉ chủ shop được tạo đợt kiểm kho' using errcode = '42501'; end if;
  if p_name is null or length(btrim(p_name)) < 2 or length(p_name) > 100 then
    raise exception 'Nhập tên đợt kiểm kho' using errcode = '22023';
  end if;
  if p_category_slug is not null then
    select id into v_cat from public.categories where slug = p_category_slug;
    if not found then raise exception 'Không tìm thấy danh mục' using errcode = '22023'; end if;
  end if;
  insert into public.stock_counts (name, scope, created_by)
  values (btrim(p_name), coalesce((select name from public.categories where id = v_cat), 'Tất cả sản phẩm'), (select auth.uid()))
  returning id into v_id;
  insert into public.stock_count_items (count_id, product_id, system_qty)
  select v_id, p.id, coalesce(i.qty, 0)
  from public.products p left join public.inventory i on i.product_id = p.id
  where v_cat is null or p.category_id = v_cat
     or p.category_id in (select id from public.categories where parent_id = v_cat);
  return v_id;
end $$;
revoke execute on function public.count_create(text, text) from public, anon;
grant execute on function public.count_create(text, text) to authenticated;
