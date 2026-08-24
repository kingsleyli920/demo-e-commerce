import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime, formatPrice } from '@/lib/format';
import { requireUser } from '@/server/auth/guards';
import type { OrderStatus } from '@/server/db/schema';
import { listOrders, ORDER_STATUS_LABELS, type OrderTab } from '@/server/services/order';
import { OrderRowActions } from './order-actions';

export const metadata: Metadata = { title: '我的订单' };

const TABS: OrderTab[] = ['ALL', 'PENDING_PAYMENT', 'PAID', 'SHIPPED', 'COMPLETED', 'CANCELLED'];
const TAB_LABELS: Record<OrderTab, string> = { ALL: '全部', ...ORDER_STATUS_LABELS };

const STATUS_BADGE: Record<OrderStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  PENDING_PAYMENT: 'destructive',
  PAID: 'default',
  SHIPPED: 'default',
  COMPLETED: 'secondary',
  CANCELLED: 'outline',
};

export default async function OrdersPage({ searchParams }: PageProps<'/orders'>) {
  const user = await requireUser('/orders');
  const sp = await searchParams;
  const tabParam =
    typeof sp.tab === 'string' && (TABS as string[]).includes(sp.tab)
      ? (sp.tab as OrderTab)
      : 'ALL';
  const { orders, counts } = await listOrders(user.id, {
    status: tabParam === 'ALL' ? undefined : tabParam,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">我的订单</h1>
      <nav className="flex flex-wrap gap-1 border-b" data-testid="order-tabs">
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === 'ALL' ? '/orders' : `/orders?tab=${t}`}
            className={`border-b-2 px-3 py-2 text-sm ${
              tabParam === t
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid={`order-tab-${t}`}
          >
            {TAB_LABELS[t]}（{counts[t]}）
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p
          className="rounded-lg border border-dashed py-20 text-center text-muted-foreground"
          data-testid="orders-empty"
        >
          暂无相关订单
        </p>
      ) : (
        <div className="space-y-3" data-testid="order-list">
          {orders.map((o) => (
            <Card key={o.id} data-testid="order-card" data-order-no={o.orderNo}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-mono text-muted-foreground" data-testid="order-card-no">
                    {o.orderNo}
                  </span>
                  <span className="text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                  <Badge
                    variant={STATUS_BADGE[o.status]}
                    className="ml-auto"
                    data-testid="order-card-status"
                  >
                    {ORDER_STATUS_LABELS[o.status]}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 gap-2 overflow-x-auto">
                    {o.items.map((i) => (
                      <div key={i.id} className="flex min-w-52 items-center gap-2">
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
                          {i.imageSnapshot ? (
                            <Image
                              src={i.imageSnapshot}
                              alt={i.titleSnapshot}
                              fill
                              sizes="48px"
                              className="object-contain p-1"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="line-clamp-1 text-sm">{i.titleSnapshot}</p>
                          <p className="text-xs text-muted-foreground">
                            {Object.values(i.specSnapshot).join('/')} ×{i.quantity}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold" data-testid="order-card-amount">
                      {formatPrice(o.payAmount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      共 {o.items.reduce((n, i) => n + i.quantity, 0)} 件
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <OrderRowActions orderNo={o.orderNo} status={o.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
