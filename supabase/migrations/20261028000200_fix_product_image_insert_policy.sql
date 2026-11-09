-- Sửa policy tải ảnh của 20261028000100: trong truy vấn con, `name` không ghi bảng nên Postgres hiểu là
-- products.name (tên sản phẩm) thay vì storage.objects.name (đường dẫn ảnh) → điều kiện luôn sai, mọi lần tải bị chặn.
drop policy if exists "product_images_staff_insert" on storage.objects;

create policy "product_images_staff_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and private.has_perm('edit_products')
  and (storage.foldername(objects.name))[1] ~ '^[0-9]+$'
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(objects.name))[1]
  )
);
