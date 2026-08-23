'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireUser } from '@/server/auth/guards';
import { isAppError } from '@/server/errors';
import { placeOrder, type CheckoutSource } from '@/server/services/checkout';

export type PlaceOrderState = { error?: string } | undefined;

const placeSchema = z.object({
  addressId: z.coerce.number().int().positive({ error: '请选择收货地址' }),
  remark: z.string().trim().max(200).optional(),
  sourceType: z.enum(['cart', 'buyNow']),
  skuId: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().int().min(1).max(99).optional(),
});

export async function placeOrderAction(
  _prev: PlaceOrderState,
  formData: FormData,
): Promise<PlaceOrderState> {
  const user = await requireUser('/checkout');
  const parsed = placeSchema.safeParse({
    addressId: formData.get('addressId'),
    remark: formData.get('remark') || undefined,
    sourceType: formData.get('sourceType'),
    skuId: formData.get('skuId') || undefined,
    quantity: formData.get('quantity') || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? '参数错误' };
  const d = parsed.data;
  const source: CheckoutSource =
    d.sourceType === 'buyNow'
      ? { type: 'buyNow', skuId: d.skuId ?? 0, quantity: d.quantity ?? 1 }
      : { type: 'cart' };
  let orderNo: string;
  try {
    const order = await placeOrder(user.id, { source, addressId: d.addressId, remark: d.remark });
    orderNo = order.orderNo;
  } catch (e) {
    if (isAppError(e)) return { error: e.message };
    throw e;
  }
  redirect(`/pay/${orderNo}`);
}
