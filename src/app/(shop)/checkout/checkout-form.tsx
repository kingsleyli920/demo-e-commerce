'use client';

import Image from 'next/image';
import { useActionState } from 'react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { formatPrice } from '@/lib/format';
import type { Address } from '@/server/db/schema';
import type { CheckoutPreview } from '@/server/services/checkout';
import { placeOrderAction, type PlaceOrderState } from './actions';

function AddressPicker({ addresses, selected }: { addresses: Address[]; selected: number | null }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="checkout-addresses">
      {addresses.map((a) => (
        <label
          key={a.id}
          className="flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
          data-testid="checkout-address-option"
        >
          <input
            type="radio"
            name="addressId"
            value={a.id}
            defaultChecked={selected === a.id}
            className="mt-0.5"
            data-testid={`checkout-address-${a.id}`}
          />
          <span>
            <span className="font-medium">{a.receiver}</span>
            <span className="ml-2 text-muted-foreground">{a.phone}</span>
            {a.isDefault ? <span className="ml-2 text-xs text-primary">默认</span> : null}
            <br />
            <span className="text-muted-foreground">
              {a.province} {a.city} {a.district} {a.detail}
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function CheckoutForm({
  preview,
  sourceType,
  skuId,
  quantity,
}: {
  preview: CheckoutPreview;
  sourceType: 'cart' | 'buyNow';
  skuId?: number;
  quantity?: number;
}) {
  const [state, formAction, pending] = useActionState<PlaceOrderState, FormData>(
    placeOrderAction,
    undefined,
  );

  useEffect(() => {
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      className="grid gap-6 lg:grid-cols-[1fr_320px]"
      data-testid="checkout-form"
    >
      <input type="hidden" name="sourceType" value={sourceType} />
      {sourceType === 'buyNow' ? (
        <>
          <input type="hidden" name="skuId" value={skuId} />
          <input type="hidden" name="quantity" value={quantity} />
        </>
      ) : null}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">收货地址</CardTitle>
          </CardHeader>
          <CardContent>
            <AddressPicker addresses={preview.addresses} selected={preview.address?.id ?? null} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">商品清单（{preview.items.length} 项）</CardTitle>
          </CardHeader>
          <CardContent className="divide-y" data-testid="checkout-items">
            {preview.items.map((i) => (
              <div
                key={`${i.skuId}`}
                className="flex items-center gap-3 py-3"
                data-testid="checkout-item"
              >
                <div className="relative size-14 shrink-0 overflow-hidden rounded-md border bg-muted">
                  {i.image ? (
                    <Image
                      src={i.image}
                      alt={i.title}
                      fill
                      sizes="56px"
                      className="object-contain p-1"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {Object.values(i.spec).join(' / ')}
                  </p>
                </div>
                <div className="text-right text-sm">
                  <p>{formatPrice(i.price)}</p>
                  <p className="text-muted-foreground">×{i.quantity}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">订单备注</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              name="remark"
              placeholder="选填，最多 200 字"
              maxLength={200}
              data-testid="checkout-remark"
            />
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="sticky top-20">
          <CardHeader>
            <CardTitle className="text-base">金额明细</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">商品合计</span>
              <span data-testid="checkout-total">{formatPrice(preview.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                运费{preview.freight === 0 ? '（满 ¥99 免运费）' : ''}
              </span>
              <span data-testid="checkout-freight">
                {preview.freight === 0 ? '免运费' : formatPrice(preview.freight)}
              </span>
            </div>
            <Separator />
            <div className="flex items-baseline justify-between">
              <span>应付</span>
              <span className="text-xl font-bold text-red-600" data-testid="checkout-pay-amount">
                {formatPrice(preview.payAmount)}
              </span>
            </div>
            <Button
              type="submit"
              size="lg"
              className="mt-3 w-full"
              disabled={pending}
              data-testid="submit-order"
            >
              {pending ? '提交中…' : '提交订单'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
