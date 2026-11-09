-- Chống spam báo giá bằng nhiều SĐT: tối đa 20 yêu cầu / 10 phút trên toàn shop (ngoài giới hạn 3/SĐT)
create or replace function public.submit_quote(p_items text, p_phone text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_phone text := private.normalize_phone(p_phone);
begin
  if v_phone is null then raise exception 'Số điện thoại cần 10 số, bắt đầu bằng 0.' using errcode = '22023'; end if;
  if p_items is null or length(btrim(p_items)) < 3 or length(p_items) > 2000 then
    raise exception 'Ghi ít nhất một món và số lượng.' using errcode = '22023';
  end if;
  if (select count(*) from public.quote_requests where phone = v_phone and created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from public.quote_requests where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Shop đang nhận nhiều yêu cầu. Vui lòng thử lại sau ít phút hoặc gọi 0948 732 064.' using errcode = '54000';
  end if;
  insert into public.quote_requests (items, phone) values (btrim(p_items), v_phone);
end $$;
