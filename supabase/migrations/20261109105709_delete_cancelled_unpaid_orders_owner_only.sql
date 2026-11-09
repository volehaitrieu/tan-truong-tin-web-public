-- Cho phep chu shop xoa tung don da huy, chua thanh toan.
-- RLS la hang rao cuoi; giao dien va Server Action cung kiem tra lai dieu kien.
create policy orders_delete_cancelled_unpaid_owner
  on public.orders for delete to authenticated
  using (private.is_owner() and status = 'cancelled' and payment_status = 'unpaid');

-- Ghi nhat ky xoa toi thieu, khong sao chep ten, so dien thoai hay dia chi khach vao audit_log.
create or replace function private.audit_order_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return old; end if;
  insert into public.audit_log (actor, action, target, details)
  values (
    (select auth.uid()),
    'delete:orders',
    old.code,
    jsonb_build_object(
      'status', old.status::text,
      'payment_status', old.payment_status,
      'subtotal', old.subtotal,
      'shipping_fee', old.shipping_fee,
      'created_at', old.created_at
    )
  );
  return old;
end
$$;
revoke all on function private.audit_order_delete() from public, anon, authenticated;
create trigger audit_orders_delete after delete on public.orders
  for each row execute function private.audit_order_delete();
