-- Cho phép xóa sản phẩm (chủ shop chốt 29/10, thay quy tắc cũ "không có xóa, chỉ Ẩn" ở core_schema).
-- Cùng quyền với sửa/tạo SP. Ảnh, giá nhập, tồn kho, lịch sử kho tự xóa theo (ON DELETE CASCADE);
-- SP đã có trong đơn hàng vẫn bị khóa ngoại order_items chặn, và deleteProduct cũng kiểm trước.
create policy products_delete on public.products for delete to authenticated
  using (private.has_perm('edit_products'));
