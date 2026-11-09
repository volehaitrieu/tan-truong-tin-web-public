import { StoreShell } from "@/components/storefront/StoreShell";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return <StoreShell>{children}</StoreShell>;
}
