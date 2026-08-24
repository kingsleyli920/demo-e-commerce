import Link from 'next/link';
import { requireAdmin } from '@/server/auth/guards';
import { Toaster } from '@/components/ui/sonner';
import { logoutAction } from '@/app/(shop)/login/actions';
import { Button } from '@/components/ui/button';

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const user = await requireAdmin('/admin');
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4">
          <Link href="/admin" className="font-semibold" data-testid="admin-logo">
            云集优选 · 管理后台
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/admin" data-testid="admin-nav-dashboard">
              概览
            </Link>
            <Link href="/admin/products" data-testid="admin-nav-products">
              商品
            </Link>
            <Link href="/admin/orders" data-testid="admin-nav-orders">
              订单
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <Link href="/" className="text-muted-foreground">
              返回前台
            </Link>
            <span data-testid="admin-user-name">{user.name}</span>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm" data-testid="admin-logout">
                退出
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6">{children}</main>
      <Toaster />
    </div>
  );
}
