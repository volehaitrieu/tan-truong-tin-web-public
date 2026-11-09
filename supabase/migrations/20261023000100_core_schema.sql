-- Tân Trường Tín — lược đồ chính + phân quyền + RLS
-- Nguyên tắc: RLS bật cho MỌI bảng; quyền kiểm bằng 1 hàm duy nhất (private.has_perm);
-- giá nhập nằm ở bảng riêng; tiền là bigint (đồng); khách chỉ ghi dữ liệu qua hàm RPC.

create extension if not exists unaccent with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to anon, authenticated;

-- ============ Vai trò & quyền ============
create type public.app_role as enum ('owner', 'order_staff', 'stock_staff');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role public.app_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.permissions (
  key text primary key,
  label text not null,
  sort int not null default 0
);

create table public.role_permissions (
  role public.app_role not null,
  permission text not null references public.permissions (key) on delete cascade,
  allowed boolean not null default false,
  primary key (role, permission)
);

-- Hàm kiểm quyền duy nhất. Chủ shop luôn có mọi quyền; tài khoản bị khóa không có quyền nào.
create or replace function private.has_perm(p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles pr
    where pr.id = (select auth.uid()) and pr.is_active
      and (pr.role = 'owner' or exists (
        select 1 from public.role_permissions rp
        where rp.role = pr.role and rp.permission = p and rp.allowed))
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_active);
$$;

create or replace function private.is_owner()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()) and is_active and role = 'owner');
$$;

grant execute on function private.has_perm(text), private.is_staff(), private.is_owner() to anon, authenticated;

-- Trình duyệt hỏi "tôi được làm gì" (để ẩn/hiện menu); việc chặn thật nằm ở RLS + hàm.
create or replace function public.my_permissions()
returns table (permission text)
language sql stable security definer set search_path = ''
as $$
  select p.key from public.permissions p where private.has_perm(p.key);
$$;
revoke execute on function public.my_permissions() from anon;

-- ============ Danh mục, thương hiệu, sản phẩm ============
create table public.categories (
  id bigint generated always as identity primary key,
  parent_id bigint references public.categories (id) on delete restrict,
  name text not null,
  slug text not null unique,
  icon text,
  sort int not null default 0,
  attribute_schema jsonb not null default '[]'::jsonb
);

create table public.brands (
  id bigint generated always as identity primary key,
  name text not null unique,
  slug text not null unique
);

create table public.products (
  id bigint generated always as identity primary key,
  sku text not null unique check (sku ~ '^[A-Z0-9][A-Z0-9-]{1,40}$'),
  name text not null check (length(name) between 2 and 200),
  slug text not null unique,
  unit text not null default 'Cái',
  price bigint not null check (price >= 0),
  sale_price bigint check (sale_price is null or sale_price >= 0),
  sale_from date,
  sale_to date,
  category_id bigint references public.categories (id),
  brand_id bigint references public.brands (id),
  spec_line text,
  attributes jsonb not null default '{}'::jsonb,
  warranty text,
  origin text,
  need_tags text[] not null default '{}',
  description text,
  is_visible boolean not null default true,
  in_stock boolean not null default false, -- do trigger tồn kho cập nhật; khách chỉ thấy cờ này
  search_text text not null default '',
  updated_at timestamptz not null default now(),
  check (sale_to is null or sale_from is null or sale_to >= sale_from)
);
create index products_category_idx on public.products (category_id);
create index products_brand_idx on public.products (brand_id);
create index products_search_idx on public.products using gin (to_tsvector('simple', search_text));

-- Giá nhập: bảng riêng, chỉ ai có quyền "view_cost" mới đọc được.
create table public.product_costs (
  product_id bigint primary key references public.products (id) on delete cascade,
  cost_price bigint not null check (cost_price >= 0)
);

create table public.product_images (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  url text not null,
  is_illustration boolean not null default false,
  sort int not null default 0
);
create index product_images_product_idx on public.product_images (product_id);

-- ============ Tồn kho ============
create table public.inventory (
  product_id bigint primary key references public.products (id) on delete cascade,
  qty int not null default 0 check (qty >= 0),
  min_qty int not null default 0 check (min_qty >= 0)
);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id bigint not null references public.products (id) on delete cascade,
  delta int not null check (delta <> 0),
  reason text not null check (reason in ('Nhập hàng','Hư hỏng','Thất lạc','Trả hàng','Kiểm kho','Khác','Bán hàng','Hủy đơn','Tồn đầu kỳ')),
  note text,
  order_id bigint,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

-- ============ Đơn hàng ============
create type public.delivery_method as enum ('pickup', 'inner', 'province', 'counter');
create type public.order_status as enum ('pending', 'confirmed', 'shipping', 'ready', 'completed', 'cancelled');

create sequence public.order_code_seq start 1000;

