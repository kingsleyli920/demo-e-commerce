'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

function useCountdown(expireAt: string) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(expireAt).getTime() - Date.now()));
  useEffect(() => {
    const t = setInterval(
      () => setLeft(Math.max(0, new Date(expireAt).getTime() - Date.now())),
      1000,
    );
    return () => clearInterval(t);
  }, [expireAt]);
  const mm = String(Math.floor(left / 60000)).padStart(2, '0');
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
  return { left, text: `${mm}:${ss}` };
}

export function PayClient({ orderNo, expireAt }: { orderNo: string; expireAt: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { left, text } = useCountdown(expireAt);

  useEffect(() => {
    if (left === 0) {
      // 到期后刷新：服务端会惰性取消
      const t = setTimeout(() => router.refresh(), 1200);
      return () => clearTimeout(t);
    }
  }, [left, router]);

  const pay = (result: 'success' | 'fail') =>
    startTransition(async () => {
      const transactionNo = `MOCK${Date.now()}${Math.floor(Math.random() * 1000)}`;
      const res = await fetch('/api/pay/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNo, result, transactionNo }),
      });
      const data = (await res.json().catch(() => ({}))) as { payStatus?: string; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? '支付请求失败');
        router.refresh();
        return;
      }
      if (data.payStatus === 'SUCCESS') {
        toast.success('支付成功');
        router.push(`/orders/${orderNo}`);
      } else {
        toast.error('支付失败，请重试');
        router.refresh();
      }
    });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        请在{' '}
        <span
          className="font-mono text-base font-semibold text-red-600"
          data-testid="pay-countdown"
        >
          {text}
        </span>{' '}
        内完成支付，超时订单将自动取消
      </p>
      <div className="flex gap-3">
        <Button
          size="lg"
          disabled={pending || left === 0}
          onClick={() => pay('success')}
          data-testid="pay-success"
        >
          模拟支付成功
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={pending || left === 0}
          onClick={() => pay('fail')}
          data-testid="pay-fail"
        >
          模拟支付失败
        </Button>
      </div>
    </div>
  );
}
