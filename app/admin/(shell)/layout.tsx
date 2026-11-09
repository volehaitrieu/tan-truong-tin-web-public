import { Sidebar } from "@/components/admin/Sidebar";
import { Topbar } from "@/components/admin/Topbar";
import { MobileTabBar } from "@/components/admin/MobileTabBar";
import { ROLE_LABEL, requireStaff } from "@/lib/auth";

// Mọi trang trong (shell) cần đăng nhập; menu chỉ hiện mục người dùng có quyền.
export default async function AdminShellLayout({ children }: LayoutProps<"/admin">) {
  const staff = await requireStaff();
  const perms = [...staff.perms];
  return (
    <div className="admin-frame flex min-h-dvh bg-ground">
      <Sidebar perms={perms} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={{ name: staff.fullName || ROLE_LABEL[staff.role], role: ROLE_LABEL[staff.role] }} canSell={staff.perms.has("pos_sale")} />
        <main className="admin-sheet min-h-[calc(100dvh-4rem)] flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+88px)] pt-5 md:mx-2 md:mb-2 md:rounded-2xl md:border md:border-line md:bg-white md:px-6 md:pb-8">{children}</main>
      </div>
      <MobileTabBar perms={perms} />
    </div>
  );
}
