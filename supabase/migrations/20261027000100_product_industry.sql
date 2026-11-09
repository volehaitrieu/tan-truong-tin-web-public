-- Ngành hàng phân nhóm sản phẩm độc lập với danh mục.
alter table public.products add column if not exists industry text
  check (industry is null or length(industry) <= 80);

alter table public.import_changes drop constraint if exists import_changes_field_check;
alter table public.import_changes add constraint import_changes_field_check
  check (field in ('name','unit','price','import_price','category','industry','brand','location','min_qty','spec','description','warranty','origin','made_in'));

-- Ngành hàng nằm trong cấu trúc danh mục gia dụng; Quạt và Ấm siêu tốc là danh mục con.
update public.categories as child
set parent_id = parent.id
from public.categories as parent
where child.slug = 'quat'
  and parent.slug = 'gia-dung'
  and child.parent_id is null;

-- Giữ nguyên slug để các liên kết cũ đến danh mục vẫn hoạt động.
update public.categories
set name = 'Ấm siêu tốc'
where slug = 'am-binh-dun'
  and name <> 'Ấm siêu tốc';
