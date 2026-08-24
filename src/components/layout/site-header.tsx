import { LogOut, Package, ShoppingCart, Store, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutAction } from '@/app/(shop)/login/actions';
import type { AuthUser } from '@/server/auth/auth';
import { SearchBox } from './search-box';

export function SiteHeader({ user, cartCount }: { user: AuthUser | null; cartCount: number }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold" data-testid="site-logo">
          <Store className="size-5" />
          <span>云集优选</span>
        </Link>
        <div className="hidden flex-1 md:block">
          <SearchBox />
        </div>
        <nav className="ml-auto flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/cart" data-testid="header-cart-link" className="relative">
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">购物车</span>
              {cartCount > 0 ? (
                <Badge
                  className="absolute -top-1 -right-1 h-5 min-w-5 justify-center rounded-full px-1 text-[10px]"
                  data-testid="header-cart-badge"
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </Badge>
              ) : null}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/orders" data-testid="header-orders-link">
              <Package className="size-4" />
              <span className="hidden sm:inline">订单</span>
            </Link>
          </Button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="header-user-menu">
                  <UserIcon className="size-4" />
                  <span data-testid="header-user-name">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/orders">我的订单</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/account/addresses">收货地址</Link>
                </DropdownMenuItem>
                {user.role === 'admin' ? (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" data-testid="header-admin-link">
                      管理后台
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full" data-testid="header-logout">
                      <LogOut className="size-4" />
                      退出登录
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm">
              <Link href="/login" data-testid="header-login-link">
                登录
              </Link>
            </Button>
          )}
        </nav>
      </div>
      <div className="border-t px-4 py-2 md:hidden">
        <SearchBox />
      </div>
    </header>
  );
}
