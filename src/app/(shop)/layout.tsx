import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { Toaster } from '@/components/ui/sonner';
import { getCurrentUser } from '@/server/auth/guards';
import { getCartBadgeCount } from '@/server/services/cart';

export default async function ShopLayout({ children }: LayoutProps<'/'>) {
  const user = await getCurrentUser();
  const cartCount = user ? await getCartBadgeCount(user.id) : 0;
  return (
    <>
      <SiteHeader user={user} cartCount={cartCount} />
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6">{children}</main>
      <SiteFooter />
      <Toaster />
    </>
  );
}
