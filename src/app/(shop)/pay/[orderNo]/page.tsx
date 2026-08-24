import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPrice } from '@/lib/format';
import { requireUser } from '@/server/auth/guards';
import { getOrderDetail } from '@/server/services/order';
import { PayClient } from './pay-client';

export const metadata: Metadata = { title: '收银台' };

export default async function PayPage({ params }: PageProps<'/pay/[orderNo]'>) {
  const { orderNo } = await params;
  const user = await requireUser(`/pay/${orderNo}`);
  const detail = await getOrderDetail(user.id, orderNo);
  if (!detail) notFound();
  const { order, items } = detail;
  if (order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'COMPLETED') {
    redirect(`/orders/${order.orderNo}`);
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-6 py-8">
      <Card>
        <CardHeader>
          <CardTitle>收银台</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              订单号：
              <span className="font-mono" data-testid="pay-order-no">
                {order.orderNo}
              </span>
            </p>
            <p className="text-muted-foreground">
              共 {items.reduce((n, i) => n + i.quantity, 0)} 件商品
            </p>
            <p className="pt-2 text-2xl font-bold text-red-600" data-testid="pay-amount">
              {formatPrice(order.payAmount)}
            </p>
          </div>
          {order.status === 'CANCELLED' ? (
            <div className="space-y-3" data-testid="pay-cancelled">
              <p className="text-muted-foreground">
                订单已取消（超时未支付或已手动取消），请重新下单。
              </p>
              <Button asChild variant="outline">
                <Link href="/orders?tab=CANCELLED">查看订单</Link>
              </Button>
            </div>
          ) : (
            <PayClient orderNo={order.orderNo} expireAt={order.expireAt.toISOString()} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
