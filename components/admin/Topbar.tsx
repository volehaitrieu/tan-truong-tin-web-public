"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, KeyRound, LogOut, Plus, Search } from "lucide-react";
import { logout } from "@/app/admin/dang-nhap/actions";
import { Logo } from "@/components/brand/Logo";
const labels:Record<string,string>={"san-pham":"Sản phẩm","don-hang":"Đơn hàng","ban-tai-quay":"Bán tại quầy","nhap-excel":"Nhập Excel","ton-kho":"Tồn kho","kiem-kho":"Kiểm kho","danh-muc":"Danh mục & thương hiệu","khuyen-mai":"Khuyến mãi","bao-cao":"Báo cáo","nhan-vien":"Nhân viên & quyền","nhat-ky":"Nhật ký thao tác","cai-dat":"Cài đặt","duyet-ai":"Duyệt gợi ý AI","anh-thong-tin":"Ảnh thông tin sản phẩm","dem":"Đếm kho","doi-mat-khau":"Đổi mật khẩu"};
// Các trang đã có ô tìm riêng lọc ngay khi gõ.
const OWN_SEARCH=["/admin/san-pham","/admin/don-hang","/admin/ton-kho","/admin/ban-tai-quay","/admin/kiem-kho"];
export function Topbar({user,canSell}:{user:{name:string,role:string},canSell:boolean}){
 const pathname=usePathname(); const router=useRouter(); const segments=pathname.split("/").filter(Boolean); const last=segments.at(-1)??"admin";
 const title=pathname.includes("/don-hang/")?"Chi tiết đơn hàng":pathname.includes("/san-pham/")&&!pathname.includes("anh-thong-tin")?"Sửa sản phẩm":labels[last]??"Tổng quan";
 const backHref=pathname.includes("/san-pham/")?"/admin/san-pham":pathname.includes("/don-hang/")?"/admin/don-hang":pathname.includes("/kiem-kho/")?"/admin/kiem-kho":"/admin";
 return <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
  <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">{pathname==="/admin"?<Logo size={30}/>:<><Link href={backHref} aria-label="Quay lại" className="grid size-10 shrink-0 place-items-center rounded-full text-brand"><ArrowLeft className="size-5"/></Link><span className="truncate text-sm font-semibold">{title}</span></>}</div>
  {OWN_SEARCH.some((p)=>pathname.startsWith(p))?<div className="hidden flex-1 md:block"/>:
  // Ô nhảy nhanh: Enter → trang Sản phẩm với kết quả; trang nào có ô tìm riêng (lọc ngay khi gõ) thì ẩn ô này.
  <form role="search" className="relative hidden max-w-md flex-1 md:block" onSubmit={(e)=>{e.preventDefault();const q=new FormData(e.currentTarget).get("q")?.toString().trim();router.push(q?`/admin/san-pham?q=${encodeURIComponent(q)}`:"/admin/san-pham");}}><label><span className="sr-only">Tìm nhanh sản phẩm</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden/><input name="q" type="search" maxLength={80} enterKeyHint="search" placeholder="Tìm sản phẩm: tên, mã, thương hiệu… (Enter)" className="h-10 w-full rounded border border-line bg-ground pl-9 pr-3 text-sm placeholder:text-ink-2/70 focus:border-brand focus:bg-surface"/></label></form>}
  <div className="ml-auto flex items-center gap-2">{canSell&&<Link href="/admin/ban-tai-quay" className="hidden h-10 items-center gap-1.5 rounded bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-deep md:flex"><Plus className="size-4" aria-hidden/>Tạo đơn mới</Link>}<span className="hidden items-center gap-2 border-l border-line pl-3 sm:flex"><span className="grid size-8 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand">{(user.name||"?").charAt(0).toUpperCase()}</span><span className="flex flex-col leading-tight"><span className="text-sm font-semibold">{user.name}</span><span className="text-xs text-ink-2">{user.role}</span></span></span><Link href="/admin/doi-mat-khau" aria-label="Đổi mật khẩu" title="Đổi mật khẩu" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-sunk hover:text-brand"><KeyRound className="size-5" aria-hidden/></Link><form action={logout}><button type="submit" aria-label="Đăng xuất" title="Đăng xuất" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-sunk hover:text-danger"><LogOut className="size-5" aria-hidden/></button></form></div>
 </header>
}
