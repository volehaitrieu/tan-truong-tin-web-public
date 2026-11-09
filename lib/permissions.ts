// Danh sách quyền — khớp bảng public.permissions trong Supabase.
export type Permission =
  | "view_cost" | "edit_products" | "edit_price" | "adjust_stock" | "count_stock" | "import_excel"
  | "process_orders" | "cancel_orders" | "discount_orders" | "pos_sale" | "view_reports" | "view_profit"
  | "manage_staff" | "settings" | "view_audit";
