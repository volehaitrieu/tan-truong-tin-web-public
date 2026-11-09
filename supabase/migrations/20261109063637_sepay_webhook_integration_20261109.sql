-- ĐÃ ÁP DỤNG 09/11/2026 theo duyệt của chủ shop.
-- Supabase migration: 20261109063637_sepay_webhook_integration_20261109.
-- Hash place_order trước khi áp dụng: bc4b8e022efa97f34cddb847a6b2ad1a; sau áp dụng: af2db53d3ea2ad9fb0ea9f9b8dbb0123.
-- Chỉ bổ sung nhận webhook HMAC-SHA256 và phương thức chuyển khoản; không sửa đơn cũ, không tạo giao dịch, không dùng service-role.

begin;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cod', 'cash', 'bank'));

create table private.sepay_webhook_config (
  id boolean primary key default true check (id),
  secret text not null check (length(secret) between 24 and 500),
  updated_at timestamptz not null default now()
);
alter table private.sepay_webhook_config enable row level security;
revoke all on private.sepay_webhook_config from public, anon, authenticated;

create table public.sepay_transactions (
  id bigint generated always as identity primary key,
  transaction_id text not null unique check (length(transaction_id) between 1 and 100),
  account_number text not null,
  transfer_amount bigint not null check (transfer_amount >= 0),
  transfer_type text not null check (transfer_type in ('in', 'out')),
  payment_code text,
  content text,
  order_id bigint references public.orders(id) on delete set null,
  status text not null check (status in ('matched', 'review', 'ignored')),
  review_reason text,
  raw_payload jsonb not null,
  created_at timestamptz not null default now()
);
create index sepay_transactions_created_idx on public.sepay_transactions(created_at desc);
create index sepay_transactions_order_idx on public.sepay_transactions(order_id);
alter table public.sepay_transactions enable row level security;
create policy sepay_transactions_staff_read on public.sepay_transactions
  for select to authenticated using (private.has_perm('process_orders'));
revoke all on public.sepay_transactions from public, anon, authenticated;
grant select on public.sepay_transactions to authenticated;

create or replace function public.sepay_webhook_is_configured()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.sepay_webhook_config where id = true); $$;
revoke all on function public.sepay_webhook_is_configured() from public;
grant execute on function public.sepay_webhook_is_configured() to anon, authenticated;

