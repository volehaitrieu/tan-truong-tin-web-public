-- Chặn tra cứu đơn khách vãng lai (SĐT 0000000000) — tránh đoán mã đơn rồi xem đơn tại quầy
create or replace function public.lookup_order(p_code text, p_phone text)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare o public.orders; v_phone text := private.normalize_phone(p_phone);
begin
  if v_phone is null or v_phone = '0000000000' then return null; end if;
  select * into o from public.orders where code = upper(btrim(p_code)) and phone = v_phone;
  if not found then return null; end if;
  return jsonb_build_object(
    'code', o.code, 'status', o.status, 'delivery', o.delivery, 'subtotal', o.subtotal,
    'shipping_fee', o.shipping_fee, 'tracking_code', o.tracking_code, 'created_at', o.created_at,
    'items', (select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'unit_price', unit_price) order by id)
              from public.order_items where order_id = o.id));
end $$;
