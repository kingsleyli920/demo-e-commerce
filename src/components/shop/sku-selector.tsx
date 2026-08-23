'use client';

import { Minus, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { addToCartAction, buyNowAction, type AddToCartState } from '@/app/(shop)/p/[id]/actions';
import { Button } from '@/components/ui/button';
import { formatPrice } from '@/lib/format';
import { availableOptions, isSpecComplete, priceRange } from '@/lib/sku';
import { stockHint } from '@/lib/stock';
import { cn } from '@/lib/utils';
import type { ProductAttribute, SkuSpec } from '@/server/db/schema';

export type SkuData = {
  id: number;
  spec: SkuSpec;
  price: number;
  originalPrice: number | null;
  /** 可售库存（服务端已计算，最多下发 99） */
  available: number;
  image: string | null;
  status: 'on' | 'off';
};

export function SkuSelector({
  productId,
  attributes,
  skus,
}: {
  productId: number;
  attributes: ProductAttribute[];
  skus: SkuData[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<SkuSpec>({});
  const [quantity, setQuantity] = useState(1);
  const [state, formAction, pending] = useActionState<AddToCartState, FormData>(addToCartAction, {
    status: 'idle',
  });

  const options = useMemo(
    () => availableOptions(attributes, skus, selected),
    [attributes, skus, selected],
  );
  const complete = isSpecComplete(attributes, selected);
  const current = useMemo(() => {
    if (!complete) return null;
    const sku = skus.find(
      (s) => s.status === 'on' && attributes.every((a) => s.spec[a.name] === selected[a.name]),
    );
    return sku ?? null;
  }, [complete, skus, attributes, selected]);
  const range = useMemo(() => priceRange(skus), [skus]);
  const hint = current ? stockHint(current.available) : null;
  const maxQty = current ? Math.min(Math.max(hint!.available, 1), 99) : 99;

  useEffect(() => {
    if (state.status === 'needLogin') {
      router.push(`/login?next=${encodeURIComponent(`/p/${productId}`)}`);
    } else if (state.status === 'error') {
      toast.error(state.message);
    } else if (state.status === 'ok') {
      toast.success(
        state.clamped ? `已加入购物车（数量已按库存调整为 ${state.quantity}）` : '已加入购物车',
      );
      router.refresh();
    }
  }, [state, router, productId]);

  const toggle = (name: string, value: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[name] === value) delete next[name];
      else next[name] = value;
      return next;
    });
    setQuantity(1);
  };

  const disabledBuy = !current || hint!.soldOut;

  return (
    <div className="space-y-5">
      <div className="rounded-lg bg-muted/50 p-4">
        {current ? (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-red-600" data-testid="sku-price">
              {formatPrice(current.price)}
            </span>
            {current.originalPrice ? (
              <span
                className="text-sm text-muted-foreground line-through"
                data-testid="sku-original-price"
              >
                {formatPrice(current.originalPrice)}
              </span>
            ) : null}
            {hint?.text ? (
              <span
                className={cn(
                  'text-sm',
                  hint.soldOut ? 'text-muted-foreground' : 'text-orange-600',
                )}
                data-testid="stock-hint"
              >
                {hint.text}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-red-600" data-testid="sku-price-range">
              {range
                ? range[0] === range[1]
                  ? formatPrice(range[0])
                  : `${formatPrice(range[0])} - ${formatPrice(range[1])}`
                : '暂无在售'}
            </span>
            <span className="text-sm text-muted-foreground" data-testid="spec-prompt">
              请选择规格
            </span>
          </div>
        )}
      </div>

      {attributes.map((attr) => (
        <div key={attr.name} className="space-y-2" data-testid={`attr-${attr.name}`}>
          <div className="text-sm font-medium">{attr.name}</div>
          <div className="flex flex-wrap gap-2">
            {options[attr.name]?.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => toggle(attr.name, opt.value)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm transition-colors',
                  selected[attr.name] === opt.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:border-primary',
                  opt.disabled &&
                    'cursor-not-allowed border-dashed text-muted-foreground/50 line-through',
                )}
                data-testid={`option-${attr.name}-${opt.value}`}
                data-selected={selected[attr.name] === opt.value}
                data-disabled={opt.disabled}
              >
                {opt.value}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">数量</span>
        <div className="flex items-center rounded-md border">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={quantity <= 1}
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            data-testid="qty-minus"
          >
            <Minus className="size-3.5" />
          </Button>
          <span className="w-10 text-center text-sm" data-testid="qty-value">
            {quantity}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={!current || quantity >= maxQty}
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            data-testid="qty-plus"
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
        {current && !hint!.soldOut ? (
          <span className="text-xs text-muted-foreground">可售 {hint!.available} 件</span>
        ) : null}
      </div>

      <div className="flex gap-3">
        <form action={formAction} className="flex-1">
          <input type="hidden" name="skuId" value={current?.id ?? ''} />
          <input type="hidden" name="quantity" value={quantity} />
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={disabledBuy || pending}
            data-testid="add-to-cart"
          >
            {hint?.soldOut ? '已售罄' : pending ? '加入中…' : '加入购物车'}
          </Button>
        </form>
        <form action={buyNowAction.bind(null, productId)} className="flex-1">
          <input type="hidden" name="skuId" value={current?.id ?? ''} />
          <input type="hidden" name="quantity" value={quantity} />
          <Button
            type="submit"
            size="lg"
            variant="secondary"
            className="w-full"
            disabled={disabledBuy}
            data-testid="buy-now"
          >
            立即购买
          </Button>
        </form>
      </div>
    </div>
  );
}
