import { and, asc, count, eq, lt, sql } from 'drizzle-orm';
import { db, type DbOrTx, type Tx } from '@/server/db/client';
import {
  inventoryLogs,
  orderItems,
  orders,
  skus,
  type Order,
  type OrderItem,
  type OrderStatus,
} from '@/server/db/schema';
import { AppError } from '@/server/errors';

// ---------------------------------------------------------------------------
// 状态机
// ---------------------------------------------------------------------------
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED'],
  SHIPPED: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: '待付款',
  PAID: '待发货',
  SHIPPED: '待收货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!ORDER_TRANSITIONS[from]?.includes(to)) {
    throw new AppError(
      'INVALID_STATE',
      `订单状态不允许从「${ORDER_STATUS_LABELS[from]}」变更为「${ORDER_STATUS_LABELS[to]}」`,
    );
  }
}

export function transitionTimestampField(
  to: OrderStatus,
): 'paidAt' | 'shippedAt' | 'completedAt' | 'cancelledAt' {
  switch (to) {
    case 'PAID':
      return 'paidAt';
    case 'SHIPPED':
      return 'shippedAt';
    case 'COMPLETED':
      return 'completedAt';
    case 'CANCELLED':
      return 'cancelledAt';
    default:
      throw new AppError('INVALID_STATE', `状态 ${to} 无对应时间戳`);
  }
}

/** 在事务内做一次合法状态迁移并写时间戳；返回更新后的订单 */
export async function transitionOrder(
  tx: DbOrTx,
  order: Order,
  to: OrderStatus,
  extra: Partial<typeof orders.$inferInsert> = {},
): Promise<Order> {
  assertTransition(order.status, to);
  const now = new Date();
  const [row] = await tx
    .update(orders)
    .set({ status: to, [transitionTimestampField(to)]: now, ...extra })
    // 条件更新防并发：只有仍处于原状态才允许迁移
    .where(and(eq(orders.id, order.id), eq(orders.status, order.status)))
    .returning();
  if (!row) throw new AppError('CONFLICT', '订单状态已变化，请刷新后重试');
  return row;
}

// ---------------------------------------------------------------------------
// 取消 / 超时释放
// ---------------------------------------------------------------------------

/** 事务内：取消 PENDING 订单并释放锁定库存（写 unlock 日志） */
async function cancelPendingOrderTx(tx: Tx, order: Order): Promise<Order> {
  const cancelled = await transitionOrder(tx, order, 'CANCELLED');
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  for (const item of items) {
    await tx
      .update(skus)
      .set({ lockedStock: sql`${skus.lockedStock} - ${item.quantity}` })
      .where(eq(skus.id, item.skuId));
    await tx.insert(inventoryLogs).values({
      skuId: item.skuId,
      change: -item.quantity,
      type: 'unlock',
      refOrderId: order.id,
    });
  }
  return cancelled;
}

/** 用户取消订单（仅本人 + 仅待付款） */
export async function cancelOrder(
  userId: string,
  orderNo: string,
  conn: DbOrTx = db,
): Promise<Order> {
  return conn.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.orderNo, orderNo), eq(orders.userId, userId)),
    });
    if (!order) throw new AppError('NOT_FOUND', '订单不存在');
    if (order.status !== 'PENDING_PAYMENT') {
      throw new AppError(
        'INVALID_STATE',
        `当前状态「${ORDER_STATUS_LABELS[order.status]}」不可取消`,
      );
    }
    return cancelPendingOrderTx(tx, order);
  });
}

/** 惰性过期：读取时发现已过期的待付款订单 → 取消并释放；返回（可能已更新的）订单 */
export async function expireOrderIfNeeded(order: Order, conn: DbOrTx = db): Promise<Order> {
  if (order.status !== 'PENDING_PAYMENT' || order.expireAt.getTime() > Date.now()) return order;
  try {
    return await conn.transaction(async (tx) => cancelPendingOrderTx(tx, order));
  } catch (e) {
    // 并发下已被取消/支付：读最新
    if (e instanceof AppError && (e.code === 'CONFLICT' || e.code === 'INVALID_STATE')) {
      const fresh = await conn.query.orders.findFirst({ where: eq(orders.id, order.id) });
      return fresh ?? order;
    }
    throw e;
  }
}

