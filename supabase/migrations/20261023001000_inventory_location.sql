-- Vị trí để hàng (chỉ nhân viên đọc được), Sản xuất tại, giá nhập gốc (giá vốn = giá nhập + 10%),
-- và bảng thay đổi chờ duyệt khi nhập Excel.
alter table public.inventory add column if not exists location text not null default 'Kho 1'
  check (length(location) between 1 and 40);
alter table public.products add column if not exists made_in text
  check (made_in is null or length(made_in) <= 100);
alter table public.product_costs add column if not exists import_price bigint
  check (import_price is null or import_price >= 0);

create table if not exists public.import_changes (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  field text not null check (field in ('name','unit','price','import_price','category','brand','location','min_qty','spec','description','warranty','origin','made_in')),
  old_value text,
  new_value text,
  created_by uuid references auth.users (id) default auth.uid(),
  created_at timestamptz not null default now(),
  unique (product_id, field)
);
alter table public.import_changes enable row level security;
-- Chỉ người được nhập Excel + sửa giá; dòng giá nhập chỉ người xem được giá vốn.
create policy import_changes_all on public.import_changes for all to authenticated
  using (private.has_perm('import_excel') and private.has_perm('edit_price') and (field <> 'import_price' or private.has_perm('view_cost')))
  with check (private.has_perm('import_excel') and private.has_perm('edit_price') and (field <> 'import_price' or private.has_perm('view_cost')));
