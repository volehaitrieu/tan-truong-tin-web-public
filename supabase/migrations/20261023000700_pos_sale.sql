-- Bán tại quầy: tạo đơn đã hoàn thành + đã thu tiền, trừ tồn ngay (có khóa dòng). Quyền: pos_sale.
create or replace function public.pos_create_order(p_items jsonb, p_phone text default null, p_name text default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_id bigint; v_code text; v_total bigint := 0; r record; v_have int; v_take int; v_short boolean := false;
begin
  perform private.require('pos_sale');
  if v_phone is not null then
    v_phone := private.normalize_phone(v_phone);
    if v_phone is null then raise exception 'Số điện thoại khách cần 10 số, bắt đầu bằng 0.' using errcode = '22023'; end if;
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception 'Chưa chọn sản phẩm.' using errcode = '22023';
  end if;
  for r in select e->>'qty' q from jsonb_array_elements(p_items) e loop
    if r.q is null or r.q !~ '^[0-9]{1,4}$' or r.q::int < 1 then raise exception 'Số lượng không hợp lệ.' using errcode = '22023'; end if;
  end loop;

  v_code := 'TTT' || lpad(nextval('public.order_code_seq')::text, 6, '0');
  insert into public.orders (code, customer_name, phone, delivery, payment_method, payment_status, subtotal, shipping_fee, status, created_by)
  values (v_code, coalesce(nullif(btrim(coalesce(p_name, '')), ''), 'Khách tại quầy'), coalesce(v_phone, '0000000000'),
          'counter', 'cash', 'paid', 0, 0, 'completed', (select auth.uid()))
  returning id into v_id;

  for r in
    select p.id, p.sku, p.name, p.unit, private.effective_price(p.price, p.sale_price, p.sale_from, p.sale_to) as price,
           sum((e->>'qty')::int)::int as qty
    from jsonb_array_elements(p_items) e join public.products p on p.id = (e->>'product_id')::bigint
    group by p.id order by p.id
  loop
    insert into public.order_items (order_id, product_id, sku, name, unit, unit_price, qty) values (v_id, r.id, r.sku, r.name, r.unit, r.price, least(r.qty, 999));
    v_total := v_total + r.price * least(r.qty, 999);
    select qty into v_have from public.inventory where product_id = r.id for update;
    v_take := least(coalesce(v_have, 0), r.qty);
    v_short := v_short or v_take < r.qty;
    if v_take > 0 then
      update public.inventory set qty = qty - v_take where product_id = r.id;
      insert into public.inventory_movements (product_id, delta, reason, order_id, created_by) values (r.id, -v_take, 'Bán hàng', v_id, (select auth.uid()));
    end if;
  end loop;
  if v_total = 0 and not exists (select 1 from public.order_items where order_id = v_id) then
    raise exception 'Sản phẩm không hợp lệ.' using errcode = '22023';
  end if;
  update public.orders set subtotal = v_total, needs_restock = v_short where id = v_id;
  insert into public.order_events (order_id, type, note, created_by) values (v_id, 'created', 'Bán tại quầy', (select auth.uid()));
  return jsonb_build_object('code', v_code, 'total', v_total, 'short', v_short);
end $$;
revoke execute on function public.pos_create_order(jsonb, text, text) from public, anon;
grant execute on function public.pos_create_order(jsonb, text, text) to authenticated;
-- SĐT "0000000000" = khách vãng lai (đơn tại quầy không bắt buộc SĐT)
