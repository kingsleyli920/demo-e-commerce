import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/server/auth/guards';
import { isAppError } from '@/server/errors';
import { previewCheckout, type CheckoutSource } from '@/server/services/checkout';
import { CheckoutForm } from './checkout-form';

export const metadata: Metadata = { title: '结算' };

export default async function CheckoutPage({ searchParams }: PageProps<'/checkout'>) {
  const user = await requireUser('/checkout');
  const sp = await searchParams;
  const skuId = typeof sp.sku === 'string' ? Number(sp.sku) : undefined;
  const qty = typeof sp.qty === 'string' ? Number(sp.qty) : 1;
  const source: CheckoutSource =
    skuId && Number.isInteger(skuId) && skuId > 0
      ? { type: 'buyNow', skuId, quantity: Number.isInteger(qty) && qty > 0 ? qty : 1 }
      : { type: 'cart' };

  let preview;
  try {
    preview = await previewCheckout(user.id, source);
  } catch (e) {
    if (isAppError(e)) {
      return (
        <div
          className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-24"
          data-testid="checkout-error"
        >
          <p className="text-muted-foreground">{e.message}</p>
          <Button asChild variant="outline">
            <Link href="/cart">返回购物车</Link>
          </Button>
        </div>
      );
    }
    throw e;
  }

  if (preview.addresses.length === 0) {
    const next =
      source.type === 'buyNow'
        ? `/checkout?sku=${source.skuId}&qty=${source.quantity}`
        : '/checkout';
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-24"
        data-testid="checkout-no-address"
      >
        <p className="text-muted-foreground">还没有收货地址，请先新增一个收货地址</p>
        <Button asChild data-testid="go-add-address">
          <Link href={`/account/addresses?next=${encodeURIComponent(next)}`}>去新增地址</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">确认订单</h1>
      <CheckoutForm
        preview={preview}
        sourceType={source.type}
        skuId={source.type === 'buyNow' ? source.skuId : undefined}
        quantity={source.type === 'buyNow' ? source.quantity : undefined}
      />
    </div>
  );
}
