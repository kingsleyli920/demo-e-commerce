import type { Metadata } from 'next';
import { requireUser } from '@/server/auth/guards';
import { listCart } from '@/server/services/cart';
import { CartViewClient } from './cart-view';

export const metadata: Metadata = { title: '购物车' };

export default async function CartPage() {
  const user = await requireUser('/cart');
  const view = await listCart(user.id);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">购物车</h1>
      <CartViewClient view={view} />
    </div>
  );
}
