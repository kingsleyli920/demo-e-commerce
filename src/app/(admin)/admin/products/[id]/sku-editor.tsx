'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Sku } from '@/server/db/schema';
import { updateSkuAction } from '../../actions';

function SkuRow({ sku }: { sku: Sku }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const submit = (formData: FormData) =>
    startTransition(async () => {
      const r = await updateSkuAction(undefined, formData);
      if (r.ok) toast.success(r.message ?? '已保存');
      else toast.error(r.message ?? '保存失败');
      router.refresh();
    });

  return (
    <TableRow data-testid="admin-sku-row" data-sku-id={sku.id}>
      <TableCell className="font-mono text-xs">{sku.id}</TableCell>
      <TableCell className="text-sm">{Object.values(sku.spec).join(' / ') || '-'}</TableCell>
      <TableCell colSpan={4} className="p-0">
        <form action={submit} className="flex items-center gap-2 px-2 py-1.5">
          <input type="hidden" name="skuId" value={sku.id} />
          <input
            name="priceYuan"
            type="number"
            step="0.01"
            min={0}
            defaultValue={(sku.price / 100).toFixed(2)}
            className="h-8 w-24 rounded-md border px-2 text-sm"
            aria-label="价格（元）"
            data-testid="sku-price-input"
          />
          <input
            name="originalPriceYuan"
            type="number"
            step="0.01"
            min={0}
            defaultValue={sku.originalPrice !== null ? (sku.originalPrice / 100).toFixed(2) : ''}
            placeholder="划线价"
            className="h-8 w-24 rounded-md border px-2 text-sm"
            aria-label="划线价（元）"
            data-testid="sku-original-price-input"
          />
          <input
            name="stock"
            type="number"
            min={0}
            defaultValue={sku.stock}
            className="h-8 w-20 rounded-md border px-2 text-sm"
            aria-label="库存"
            data-testid="sku-stock-input"
          />
          <span className="text-xs text-muted-foreground">锁定 {sku.lockedStock}</span>
          <Button
            type="submit"
            size="sm"
            variant="secondary"
            disabled={pending}
            data-testid="sku-save"
          >
            保存
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}

export function SkuEditor({ skus }: { skus: Sku[] }) {
  return (
    <div className="rounded-lg border">
      <Table data-testid="admin-sku-table">
        <TableHeader>
          <TableRow>
            <TableHead>SKU</TableHead>
            <TableHead>规格</TableHead>
            <TableHead>价格（元） / 划线价 / 库存</TableHead>
            <TableHead />
            <TableHead />
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {skus.map((s) => (
            <SkuRow key={s.id} sku={s} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
