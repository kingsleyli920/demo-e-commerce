'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth/guards';
import { isAppError, toUserMessage } from '@/server/errors';
import {
  removeCartItem,
  setAllSelected,
  setItemSelected,
  updateCartItemQuantity,
} from '@/server/services/cart';

export type CartActionResult = { ok: boolean; message?: string; clamped?: boolean };

async function run(
  fn: (userId: string) => Promise<CartActionResult | void>,
): Promise<CartActionResult> {
  const user = await requireUser('/cart');
  try {
    const r = await fn(user.id);
    revalidatePath('/cart');
    revalidatePath('/', 'layout');
    return r ?? { ok: true };
  } catch (e) {
    if (isAppError(e)) return { ok: false, message: e.message };
    return { ok: false, message: toUserMessage(e) };
  }
}

export async function updateQuantityAction(
  itemId: number,
  quantity: number,
): Promise<CartActionResult> {
  return run(async (uid) => {
    const { item, clamped } = await updateCartItemQuantity(uid, itemId, quantity);
    return {
      ok: true,
      clamped,
      message: clamped ? `已按可售库存调整为 ${item.quantity} 件` : undefined,
    };
  });
}

export async function removeItemAction(itemId: number): Promise<CartActionResult> {
  return run(async (uid) => {
    await removeCartItem(uid, itemId);
  });
}

export async function setSelectedAction(
  itemId: number,
  selected: boolean,
): Promise<CartActionResult> {
  return run(async (uid) => {
    await setItemSelected(uid, itemId, selected);
  });
}

export async function setAllSelectedAction(selected: boolean): Promise<CartActionResult> {
  return run(async (uid) => {
    await setAllSelected(uid, selected);
  });
}
