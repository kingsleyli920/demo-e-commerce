'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addToCartSchema } from '@/server/dto/catalog';
import { getCurrentUser } from '@/server/auth/guards';
import { isAppError } from '@/server/errors';
import { addToCart } from '@/server/services/cart';

export type AddToCartState =
  | { status: 'idle' }
  | { status: 'needLogin' }
  | { status: 'error'; message: string }
  | { status: 'ok'; clamped: boolean; quantity: number };

export async function addToCartAction(_prev: AddToCartState, formData: FormData): Promise<AddToCartState> {
  const user = await getCurrentUser();
  if (!user) return { status: 'needLogin' };
  const parsed = addToCartSchema.safeParse({
    skuId: formData.get('skuId'),
    quantity: formData.get('quantity'),
  });
  if (!parsed.success) return { status: 'error', message: '参数错误，请重新选择规格' };
  try {
    const { item, clamped } = await addToCart(user.id, parsed.data.skuId, parsed.data.quantity);
    revalidatePath('/', 'layout');
    return { status: 'ok', clamped, quantity: item.quantity };
  } catch (e) {
    if (isAppError(e)) return { status: 'error', message: e.message };
    throw e;
  }
}

/** 立即购买：校验后直接进入仅含该 SKU 的结算流程（不动购物车） */
export async function buyNowAction(productId: number, formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/p/${productId}`)}`);
  const parsed = addToCartSchema.safeParse({
    skuId: formData.get('skuId'),
    quantity: formData.get('quantity'),
  });
  if (!parsed.success) redirect(`/p/${productId}`);
  redirect(`/checkout?sku=${parsed.data.skuId}&qty=${parsed.data.quantity}`);
}
