'use client';

import { Minus, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPrice } from '@/lib/format';
import type { CartLine, CartView } from '@/server/services/cart';
import {
  removeItemAction,
  setAllSelectedAction,
  setSelectedAction,
  updateQuantityAction,
  type CartActionResult,
} from './actions';

function useCartAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const exec = (fn: () => Promise<CartActionResult>) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.message ?? '操作失败');
      else if (r.message) toast.warning(r.message);
      router.refresh();
    });
  return { exec, pending };
}

function CartRow({ line, invalid }: { line: CartLine; invalid?: boolean }) {
  const { exec, pending } = useCartAction();
  const spec = Object.values(line.spec).join(' / ');
  return (
    <div
      className="flex items-center gap-3 border-b px-2 py-4 last:border-b-0"
      data-testid={invalid ? 'cart-invalid-row' : 'cart-row'}
      data-sku-id={line.skuId}
    >
      <Checkbox
        checked={!invalid && line.selected}
        disabled={invalid || pending}
        onCheckedChange={(v) => exec(() => setSelectedAction(line.id, v === true))}
        aria-label="选择商品"
        data-testid="cart-row-checkbox"
      />
      <Link
        href={`/p/${line.productId}`}
        className="relative size-16 shrink-0 overflow-hidden rounded-md border bg-muted"
      >
        {line.image ? (
          <Image
            src={line.image}
            alt={line.title}
            fill
            sizes="64px"
            className="object-contain p-1"
          />
        ) : null}
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/p/${line.productId}`}
          className="line-clamp-1 text-sm hover:text-primary"
          data-testid="cart-row-title"
        >
          {line.title}
        </Link>
        <p className="text-xs text-muted-foreground">{spec}</p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-red-600" data-testid="cart-row-price">
            {formatPrice(line.price)}
          </span>
          {line.priceChanged ? (
            <Badge
              variant="outline"
              className="text-[10px] text-orange-600"
              data-testid="price-changed-badge"
            >
              价格有变动（加购时 {formatPrice(line.priceAtAdd)}）
            </Badge>
          ) : null}
          {invalid ? (
            <Badge variant="secondary" data-testid="invalid-badge">
              {line.invalidReason === 'off' ? '已下架' : '已售罄'}
            </Badge>
          ) : null}
        </div>
      </div>
      {!invalid ? (
        <div className="flex items-center rounded-md border" data-testid="cart-qty-control">
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending || line.quantity <= 1}
            onClick={() => exec(() => updateQuantityAction(line.id, line.quantity - 1))}
            data-testid="cart-qty-minus"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-9 text-center text-sm" data-testid="cart-qty-value">
            {line.quantity}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            onClick={() => exec(() => updateQuantityAction(line.id, line.quantity + 1))}
            data-testid="cart-qty-plus"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      ) : null}
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={pending}
        onClick={() => exec(() => removeItemAction(line.id))}
        aria-label="删除"
        data-testid="cart-row-remove"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function CartViewClient({ view }: { view: CartView }) {
  const { exec, pending } = useCartAction();
  const empty = view.items.length === 0 && view.invalidItems.length === 0;

  if (empty) {
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-lg border border-dashed py-24"
        data-testid="cart-empty"
      >
        <p className="text-muted-foreground">购物车还是空的</p>
        <Button asChild>
          <Link href="/">去逛逛</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border">
        <div className="flex items-center gap-3 border-b bg-muted/40 px-2 py-2.5 text-sm">
          <Checkbox
            checked={view.allSelected}
            disabled={pending || view.items.length === 0}
            onCheckedChange={(v) => exec(() => setAllSelectedAction(v === true))}
            aria-label="全选"
            data-testid="cart-select-all"
          />
          <span>全选</span>
          <span className="ml-auto pr-2 text-muted-foreground">
            共 {view.items.length + view.invalidItems.length} 项
          </span>
        </div>
        {view.items.map((l) => (
          <CartRow key={l.id} line={l} />
        ))}
      </div>

      {view.invalidItems.length > 0 ? (
        <div className="rounded-lg border" data-testid="cart-invalid-section">
          <div className="border-b bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
            已失效商品
          </div>
          {view.invalidItems.map((l) => (
            <CartRow key={l.id} line={l} invalid />
          ))}
        </div>
      ) : null}

      <div className="sticky bottom-0 flex items-center justify-between rounded-lg border bg-background p-4 shadow-sm">
        <div className="text-sm">
          已选 <span data-testid="cart-selected-count">{view.selectedCount}</span> 项，合计：
          <span className="ml-1 text-xl font-bold text-red-600" data-testid="cart-total">
            {formatPrice(view.totalAmount)}
          </span>
        </div>
        <Button asChild size="lg" disabled={view.selectedCount === 0} data-testid="go-checkout">
          {view.selectedCount === 0 ? <span>去结算</span> : <Link href="/checkout">去结算</Link>}
        </Button>
      </div>
    </div>
  );
}
