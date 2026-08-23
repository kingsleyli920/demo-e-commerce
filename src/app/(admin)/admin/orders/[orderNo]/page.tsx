import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime, formatPrice } from '@/lib/format';
import { requireAdmin } from '@/server/auth/guards';
import { getAdminOrder } from '@/server/services/admin';
import { ORDER_STATUS_LABELS } from '@/server/services/order';
import { ShipForm } from './ship-form';

export default async function AdminOrderDetailPage({
  params,
}: PageProps<'/admin/orders/[orderNo]'>) {
  await requireAdmin('/admin/orders');
  const { orderNo } = await params;
  const data = await getAdminOrder(orderNo);
  if (!data) notFound();
  const { order, items, buyerName, buyerEmail } = data;
  const addr = order.addressSnapshot;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">
        <Link href="/admin/orders" className="hover:text-primary">
          订单管理
        </Link>{' '}
        / {order.orderNo}
      </p>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">订单详情（后台）</h1>
        <Badge data-testid="admin-order-detail-status">{ORDER_STATUS_LABELS[order.status]}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-1 p-4 text-sm">
          <p>
            订单号：<span className="font-mono">{order.orderNo}</span>
          </p>
          <p className="text-muted-foreground">
            买家：{buyerName}（{buyerEmail}）· 渠道：{order.channel === 'web' ? '网页' : 'AI 助手'}
          </p>
          <p className="text-muted-foreground">
            创建 {formatDateTime(order.createdAt)} · 支付 {formatDateTime(order.paidAt)} · 发货{' '}
            {formatDateTime(order.shippedAt)}
          </p>
          <p className="text-muted-foreground">
            收货：{addr.receiver} {addr.phone} · {addr.province}
            {addr.city}
            {addr.district} {addr.detail}
          </p>
          {order.shipping?.carrier ? (
            <p className="text-muted-foreground" data-testid="admin-order-shipping">
              物流：{order.shipping.carrier} {order.shipping.trackingNo ?? ''}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {order.status === 'PAID' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">发货</CardTitle>
          </CardHeader>
          <CardContent>
            <ShipForm orderNo={order.orderNo} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">商品清单</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {items.map((i) => (
            <div key={i.id} className="flex items-center gap-3 py-3">
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
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-sm">{i.titleSnapshot}</p>
                <p className="text-xs text-muted-foreground">
                  {Object.values(i.specSnapshot).join(' / ')}
                </p>
              </div>
              <div className="text-right text-sm">
                {formatPrice(i.unitPrice)} ×{i.quantity}
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-3 text-sm">
            <span className="text-muted-foreground">
              合计 {formatPrice(order.totalAmount)} + 运费 {formatPrice(order.freight)}
            </span>
            <span className="font-semibold" data-testid="admin-order-pay-amount">
              实付 {formatPrice(order.payAmount)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
