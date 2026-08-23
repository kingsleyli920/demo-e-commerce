'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/server/auth/guards';
import { isAppError, toUserMessage } from '@/server/errors';
import { cancelOrder, confirmReceipt } from '@/server/services/order';

export type OrderActionResult = { ok: boolean; message?: string };

export async function cancelOrderAction(orderNo: string): Promise<OrderActionResult> {
  const user = await requireUser('/orders');
  try {
    await cancelOrder(user.id, orderNo);
  } catch (e) {
    return { ok: false, message: isAppError(e) ? e.message : toUserMessage(e) };
  }
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderNo}`, 'page');
  return { ok: true, message: '订单已取消' };
}

export async function confirmReceiptAction(orderNo: string): Promise<OrderActionResult> {
  const user = await requireUser('/orders');
  try {
    await confirmReceipt(user.id, orderNo);
  } catch (e) {
    return { ok: false, message: isAppError(e) ? e.message : toUserMessage(e) };
  }
  revalidatePath('/orders');
  revalidatePath(`/orders/${orderNo}`, 'page');
  return { ok: true, message: '已确认收货' };
}
