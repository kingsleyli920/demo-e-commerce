'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { AdminActionResult } from './actions';
import { expireOrdersAction, toggleProductStatusAction } from './actions';

export function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const exec = (fn: () => Promise<AdminActionResult>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? '操作成功');
      else toast.error(r.message ?? '操作失败');
      router.refresh();
    });
  return { exec, pending };
}

export function ExpireOrdersButton() {
  const { exec, pending } = useAdminAction();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => exec(() => expireOrdersAction())}
      data-testid="expire-orders-button"
    >
      处理超时订单
    </Button>
  );
}

export function ProductStatusToggle({
  productId,
  status,
}: {
  productId: number;
  status: 'on' | 'off';
}) {
  const { exec, pending } = useAdminAction();
  const next = status === 'on' ? 'off' : 'on';
  return (
    <Button
      size="sm"
      variant={status === 'on' ? 'outline' : 'default'}
      disabled={pending}
      onClick={() => exec(() => toggleProductStatusAction(productId, next))}
      data-testid="product-status-toggle"
      data-status={status}
    >
      {status === 'on' ? '下架' : '上架'}
    </Button>
  );
}
