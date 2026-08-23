'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { OrderStatus } from '@/server/db/schema';
import { cancelOrderAction, confirmReceiptAction } from './actions';

export function OrderRowActions({ orderNo, status }: { orderNo: string; status: OrderStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? '操作成功');
      else toast.error(r.message ?? '操作失败');
      router.refresh();
    });

  return (
    <div className="flex gap-2">
      {status === 'PENDING_PAYMENT' ? (
        <>
          <Button asChild size="sm" data-testid="order-go-pay">
            <Link href={`/pay/${orderNo}`}>去支付</Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => cancelOrderAction(orderNo))}
            data-testid="order-cancel"
          >
            取消订单
          </Button>
        </>
      ) : null}
      {status === 'SHIPPED' ? (
        <Button
          size="sm"
          disabled={pending}
          onClick={() => run(() => confirmReceiptAction(orderNo))}
          data-testid="order-confirm-receipt"
        >
          确认收货
        </Button>
      ) : null}
      <Button asChild size="sm" variant="ghost" data-testid="order-view-detail">
        <Link href={`/orders/${orderNo}`}>查看详情</Link>
      </Button>
    </div>
  );
}
