-- Chạy migration này trước khi deploy chức năng nhập Excel đọc cột Tồn.
alter table public.import_changes drop constraint import_changes_field_check;
alter table public.import_changes add constraint import_changes_field_check
  check (field = any (array['name','unit','price','import_price','category','industry','brand','location','min_qty','qty','spec','description','warranty','origin','made_in']));
