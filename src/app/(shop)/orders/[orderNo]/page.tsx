import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatDateTime, formatPrice } from '@/lib/format';
import { requireUser } from '@/server/auth/guards';
import { getOrderDetail, ORDER_STATUS_LABELS } from '@/server/services/order';
import { OrderRowActions } from '../order-actions';

export const metadata: Metadata = { title: '订单详情' };

export default async function OrderDetailPage({ params }: PageProps<'/orders/[orderNo]'>) {
  const { orderNo } = await params;
  const user = await requireUser(`/orders/${orderNo}`);
  const detail = await getOrderDetail(user.id, orderNo);
  if (!detail) notFound();
  const { order, items } = detail;
  const addr = order.addressSnapshot;

  const timeline: { label: string; at: Date | null }[] = [
    { label: '创建订单', at: order.createdAt },
    { label: '支付成功', at: order.paidAt },
    { label: '商家发货', at: order.shippedAt },
    { label: '确认收货', at: order.completedAt },
    ...(order.cancelledAt ? [{ label: '订单取消', at: order.cancelledAt }] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">订单详情</h1>
        <Badge data-testid="order-detail-status">{ORDER_STATUS_LABELS[order.status]}</Badge>
      </div>

      <Card>
        <CardContent className="space-y-1 p-4 text-sm">
          <p>
            订单号：
            <span className="font-mono" data-testid="order-detail-no">
              {order.orderNo}
            </span>
          </p>
          <p className="text-muted-foreground">
            下单渠道：{order.channel === 'web' ? '网页' : 'AI 助手'}
          </p>
          {order.remark ? <p className="text-muted-foreground">备注：{order.remark}</p> : null}
          {order.shipping?.carrier ? (
            <p className="text-muted-foreground" data-testid="order-detail-shipping">
              物流：{order.shipping.carrier} {order.shipping.trackingNo ?? ''}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">状态时间线</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm" data-testid="order-timeline">
            {timeline.map((t) => (
              <li key={t.label} className="flex items-center gap-3">
                <span
                  className={`size-2 rounded-full ${t.at ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                />
                <span className={t.at ? '' : 'text-muted-foreground/60'}>{t.label}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {t.at ? formatDateTime(t.at) : '—'}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">收货信息</CardTitle>
        </CardHeader>
        <CardContent className="text-sm" data-testid="order-detail-address">
          <p>
            {addr.receiver} <span className="text-muted-foreground">{addr.phone}</span>
          </p>
          <p className="text-muted-foreground">
            {addr.province} {addr.city} {addr.district} {addr.detail}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">商品清单</CardTitle>
        </CardHeader>
        <CardContent className="divide-y" data-testid="order-detail-items">
          {items.map((i) => (
            <div
              key={i.id}
              className="flex items-center gap-3 py-3"
              data-testid="order-detail-item"
            >
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                {i.imageSnapshot ? (
                  <Image
                    src={i.imageSnapshot}
                    alt={i.titleSnapshot}
                    fill
                    sizes="56px"
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
                <p data-testid="order-item-price">{formatPrice(i.unitPrice)}</p>
                <p className="text-muted-foreground">×{i.quantity}</p>
              </div>
            </div>
          ))}
          <div className="space-y-1.5 pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">商品合计</span>
              <span data-testid="order-detail-total">{formatPrice(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">运费</span>
              <span data-testid="order-detail-freight">
                {order.freight === 0 ? '免运费' : formatPrice(order.freight)}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex items-baseline justify-between">
              <span>实付</span>
              <span
                className="text-lg font-bold text-red-600"
                data-testid="order-detail-pay-amount"
              >
                {formatPrice(order.payAmount)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <OrderRowActions orderNo={order.orderNo} status={order.status} />
      </div>
    </div>
  );
}
