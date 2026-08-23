import { eq, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '@/server/db/client';
import { cartItems, carts } from '@/server/db/schema';

/** 获取或创建用户购物车 id */
export async function getOrCreateCartId(userId: string, conn: DbOrTx = db): Promise<number> {
  const existing = await conn.query.carts.findFirst({ where: eq(carts.userId, userId) });
  if (existing) return existing.id;
  const [created] = await conn
    .insert(carts)
    .values({ userId })
    .onConflictDoNothing({ target: carts.userId })
    .returning({ id: carts.id });
  if (created) return created.id;
  const again = await conn.query.carts.findFirst({ where: eq(carts.userId, userId) });
  if (!again) throw new Error('购物车创建失败');
  return again.id;
}

/** 头部角标：购物车条目数量之和（只统计有效条目在 M3 完善，此处先统计全部） */
export async function getCartBadgeCount(userId: string, conn: DbOrTx = db): Promise<number> {
  const [row] = await conn
    .select({ total: sql<number>`coalesce(sum(${cartItems.quantity}), 0)`.mapWith(Number) })
    .from(cartItems)
    .innerJoin(carts, eq(cartItems.cartId, carts.id))
    .where(eq(carts.userId, userId));
  return row?.total ?? 0;
}
