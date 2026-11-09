-- Hàm nghiệp vụ: mọi phép tính tiền / tồn kho chạy ở server, có kiểm quyền và khóa dòng.

-- Chuẩn hóa SĐT: bỏ khoảng trắng/dấu, +84 → 0. Trả null nếu không hợp lệ.
create or replace function private.normalize_phone(raw text)
returns text language sql immutable set search_path = ''
as $$
  select case when d ~ '^0[0-9]{9}$' then d
              when d ~ '^84[0-9]{9}$' then '0' || substr(d, 3)
              else null end
  from (select regexp_replace(coalesce(raw, ''), '[^0-9]', '', 'g') as d) s;
$$;

-- Giá đang áp dụng (giá KM nếu trong thời gian KM)
create or replace function private.effective_price(p_price bigint, p_sale bigint, p_from date, p_to date)
returns bigint language sql stable set search_path = ''
as $$
  select case when p_sale is not null
               and current_date between coalesce(p_from, '-infinity'::date) and coalesce(p_to, 'infinity'::date)
              then p_sale else p_price end;
$$;

-- ============ Khách đặt hàng ============
create or replace function public.place_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_name text := btrim(payload->>'name');
  v_phone text := private.normalize_phone(payload->>'phone');
  v_email text := nullif(btrim(coalesce(payload->>'email', '')), '');
  v_delivery public.delivery_method;
  v_province text := nullif(btrim(coalesce(payload->>'province', '')), '');
  v_ward text := nullif(btrim(coalesce(payload->>'ward', '')), '');
  v_street text := nullif(btrim(coalesce(payload->>'street', '')), '');
  v_note text := nullif(btrim(coalesce(payload->>'note', '')), '');
  v_items jsonb := payload->'items';
  v_subtotal bigint := 0;
  v_fee bigint;
  v_restock boolean := false;
  v_order_id bigint;
  v_code text;
  s public.settings;
  r record;