/** 批量处理过期订单（cron / 后台按钮）；返回处理数量 */
export async function expireOrders(conn: DbOrTx = db, now: Date = new Date()): Promise<number> {
  const expired = await conn
    .select()
    .from(orders)
    .where(and(eq(orders.status, 'PENDING_PAYMENT'), lt(orders.expireAt, now)));
  let n = 0;
  for (const order of expired) {
    const after = await expireOrderIfNeeded(order, conn);
    if (after.status === 'CANCELLED') n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// 查询
// ---------------------------------------------------------------------------

export type OrderWithItems = Order & { items: OrderItem[] };
export type OrderTab = 'ALL' | OrderStatus;
export type OrderCounts = Record<OrderTab, number>;

export type ListOrdersResult = {
  orders: OrderWithItems[];
  counts: OrderCounts;
  total: number;
};

/** 我的订单列表：先惰性过期，再按 Tab 过滤，倒序 */
export async function listOrders(
  userId: string,
  params: { status?: OrderStatus; limit?: number },
  conn: DbOrTx = db,
): Promise<ListOrdersResult> {
  // 惰性过期本人到期订单
  const pendingExpired = await conn
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.userId, userId),
        eq(orders.status, 'PENDING_PAYMENT'),
        lt(orders.expireAt, new Date()),
      ),
    );
  for (const o of pendingExpired) await expireOrderIfNeeded(o, conn);

  const rows = await conn.query.orders.findMany({
    where: params.status
      ? and(eq(orders.userId, userId), eq(orders.status, params.status))
      : eq(orders.userId, userId),
    with: { items: true },
    orderBy: (t, { desc: d }) => [d(t.createdAt), d(t.id)],
    limit: params.limit ?? 100,
  });
  const countRows = await conn
    .select({ status: orders.status, n: count() })
    .from(orders)
    .where(eq(orders.userId, userId))
    .groupBy(orders.status);
  const counts: OrderCounts = {
    ALL: 0,
    PENDING_PAYMENT: 0,
    PAID: 0,
    SHIPPED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const r of countRows) {
    counts[r.status] = r.n;
    counts.ALL += r.n;
  }
  return { orders: rows, counts, total: counts.ALL };
}

/** 本人订单（惰性过期）；他人/不存在 → null */
export async function getOrderByNo(
  userId: string,
  orderNo: string,
  conn: DbOrTx = db,
): Promise<Order | null> {
  const order = await conn.query.orders.findFirst({
    where: and(eq(orders.orderNo, orderNo), eq(orders.userId, userId)),
  });
  if (!order) return null;
  return expireOrderIfNeeded(order, conn);
}

export type OrderDetail = { order: Order; items: OrderItem[] };

export async function getOrderDetail(
  userId: string,
  orderNo: string,
  conn: DbOrTx = db,
): Promise<OrderDetail | null> {
  const order = await getOrderByNo(userId, orderNo, conn);
  if (!order) return null;
  const items = await conn
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))
    .orderBy(asc(orderItems.id));
  return { order, items };
}

// ---------------------------------------------------------------------------
// 收货 / 发货
// ---------------------------------------------------------------------------

/** 确认收货：仅本人 + 仅已发货 */
export async function confirmReceipt(
  userId: string,
  orderNo: string,
  conn: DbOrTx = db,
): Promise<Order> {
  return conn.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({
      where: and(eq(orders.orderNo, orderNo), eq(orders.userId, userId)),
    });
    if (!order) throw new AppError('NOT_FOUND', '订单不存在');
    if (order.status !== 'SHIPPED') {
      throw new AppError(
        'INVALID_STATE',
        `当前状态「${ORDER_STATUS_LABELS[order.status]}」不可确认收货`,
      );
    }
    return transitionOrder(tx, order, 'COMPLETED');
  });
}

/** 模拟发货（后台）：仅 PAID → SHIPPED，可填承运商/运单号 */
export async function shipOrder(
  orderNo: string,
  shipping: { carrier: string | null; trackingNo: string | null },
  conn: DbOrTx = db,
): Promise<Order> {
  return conn.transaction(async (tx) => {
    const order = await tx.query.orders.findFirst({ where: eq(orders.orderNo, orderNo) });
    if (!order) throw new AppError('NOT_FOUND', '订单不存在');
    if (order.status !== 'PAID') {
      throw new AppError(
        'INVALID_STATE',
        `当前状态「${ORDER_STATUS_LABELS[order.status]}」不可发货`,
      );
    }
    return transitionOrder(tx, order, 'SHIPPED', { shipping });
  });
}
