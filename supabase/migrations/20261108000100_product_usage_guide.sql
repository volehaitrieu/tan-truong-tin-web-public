-- Hướng dẫn sử dụng hiện ở trang sản phẩm (chủ shop chọn mẫu H2, 08/11/2026): mỗi dòng một bước, tối đa 3.000 ký tự.
-- Chỉ thêm cột (cho phép trống) và cho phép trường mới trong bảng đối chiếu nhập Excel. Không đổi dữ liệu hiện có.
alter table public.products add column if not exists usage_guide text
  check (usage_guide is null or length(usage_guide) <= 3000);

alter table public.import_changes drop constraint import_changes_field_check;
alter table public.import_changes add constraint import_changes_field_check
  check (field = any (array['name','unit','price','import_price','category','classifications','industry','brand','location','min_qty','qty','spec','description','usage_guide','warranty','origin','made_in']));

-- Hoàn tác (nếu cần): alter table public.products drop column usage_guide;
--   rồi trả ràng buộc import_changes_field_check về danh sách không có 'usage_guide'.