create table public.orders (
  id bigint generated always as identity primary key,
  code text not null unique,
  customer_name text not null check (length(customer_name) between 1 and 100),
  phone text not null check (phone ~ '^0[0-9]{9}$'),
  email text check (email is null or length(email) <= 200),
  delivery public.delivery_method not null,
  province text,
  ward text,
  street text,
  note text check (note is null or length(note) <= 1000),
  payment_method text not null default 'cod' check (payment_method in ('cod', 'cash')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  subtotal bigint not null check (subtotal >= 0),
  shipping_fee bigint check (shipping_fee is null or shipping_fee >= 0),
  status public.order_status not null default 'pending',
  needs_restock boolean not null default false,
  tracking_code text,
  created_by uuid references auth.users (id), -- nhân viên tạo (bán tại quầy); null = khách đặt web
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_phone_idx on public.orders (phone);

create table public.order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  product_id bigint references public.products (id),
  sku text not null,
  name text not null,
  unit text not null,
  unit_price bigint not null check (unit_price >= 0),
  qty int not null check (qty between 1 and 999)
);
create index order_items_order_idx on public.order_items (order_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders (id) on delete cascade,
  type text not null,
  note text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

create table public.quote_requests (
  id bigint generated always as identity primary key,
  items text not null check (length(items) between 3 and 2000),
  phone text not null check (phone ~ '^0[0-9]{9}$'),
  handled boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============ Kiểm kho ============
create table public.stock_counts (
  id bigint generated always as identity primary key,
  name text not null,
  scope text,
  status text not null default 'counting' check (status in ('counting', 'pending', 'closed')),
  assigned_to uuid references auth.users (id),
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create table public.stock_count_items (
  count_id bigint not null references public.stock_counts (id) on delete cascade,
  product_id bigint not null references public.products (id) on delete cascade,
  system_qty int not null,
  counted_qty int check (counted_qty is null or counted_qty >= 0),
  counted_by uuid references auth.users (id),
  counted_at timestamptz,
  primary key (count_id, product_id)
);

-- ============ Cài đặt, nhật ký ============
create table public.settings (
  id int primary key default 1 check (id = 1),
  shop jsonb not null default '{}'::jsonb,
  inner_ship_fee bigint check (inner_ship_fee is null or inner_ship_fee >= 0), -- null = "báo sau"
  free_ship_threshold bigint,
  return_policy text,
  bank jsonb, -- VietQR (sắp có)
  updated_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users (id),
  action text not null,
  target text,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- ============ Bật RLS cho mọi bảng ============
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_costs enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_events enable row level security;
alter table public.quote_requests enable row level security;
alter table public.stock_counts enable row level security;
alter table public.stock_count_items enable row level security;
alter table public.settings enable row level security;
alter table public.audit_log enable row level security;

-- ============ Chính sách (policy) ============
-- Hồ sơ: tự xem mình; ai có quyền quản lý nhân viên xem/sửa tất cả.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.has_perm('manage_staff'));
create policy profiles_update on public.profiles for update to authenticated
  using (private.has_perm('manage_staff')) with check (private.has_perm('manage_staff'));

create policy permissions_select on public.permissions for select to authenticated using (true);
create policy role_permissions_select on public.role_permissions for select to authenticated using (private.is_staff());
create policy role_permissions_write on public.role_permissions for update to authenticated
  using (private.is_owner()) with check (private.is_owner() and role <> 'owner');

-- Danh mục, thương hiệu, ảnh: ai cũng xem; sửa cần quyền sửa sản phẩm.
create policy categories_select on public.categories for select to anon, authenticated using (true);
create policy categories_write on public.categories for all to authenticated
  using (private.has_perm('edit_products')) with check (private.has_perm('edit_products'));
create policy brands_select on public.brands for select to anon, authenticated using (true);
create policy brands_write on public.brands for all to authenticated
  using (private.has_perm('edit_products')) with check (private.has_perm('edit_products'));
create policy images_select on public.product_images for select to anon, authenticated using (true);
create policy images_write on public.product_images for all to authenticated
  using (private.has_perm('edit_products')) with check (private.has_perm('edit_products'));

-- Sản phẩm: khách chỉ thấy SP đang hiển thị; nhân viên thấy tất cả. Không có xóa (chỉ Ẩn).
create policy products_select on public.products for select to anon, authenticated
  using (is_visible or private.is_staff());
create policy products_insert on public.products for insert to authenticated
  with check (private.has_perm('edit_products'));
create policy products_update on public.products for update to authenticated
  using (private.has_perm('edit_products')) with check (private.has_perm('edit_products'));

create policy costs_select on public.product_costs for select to authenticated using (private.has_perm('view_cost'));
create policy costs_write on public.product_costs for all to authenticated
  using (private.has_perm('edit_price') and private.has_perm('view_cost'))
  with check (private.has_perm('edit_price') and private.has_perm('view_cost'));

-- Tồn kho: nhân viên xem; mọi thay đổi số lượng đi qua hàm adjust_stock / xác nhận đơn.
create policy inventory_select on public.inventory for select to authenticated using (private.is_staff());
create policy inventory_min_update on public.inventory for update to authenticated
  using (private.has_perm('adjust_stock')) with check (private.has_perm('adjust_stock'));
create policy movements_select on public.inventory_movements for select to authenticated using (private.is_staff());

-- Đơn hàng: chỉ nhân viên có quyền xem đơn; khách tạo/tra cứu qua hàm RPC.
create policy orders_select on public.orders for select to authenticated using (private.has_perm('process_orders') or private.has_perm('pos_sale'));
create policy order_items_select on public.order_items for select to authenticated using (private.has_perm('process_orders') or private.has_perm('pos_sale'));
create policy order_events_select on public.order_events for select to authenticated using (private.has_perm('process_orders'));
create policy quotes_select on public.quote_requests for select to authenticated using (private.has_perm('process_orders'));
create policy quotes_update on public.quote_requests for update to authenticated
  using (private.has_perm('process_orders')) with check (private.has_perm('process_orders'));

create policy counts_select on public.stock_counts for select to authenticated using (private.is_staff());
create policy counts_write on public.stock_counts for all to authenticated
  using (private.is_owner()) with check (private.is_owner());
create policy count_items_select on public.stock_count_items for select to authenticated using (private.is_staff());

-- Cài đặt: ai cũng đọc (thông tin shop, phí ship); sửa cần quyền cài đặt.
create policy settings_select on public.settings for select to anon, authenticated using (true);
create policy settings_update on public.settings for update to authenticated
  using (private.has_perm('settings')) with check (private.has_perm('settings'));

create policy audit_select on public.audit_log for select to authenticated using (private.has_perm('view_audit'));

-- ============ Trigger ============
-- Chuỗi tìm kiếm không dấu (tên + SKU + thương hiệu) + cập nhật updated_at
create or replace function private.products_before_write()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare b text;
begin
  select name into b from public.brands where id = new.brand_id;
  new.search_text := lower(extensions.unaccent(coalesce(new.name,'') || ' ' || coalesce(new.sku,'') || ' ' || coalesce(b,'')));
  new.search_text := replace(new.search_text, 'đ', 'd');
  new.updated_at := now();
  -- Giá bán chỉ người có quyền "sửa giá bán" được đổi
  if tg_op = 'UPDATE' and (new.price is distinct from old.price or new.sale_price is distinct from old.sale_price
      or new.sale_from is distinct from old.sale_from or new.sale_to is distinct from old.sale_to)
     and (select auth.uid()) is not null and not private.has_perm('edit_price') then
    raise exception 'Bạn không có quyền sửa giá bán' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.in_stock is distinct from old.in_stock and (select auth.uid()) is not null
     and current_setting('ttt.inventory_sync', true) is distinct from 'on' then
    new.in_stock := old.in_stock; -- cờ còn hàng chỉ do tồn kho quyết định
  end if;
  return new;
end $$;
create trigger products_before_write before insert or update on public.products
  for each row execute function private.products_before_write();

-- Đồng bộ cờ "còn hàng" sang bảng sản phẩm
create or replace function private.inventory_sync()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('ttt.inventory_sync', 'on', true);
  update public.products set in_stock = new.qty > 0 where id = new.product_id and in_stock is distinct from (new.qty > 0);
  perform set_config('ttt.inventory_sync', 'off', true);
  return new;
end $$;
create trigger inventory_sync after insert or update of qty on public.inventory
  for each row execute function private.inventory_sync();

-- Mỗi sản phẩm mới có 1 dòng tồn kho
create or replace function private.products_after_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.inventory (product_id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger products_after_insert after insert on public.products
  for each row execute function private.products_after_insert();

-- Nhật ký thao tác cho các bảng quan trọng
create or replace function private.audit()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or current_setting('ttt.inventory_sync', true) = 'on' then return coalesce(new, old); end if;
  insert into public.audit_log (actor, action, target, details)
  values ((select auth.uid()), lower(tg_op) || ':' || tg_table_name,
          coalesce(new, old)::jsonb ->> (case when tg_table_name = 'products' then 'sku' else 'id' end),
          case when tg_op = 'UPDATE' then jsonb_build_object('old', to_jsonb(old), 'new', to_jsonb(new)) else to_jsonb(coalesce(new, old)) end);
  return coalesce(new, old);
end $$;
create trigger audit_products after insert or update on public.products for each row execute function private.audit();
create trigger audit_costs after insert or update or delete on public.product_costs for each row execute function private.audit();
create trigger audit_role_permissions after update on public.role_permissions for each row execute function private.audit();
create trigger audit_profiles after update on public.profiles for each row execute function private.audit();
create trigger audit_settings after update on public.settings for each row execute function private.audit();

-- Nhân viên không tự nâng vai trò / tự mở khóa chính mình; không ai đổi vai trò chủ shop
create or replace function private.profiles_guard()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.id = (select auth.uid()) and (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    raise exception 'Không thể tự đổi vai trò hoặc trạng thái của chính mình' using errcode = '42501';
  end if;
  if (old.role = 'owner' or new.role = 'owner') and not private.is_owner() then
    raise exception 'Chỉ chủ shop được thay đổi tài khoản chủ shop' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function private.profiles_guard();
