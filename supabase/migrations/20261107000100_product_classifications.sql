-- Một sản phẩm thuộc nhiều Phân loại (chủ shop duyệt 07/11/2026, docs/website-v2/viec/phan-loai-nhieu/).
-- Phân loại = danh mục cấp 3 (con của Danh mục con). products.category_id trỏ Danh mục con (cấp 2);
-- các Phân loại nằm trong bảng liên kết. Đã chạy trên Supabase thật 07/11/2026 (phiên bản thực ghi trong lịch sử migration) với chủ shop đồng ý.

-- Khóa chính riêng (không ghép) để PostgREST KHÔNG coi bảng là cầu nối nhiều–nhiều products↔categories:
-- nếu coi, mọi truy vấn nhúng categories(...) từ products báo lỗi "more than one relationship" (đã xảy ra 07/11).
create table if not exists public.product_classifications (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  classification_id bigint not null references public.categories (id) on delete restrict,
  constraint product_classifications_unique unique (product_id, classification_id)
);
create index if not exists product_classifications_by_class on public.product_classifications (classification_id, product_id);

alter table public.product_classifications enable row level security;
-- Đọc: như sản phẩm (khách chỉ thấy liên kết của SP đang hiển thị; nhân viên thấy tất cả).
create policy product_classifications_select on public.product_classifications for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (p.is_visible or private.is_staff())));
create policy product_classifications_write on public.product_classifications for all to authenticated
  using (private.has_perm('edit_products')) with check (private.has_perm('edit_products'));
-- Chỉ cấp đúng quyền cần (Supabase mặc định cấp rộng): khách chỉ đọc; nhân viên đọc/thêm/xóa, RLS vẫn kiểm edit_products.
revoke all on public.product_classifications from anon, authenticated;
grant select on public.product_classifications to anon, authenticated;
grant insert, delete on public.product_classifications to authenticated;

-- Ràng buộc ở DB cho mọi đường ghi: Phân loại phải là con trực tiếp của Danh mục con của SP.
create or replace function private.check_product_classification() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.products p join public.categories c on c.id = new.classification_id
    where p.id = new.product_id and p.category_id is not null and c.parent_id = p.category_id
  ) then
    raise exception 'Phân loại không thuộc Danh mục con của sản phẩm.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger product_classifications_parent before insert or update on public.product_classifications
  for each row execute function private.check_product_classification();

-- Không cho đổi Danh mục con khi SP còn Phân loại của Danh mục con cũ (tránh liên kết sai cha).
create or replace function private.check_product_category_change() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.category_id is distinct from old.category_id and exists (
    select 1 from public.product_classifications pc join public.categories c on c.id = pc.classification_id
    where pc.product_id = new.id and c.parent_id is distinct from new.category_id
  ) then
    raise exception 'Sản phẩm đang có Phân loại của Danh mục con cũ. Đổi danh mục và Phân loại cùng lúc bằng Nhập Excel.' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger products_category_keeps_classifications before update of category_id on public.products
  for each row execute function private.check_product_category_change();

-- Đặt Danh mục con + thay TOÀN BỘ Phân loại của 1 SP trong một giao dịch (lỗi giữa chừng thì giữ nguyên cũ).
-- Phân loại phải đã tồn tại (app tạo trước, qua RLS categories_write). security invoker: RLS vẫn áp dụng.
create or replace function public.set_product_classifications(p_product_id bigint, p_category_id bigint, p_classification_ids bigint[])
returns void language plpgsql security invoker set search_path = '' as $$
declare ids bigint[] := coalesce((select array_agg(distinct x) from unnest(p_classification_ids) x where x is not null), '{}');
begin
  if not private.has_perm('edit_products') then
    raise exception 'Bạn không có quyền sửa sản phẩm' using errcode = '42501';
  end if;
  if cardinality(ids) > 20 then raise exception 'Tối đa 20 Phân loại cho một sản phẩm.' using errcode = '22023'; end if;
  if not exists (select 1 from public.categories s join public.categories r on r.id = s.parent_id
                 where s.id = p_category_id and r.parent_id is null) then
    raise exception 'Danh mục con không hợp lệ.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(ids) x left join public.categories c on c.id = x
             where c.id is null or c.parent_id is distinct from p_category_id) then
    raise exception 'Phân loại không thuộc Danh mục con của sản phẩm.' using errcode = '23514';
  end if;
  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'Không tìm thấy sản phẩm.' using errcode = 'P0002'; end if;
  delete from public.product_classifications where product_id = p_product_id;
  update public.products set category_id = p_category_id where id = p_product_id and category_id is distinct from p_category_id;
  insert into public.product_classifications (product_id, classification_id) select p_product_id, x from unnest(ids) x;
end $$;
revoke all on function public.set_product_classifications(bigint, bigint, bigint[]) from public, anon;
grant execute on function public.set_product_classifications(bigint, bigint, bigint[]) to authenticated;

-- Bảng đối chiếu nhập Excel có thêm trường "classifications" (new_value = JSON {sub, names}).
alter table public.import_changes drop constraint import_changes_field_check;
alter table public.import_changes add constraint import_changes_field_check
  check (field = any (array['name','unit','price','import_price','category','classifications','industry','brand','location','min_qty','qty','spec','description','warranty','origin','made_in']));

-- Chuyển dữ liệu cũ: SP đang gắn thẳng vào Phân loại (cấp 3) → Danh mục con cấp 2 + 1 liên kết.
-- Lưu bản chụp category_id cũ để hoàn tác; mục chờ "category" kiểu cũ trỏ cấp 3 được xóa (cần nhập lại để xem trước).
create table if not exists private.classification_backfill_20261107 (product_id bigint primary key, old_category_id bigint not null);
insert into private.classification_backfill_20261107 (product_id, old_category_id)
select p.id, p.category_id from public.products p
join public.categories c on c.id = p.category_id
join public.categories s on s.id = c.parent_id
join public.categories r on r.id = s.parent_id
where r.parent_id is null
on conflict do nothing;
update public.products p set category_id = c.parent_id
from private.classification_backfill_20261107 b join public.categories c on c.id = b.old_category_id
where p.id = b.product_id;
insert into public.product_classifications (product_id, classification_id)
select product_id, old_category_id from private.classification_backfill_20261107
on conflict do nothing;
delete from public.import_changes where field = 'category' and new_value like '% > %';

-- Hoàn tác (chỉ khi chủ shop đồng ý, sau khi đối chiếu):
--   delete from public.product_classifications;
--   update public.products p set category_id = b.old_category_id from private.classification_backfill_20261107 b where p.id = b.product_id;
