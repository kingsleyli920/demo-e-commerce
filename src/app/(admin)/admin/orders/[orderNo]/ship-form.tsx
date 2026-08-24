'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { shipOrderAction } from '../../actions';

export function ShipForm({ orderNo }: { orderNo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const submit = (formData: FormData) =>
    startTransition(async () => {
      const r = await shipOrderAction(undefined, formData);
      if (r.ok) toast.success(r.message ?? '已发货');
      else toast.error(r.message ?? '发货失败');
      router.refresh();
    });

  return (
    <form action={submit} className="flex flex-wrap items-center gap-2" data-testid="ship-form">
      <input type="hidden" name="orderNo" value={orderNo} />
      <Input
        name="carrier"
        placeholder="承运商（选填）"
        defaultValue="顺丰速运"
        className="w-40"
        data-testid="ship-carrier"
      />
      <Input
        name="trackingNo"
        placeholder="运单号（选填）"
        className="w-48"
        data-testid="ship-tracking-no"
      />
      <Button type="submit" disabled={pending} data-testid="ship-submit">
        模拟发货
      </Button>
    </form>
  );
}
