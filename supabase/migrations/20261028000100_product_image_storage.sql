-- Ảnh sản phẩm công khai để storefront hiển thị; chỉ nhân viên có quyền sửa sản phẩm được tải/xóa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  6291456,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "product_images_staff_select"
on storage.objects for select to authenticated
using (bucket_id = 'product-images' and private.has_perm('edit_products'));

create policy "product_images_staff_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-images'
  and private.has_perm('edit_products')
  and (storage.foldername(name))[1] ~ '^[0-9]+$'
  and exists (
    select 1 from public.products p
    where p.id::text = (storage.foldername(name))[1]
  )
);

create policy "product_images_staff_delete"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and private.has_perm('edit_products'));
