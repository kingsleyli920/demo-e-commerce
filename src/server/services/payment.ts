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
  return conn.transaction(async (tx) => {
    let order = await tx.query.orders.findFirst({ where: eq(orders.orderNo, input.orderNo) });
    if (!order) throw new AppError('NOT_FOUND', '订单不存在');
    // 惰性过期（支付页回调时已过期 → 取消并拒绝）
    order = await expireOrderIfNeeded(order, tx);

    // 幂等：同 transactionNo
    const dupe = await tx.query.payments.findFirst({
      where: and(eq(payments.orderId, order.id), eq(payments.transactionNo, input.transactionNo)),
    });
    if (dupe) {
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
