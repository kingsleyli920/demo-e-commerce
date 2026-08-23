import { and, desc, eq, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '@/server/db/client';
import { inventoryLogs, orderItems, orders, payments, skus, type Order } from '@/server/db/schema';
import { AppError } from '@/server/errors';
import { expireOrderIfNeeded, transitionOrder } from './order';

export type MockPayInput = {
  orderNo: string;
  result: 'success' | 'fail';
  transactionNo: string;
};

export type MockPayResult = {
  order: Order;
  status: 'SUCCESS' | 'FAILED';
  idempotent: boolean;
};

/**
 * Mock 支付回调（事务）：
 * - success → payments SUCCESS + orders PAID + stock/locked 扣减 + logs(deduct)
 * - fail → payments FAILED，订单保持 PENDING 可重试
 * - 幂等：同 transaction_no / 已 PAID → 返回成功不重复扣减；已 CANCELLED → 400
 */
export async function mockPayCallback(
  input: MockPayInput,
  conn: DbOrTx = db,
): Promise<MockPayResult> {
  // 惰性过期放在主事务之外：过期取消需要独立提交，不能随「订单已取消」拒绝一起回滚
  const preread = await conn.query.orders.findFirst({ where: eq(orders.orderNo, input.orderNo) });
  if (!preread) throw new AppError('NOT_FOUND', '订单不存在');
  await expireOrderIfNeeded(preread, conn);

  return conn.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.orderNo, input.orderNo) });
    if (!order) throw new AppError('NOT_FOUND', '订单不存在');

    // 幂等：同 transactionNo（payments.transaction_no 全局唯一，按 transactionNo 查而非仅本订单）
    const dupe = await tx.query.payments.findFirst({
      where: eq(payments.transactionNo, input.transactionNo),
    });
    if (dupe) {
      if (dupe.orderId !== order.id) {
        throw new AppError('CONFLICT', '交易号已被其它订单使用', { status: 400 });
      }
      return {
        order,
        status: dupe.status === 'SUCCESS' ? ('SUCCESS' as const) : ('FAILED' as const),
        idempotent: true,
      };
    }
    // 幂等：订单已支付
    if (order.status === 'PAID' || order.status === 'SHIPPED' || order.status === 'COMPLETED') {
      return { order, status: 'SUCCESS' as const, idempotent: true };
    }
    if (order.status === 'CANCELLED') {
      throw new AppError('INVALID_STATE', '订单已取消，无法支付', { status: 400 });
    }

    // 找到（或补建）待处理支付单
    const pending = await tx.query.payments.findFirst({
      where: and(eq(payments.orderId, order.id), eq(payments.status, 'INIT')),
      orderBy: [desc(payments.id)],
    });

    if (input.result === 'fail') {
      if (pending) {
        await tx
          .update(payments)
          .set({ status: 'FAILED', transactionNo: input.transactionNo })
          .where(eq(payments.id, pending.id));
      } else {
        await tx.insert(payments).values({
          orderId: order.id,
          method: 'mock',
          amount: order.payAmount,
          status: 'FAILED',
          transactionNo: input.transactionNo,
        });
      }
      return { order, status: 'FAILED' as const, idempotent: false };
    }

    // success
    const paidAt = new Date();
    if (pending) {
      await tx
        .update(payments)
        .set({ status: 'SUCCESS', transactionNo: input.transactionNo, paidAt })
        .where(eq(payments.id, pending.id));
    } else {
      await tx.insert(payments).values({
        orderId: order.id,
        method: 'mock',
        amount: order.payAmount,
        status: 'SUCCESS',
        transactionNo: input.transactionNo,
        paidAt,
      });
    }
    // 并发双成功回调：后到者在此条件更新失败 → 409（事务整体回滚，无重复扣减）；
    // 客户端重试会命中前面的「已 PAID 幂等」分支返回成功。
    const paid = await transitionOrder(tx, order, 'PAID');
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    for (const item of items) {
      await tx
        .update(skus)
        .set({
          stock: sql`${skus.stock} - ${item.quantity}`,
          lockedStock: sql`${skus.lockedStock} - ${item.quantity}`,
        })
        .where(eq(skus.id, item.skuId));
      await tx.insert(inventoryLogs).values({
        skuId: item.skuId,
        change: -item.quantity,
        type: 'deduct',
        refOrderId: order.id,
      });
    }
    return { order: paid, status: 'SUCCESS' as const, idempotent: false };
  });
}