create or replace function public.sepay_set_webhook_secret(p_secret text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require('settings');
  if p_secret is null or length(p_secret) < 24 or length(p_secret) > 500 then
    raise exception 'Mã bảo mật SePay không hợp lệ' using errcode = '22023';
  end if;
  insert into private.sepay_webhook_config(id, secret, updated_at)
  values (true, p_secret, now())
  on conflict (id) do update set secret = excluded.secret, updated_at = excluded.updated_at;
  insert into public.audit_log(actor, action, target, details)
  values (auth.uid(), 'update:settings', 'sepay_webhook_secret', jsonb_build_object('configured', true));
end $$;
revoke all on function public.sepay_set_webhook_secret(text) from public, anon;
grant execute on function public.sepay_set_webhook_secret(text) to authenticated;

create or replace function public.sepay_receive(p_raw_body text, p_timestamp text, p_signature text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_secret text;
  v_expected text;
  v_received text;
  v_ts bigint;
  v_event jsonb;
  v_id text;
  v_account text;
  v_type text;
  v_amount bigint;
  v_code text;
  v_content text;
  v_bank_account text;
  v_order public.orders%rowtype;
  v_payment_id bigint;
  v_reason text;
begin
  if p_raw_body is null or p_timestamp is null or p_signature is null or length(p_raw_body) > 16384
     or p_timestamp !~ '^[0-9]{1,12}$' then
    raise exception 'Webhook không hợp lệ' using errcode = '22023';
  end if;
  v_ts := p_timestamp::bigint;
  if abs(extract(epoch from clock_timestamp())::bigint - v_ts) > 300 then
    raise exception 'Timestamp webhook hết hạn' using errcode = '28000';
  end if;
  v_received := substring(coalesce(p_signature, '') from '^sha256=([0-9a-fA-F]{64})$');
  if v_received is null then raise exception 'Chữ ký webhook không hợp lệ' using errcode = '28000'; end if;
  select secret into v_secret from private.sepay_webhook_config where id = true;
  if v_secret is null then raise exception 'Chưa cài secret webhook' using errcode = '28000'; end if;
  v_expected := encode(extensions.hmac(convert_to(p_timestamp || '.' || p_raw_body, 'UTF8'), convert_to(v_secret, 'UTF8'), 'sha256'), 'hex');
  if lower(v_received) <> v_expected then raise exception 'Chữ ký webhook không hợp lệ' using errcode = '28000'; end if;

  begin v_event := p_raw_body::jsonb;
  exception when others then raise exception 'Nội dung webhook không phải JSON hợp lệ' using errcode = '22023'; end;
  v_id := coalesce(v_event->>'id', '');
  v_account := coalesce(v_event->>'accountNumber', '');
  v_type := lower(coalesce(v_event->>'transferType', ''));
  if v_id = '' or length(v_id) > 100 or v_account !~ '^[0-9]{6,24}$'
     or v_type not in ('in', 'out') or coalesce(v_event->>'transferAmount', '') !~ '^[0-9]{1,15}$' then
    raise exception 'Thiếu thông tin giao dịch SePay' using errcode = '22023';
  end if;
  v_amount := (v_event->>'transferAmount')::bigint;
  v_content := left(coalesce(v_event->>'content', ''), 2000);
  v_code := substring(upper(coalesce(v_event->>'code', '') || ' ' || v_content) from '(TTT[0-9]{6})');
  select bank->>'account_no' into v_bank_account from public.settings where id = 1;

  v_reason := case
    when v_type <> 'in' then 'Giao dịch không phải tiền vào'
    when v_bank_account is null or v_account <> v_bank_account then 'Tài khoản nhận không khớp tài khoản shop'
    when v_code is null then 'Không tìm thấy mã đơn trong nội dung chuyển khoản'
    else null end;
  insert into public.sepay_transactions(transaction_id, account_number, transfer_amount, transfer_type, payment_code, content, status, review_reason, raw_payload)
  values (v_id, v_account, v_amount, v_type, v_code, v_content, 'review', v_reason, v_event)
  on conflict (transaction_id) do nothing
  returning id into v_payment_id;
  if v_payment_id is null then return jsonb_build_object('success', true, 'duplicate', true); end if;
  if v_reason is not null then return jsonb_build_object('success', true, 'review', true); end if;

  select * into v_order from public.orders where code = v_code for update;
  if not found then v_reason := 'Mã đơn không tồn tại';
  elsif v_order.payment_method <> 'bank' then v_reason := 'Đơn không chọn chuyển khoản';
  elsif v_order.status = 'cancelled' then v_reason := 'Đơn đã bị hủy';
  elsif v_order.payment_status = 'paid' then v_reason := 'Đơn đã được ghi nhận thanh toán trước đó';
  elsif v_order.shipping_fee is null then v_reason := 'Đơn chưa có phí giao hàng để chốt tổng tiền';
  elsif v_amount <> v_order.subtotal + v_order.shipping_fee then v_reason := 'Số tiền chuyển không khớp tổng tiền đơn';
  else v_reason := null;
  end if;

  if v_reason is not null then
    update public.sepay_transactions set order_id = v_order.id, review_reason = v_reason where id = v_payment_id;
    return jsonb_build_object('success', true, 'review', true);
  end if;

  update public.orders set payment_status = 'paid', updated_at = now() where id = v_order.id;
  insert into public.order_events(order_id, type, note)
  values (v_order.id, 'paid', 'SePay · giao dịch ' || v_id);
  update public.sepay_transactions set order_id = v_order.id, status = 'matched', review_reason = null where id = v_payment_id;
  return jsonb_build_object('success', true, 'matched', true);
end $$;
revoke all on function public.sepay_receive(text, text, text) from public;
grant execute on function public.sepay_receive(text, text, text) to anon, authenticated;

-- Cập nhật an toàn hàm place_order hiện có mà không thay phần kiểm kho/giá/phí.
do $patch$
declare
  v_definition text;
  v_marker_note text := 'v_note text := nullif(btrim(coalesce(payload->>''note'','''')),'''');';
  v_marker_begin text := 'BEGIN IF v_name';
  v_marker_insert text := 'INSERT INTO public.orders(code,customer_name,phone,email,delivery,province,ward,street,note,subtotal,shipping_fee)';
  v_marker_values text := 'VALUES(v_code,v_name,v_phone,v_email,v_delivery,v_province,v_ward,v_street,v_note,0,v_fee)';
begin
  v_definition := pg_get_functiondef('public.place_order(jsonb)'::regprocedure);
  if md5(replace(v_definition, E'\r\n', E'\n')) <> 'bc4b8e022efa97f34cddb847a6b2ad1a' then
    raise exception 'place_order đã thay đổi; dừng và đối chiếu hash trước khi áp dụng';
  end if;
  if (length(v_definition) - length(replace(v_definition, v_marker_note, ''))) / length(v_marker_note) <> 1
     or (length(v_definition) - length(replace(v_definition, v_marker_begin, ''))) / length(v_marker_begin) <> 1
     or (length(v_definition) - length(replace(v_definition, v_marker_insert, ''))) / length(v_marker_insert) <> 1
     or (length(v_definition) - length(replace(v_definition, v_marker_values, ''))) / length(v_marker_values) <> 1 then
    raise exception 'Không tìm thấy duy nhất các vị trí payment_method trong place_order';
  end if;
  v_definition := replace(v_definition, v_marker_note,
    v_marker_note || ' v_payment_method text := lower(coalesce(payload->>''pay'',''cod''));');
  v_definition := replace(v_definition, v_marker_begin,
    'BEGIN IF v_payment_method NOT IN (''cod'',''bank'') THEN RAISE EXCEPTION ''Phương thức thanh toán không hợp lệ'' USING errcode=''22023''; END IF; IF v_payment_method=''bank'' AND NOT EXISTS (SELECT 1 FROM public.settings WHERE id=1 AND (bank->>''bin'') ~ ''^[0-9]{6}$'' AND (bank->>''account_no'') ~ ''^[0-9]{6,19}$'') THEN RAISE EXCEPTION ''Shop chưa bật chuyển khoản'' USING errcode=''22023''; END IF; IF v_name');
  v_definition := replace(v_definition, v_marker_insert,
    'INSERT INTO public.orders(code,customer_name,phone,email,delivery,province,ward,street,note,payment_method,subtotal,shipping_fee)');
  v_definition := replace(v_definition, v_marker_values,
    'VALUES(v_code,v_name,v_phone,v_email,v_delivery,v_province,v_ward,v_street,v_note,v_payment_method,0,v_fee)');
  execute v_definition;
end $patch$;

commit;