begin
  if v_name is null or length(v_name) < 1 or length(v_name) > 100 then
    raise exception 'Vui lòng nhập họ tên người nhận.' using errcode = '22023';
  end if;
  if v_phone is null then
    raise exception 'Số điện thoại cần 10 số, bắt đầu bằng 0.' using errcode = '22023';
  end if;
  if v_email is not null and (length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Email chưa đúng dạng.' using errcode = '22023';
  end if;
  begin
    v_delivery := (payload->>'delivery')::public.delivery_method;
  exception when others then
    raise exception 'Cách nhận hàng không hợp lệ.' using errcode = '22023';
  end;
  if v_delivery not in ('pickup', 'inner', 'province') then
    raise exception 'Cách nhận hàng không hợp lệ.' using errcode = '22023';
  end if;
  if v_delivery <> 'pickup' and (v_province is null or v_ward is null or v_street is null
      or length(v_province) > 60 or length(v_ward) > 80 or length(v_street) > 200) then
    raise exception 'Vui lòng nhập đủ địa chỉ nhận hàng.' using errcode = '22023';
  end if;
  if v_note is not null and length(v_note) > 1000 then
    raise exception 'Ghi chú quá dài.' using errcode = '22023';
  end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 50 then
    raise exception 'Giỏ hàng trống hoặc quá nhiều món.' using errcode = '22023';
  end if;

  -- Chống spam: 1 SĐT tối đa 3 đơn / 10 phút; toàn shop tối đa 30 đơn web / phút
  if (select count(*) from public.orders where phone = v_phone and created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from public.orders where created_by is null and created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Bạn vừa đặt nhiều đơn. Vui lòng chờ vài phút hoặc gọi shop 0948 732 064.' using errcode = '54000';
  end if;

  -- Gộp món trùng; số lượng phải là số nguyên 1..999
  for r in
    select e->>'sku' as sku, e->>'qty' as qty_raw from jsonb_array_elements(v_items) e
  loop
    if r.qty_raw is null or r.qty_raw !~ '^[0-9]{1,3}$' or r.qty_raw::int < 1 then
      raise exception 'Số lượng không hợp lệ.' using errcode = '22023';
    end if;
  end loop;

  select * into s from public.settings where id = 1;
  v_fee := case v_delivery when 'pickup' then 0 when 'inner' then s.inner_ship_fee else null end;

  v_code := 'TTT' || lpad(nextval('public.order_code_seq')::text, 6, '0');
  insert into public.orders (code, customer_name, phone, email, delivery, province, ward, street, note, subtotal, shipping_fee)
  values (v_code, v_name, v_phone, v_email, v_delivery, v_province, v_ward, v_street, v_note, 0, v_fee)
  returning id into v_order_id;

  for r in
    select p.*, sum((e->>'qty')::int)::int as qty
    from jsonb_array_elements(v_items) e
    join public.products p on p.sku = upper(e->>'sku') and p.is_visible
    group by p.id
  loop
    if r.qty > 999 then raise exception 'Số lượng không hợp lệ.' using errcode = '22023'; end if;
    insert into public.order_items (order_id, product_id, sku, name, unit, unit_price, qty)
    values (v_order_id, r.id, r.sku, r.name, r.unit, private.effective_price(r.price, r.sale_price, r.sale_from, r.sale_to), r.qty);
    v_subtotal := v_subtotal + private.effective_price(r.price, r.sale_price, r.sale_from, r.sale_to) * r.qty;
    v_restock := v_restock or not r.in_stock;
  end loop;

  if not exists (select 1 from public.order_items where order_id = v_order_id) then
    raise exception 'Sản phẩm trong giỏ không còn bán. Vui lòng tải lại trang.' using errcode = '22023';
  end if;
  if (select count(*) from public.order_items where order_id = v_order_id)
     <> (select count(distinct upper(e->>'sku')) from jsonb_array_elements(v_items) e) then
    raise exception 'Một số sản phẩm trong giỏ không còn bán. Vui lòng tải lại giỏ hàng.' using errcode = '22023';
  end if;

  if v_delivery = 'inner' and s.free_ship_threshold is not null and v_subtotal >= s.free_ship_threshold then
    v_fee := 0;
  end if;
  update public.orders set subtotal = v_subtotal, shipping_fee = v_fee, needs_restock = v_restock where id = v_order_id;
  insert into public.order_events (order_id, type, note) values (v_order_id, 'created', 'Khách đặt trên web');

  return jsonb_build_object('code', v_code, 'subtotal', v_subtotal, 'shipping_fee', v_fee);
end $$;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- ============ Khách tra cứu đơn (cần đúng mã + SĐT) ============
create or replace function public.lookup_order(p_code text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare o public.orders;
begin
  select * into o from public.orders
  where code = upper(btrim(p_code)) and phone = private.normalize_phone(p_phone);
  if not found then return null; end if;
  return jsonb_build_object(
    'code', o.code, 'status', o.status, 'delivery', o.delivery, 'subtotal', o.subtotal,
    'shipping_fee', o.shipping_fee, 'tracking_code', o.tracking_code, 'created_at', o.created_at,
    'items', (select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'unit_price', unit_price) order by id)
              from public.order_items where order_id = o.id));
end $$;
grant execute on function public.lookup_order(text, text) to anon, authenticated;

-- ============ Báo giá số lượng lớn ============
create or replace function public.submit_quote(p_items text, p_phone text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_phone text := private.normalize_phone(p_phone);
begin
  if v_phone is null then raise exception 'Số điện thoại cần 10 số, bắt đầu bằng 0.' using errcode = '22023'; end if;
  if p_items is null or length(btrim(p_items)) < 3 or length(p_items) > 2000 then
    raise exception 'Ghi ít nhất một món và số lượng.' using errcode = '22023';
  end if;
  if (select count(*) from public.quote_requests where phone = v_phone and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'Bạn vừa gửi nhiều yêu cầu. Vui lòng chờ vài phút.' using errcode = '54000';
  end if;
  insert into public.quote_requests (items, phone) values (btrim(p_items), v_phone);
end $$;
grant execute on function public.submit_quote(text, text) to anon, authenticated;

-- ============ Nhân viên: đổi trạng thái đơn (trừ/hoàn tồn) ============
create or replace function private.require(p text)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.has_perm(p) then raise exception 'Bạn không có quyền thực hiện thao tác này' using errcode = '42501'; end if;
end $$;

create or replace function public.order_set_status(p_order_id bigint, p_status public.order_status, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
  it record;
  v_have int;
  v_take int;
  v_short boolean := false;
begin
  select * into o from public.orders where id = p_order_id for update; -- khóa đơn: bấm 2 lần không trừ 2 lần
  if not found then raise exception 'Không tìm thấy đơn' using errcode = 'P0002'; end if;

  if p_status = 'cancelled' then perform private.require('cancel_orders');
  else perform private.require('process_orders'); end if;

  if not (
    (o.status = 'pending' and p_status in ('confirmed', 'cancelled')) or
    (o.status = 'confirmed' and p_status in ('shipping', 'ready', 'cancelled')) or
    (o.status in ('shipping', 'ready') and p_status in ('completed', 'cancelled'))
  ) then
    raise exception 'Không thể chuyển đơn từ "%" sang "%"', o.status, p_status using errcode = '22023';
  end if;

  if p_status = 'confirmed' then
    -- Trừ tồn: khóa các dòng tồn theo thứ tự product_id để tránh kẹt khóa
    for it in select product_id, sum(qty)::int as qty from public.order_items
              where order_id = o.id and product_id is not null group by product_id order by product_id
    loop
      select qty into v_have from public.inventory where product_id = it.product_id for update;
      v_take := least(coalesce(v_have, 0), it.qty);
      v_short := v_short or v_take < it.qty;
      if v_take > 0 then
        update public.inventory set qty = qty - v_take where product_id = it.product_id;
        insert into public.inventory_movements (product_id, delta, reason, order_id, created_by)
        values (it.product_id, -v_take, 'Bán hàng', o.id, (select auth.uid()));
      end if;
    end loop;
    update public.orders set needs_restock = v_short where id = o.id;
  elsif p_status = 'cancelled' and o.status <> 'pending' then
    -- Hoàn lại đúng số đã trừ cho đơn này
    for it in select product_id, -sum(delta)::int as qty from public.inventory_movements
              where order_id = o.id group by product_id having sum(delta) < 0 order by product_id
    loop
      update public.inventory set qty = qty + it.qty where product_id = it.product_id;
      insert into public.inventory_movements (product_id, delta, reason, order_id, created_by)
      values (it.product_id, it.qty, 'Hủy đơn', o.id, (select auth.uid()));
    end loop;
  end if;

  update public.orders set status = p_status, updated_at = now() where id = o.id;
  insert into public.order_events (order_id, type, note, created_by)
  values (o.id, 'status:' || p_status, nullif(left(btrim(coalesce(p_note, '')), 500), ''), (select auth.uid()));
end $$;

create or replace function public.order_set_shipping(p_order_id bigint, p_fee bigint, p_tracking text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require('process_orders');
  if p_fee is not null and (p_fee < 0 or p_fee > 10000000) then raise exception 'Phí ship không hợp lệ' using errcode = '22023'; end if;
  update public.orders set shipping_fee = p_fee, tracking_code = nullif(left(btrim(coalesce(p_tracking, '')), 60), ''), updated_at = now()
  where id = p_order_id and status not in ('completed', 'cancelled');
  if not found then raise exception 'Không sửa được đơn đã xong hoặc đã hủy' using errcode = '22023'; end if;
  insert into public.order_events (order_id, type, note, created_by)
  values (p_order_id, 'shipping', 'Phí ship: ' || coalesce(p_fee::text, 'báo sau'), (select auth.uid()));
end $$;

create or replace function public.order_mark_paid(p_order_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require('process_orders');
  update public.orders set payment_status = 'paid', updated_at = now() where id = p_order_id and status <> 'cancelled';
  if not found then raise exception 'Không tìm thấy đơn' using errcode = 'P0002'; end if;
  insert into public.order_events (order_id, type, created_by) values (p_order_id, 'paid', (select auth.uid()));
end $$;

-- ============ Kho ============
create or replace function public.adjust_stock(p_product_id bigint, p_delta int, p_reason text, p_note text default null)
returns int language plpgsql security definer set search_path = ''
as $$
declare v_qty int;
begin
  perform private.require('adjust_stock');
  if p_delta = 0 or abs(p_delta) > 100000 then raise exception 'Số lượng điều chỉnh không hợp lệ' using errcode = '22023'; end if;
  if p_reason not in ('Nhập hàng','Hư hỏng','Thất lạc','Trả hàng','Kiểm kho','Khác') then
    raise exception 'Lý do không hợp lệ' using errcode = '22023';
  end if;
  select qty into v_qty from public.inventory where product_id = p_product_id for update;
  if not found then raise exception 'Không tìm thấy sản phẩm' using errcode = 'P0002'; end if;
  if v_qty + p_delta < 0 then raise exception 'Tồn kho không thể âm (hiện có %)', v_qty using errcode = '22023'; end if;
  update public.inventory set qty = qty + p_delta where product_id = p_product_id returning qty into v_qty;
  insert into public.inventory_movements (product_id, delta, reason, note, created_by)
  values (p_product_id, p_delta, p_reason, nullif(left(btrim(coalesce(p_note, '')), 500), ''), (select auth.uid()));
  return v_qty;
end $$;

create or replace function public.count_set(p_count_id bigint, p_product_id bigint, p_qty int)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require('count_stock');
  if p_qty < 0 or p_qty > 100000 then raise exception 'Số đếm không hợp lệ' using errcode = '22023'; end if;
  update public.stock_count_items i set counted_qty = p_qty, counted_by = (select auth.uid()), counted_at = now()
  from public.stock_counts c
  where i.count_id = c.id and c.id = p_count_id and i.product_id = p_product_id and c.status = 'counting';
  if not found then raise exception 'Đợt kiểm kho đã đóng hoặc không có sản phẩm này' using errcode = '22023'; end if;
end $$;

create or replace function public.count_close(p_count_id bigint)
returns void language plpgsql security definer set search_path = ''
as $$
declare it record;
begin
  if not private.is_owner() then raise exception 'Chỉ chủ shop được chốt kiểm kho' using errcode = '42501'; end if;
  perform 1 from public.stock_counts where id = p_count_id and status <> 'closed' for update;
  if not found then raise exception 'Đợt kiểm kho không tồn tại hoặc đã chốt' using errcode = '22023'; end if;
  for it in select i.product_id, i.counted_qty, inv.qty from public.stock_count_items i
            join public.inventory inv on inv.product_id = i.product_id
            where i.count_id = p_count_id and i.counted_qty is not null and i.counted_qty <> inv.qty
            order by i.product_id
  loop
    update public.inventory set qty = it.counted_qty where product_id = it.product_id;
    insert into public.inventory_movements (product_id, delta, reason, note, created_by)
    values (it.product_id, it.counted_qty - it.qty, 'Kiểm kho', 'Chốt đợt #' || p_count_id, (select auth.uid()));
  end loop;
  update public.stock_counts set status = 'closed', closed_at = now() where id = p_count_id;
end $$;

-- Hàm nhân viên: khách (anon) không được gọi
revoke execute on function public.order_set_status(bigint, public.order_status, text) from public, anon;
revoke execute on function public.order_set_shipping(bigint, bigint, text) from public, anon;
revoke execute on function public.order_mark_paid(bigint) from public, anon;
revoke execute on function public.adjust_stock(bigint, int, text, text) from public, anon;
revoke execute on function public.count_set(bigint, bigint, int) from public, anon;
revoke execute on function public.count_close(bigint) from public, anon;
grant execute on function public.order_set_status(bigint, public.order_status, text) to authenticated;
grant execute on function public.order_set_shipping(bigint, bigint, text) to authenticated;
grant execute on function public.order_mark_paid(bigint) to authenticated;
grant execute on function public.adjust_stock(bigint, int, text, text) to authenticated;
grant execute on function public.count_set(bigint, bigint, int) to authenticated;
grant execute on function public.count_close(bigint) to authenticated;
grant execute on function private.require(text) to authenticated;
