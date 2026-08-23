import { and, eq, gt, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '@/server/db/client';
import { cartItems, carts, skus, type CartItem } from '@/server/db/schema';
import { AppError } from '@/server/errors';
import { availableStock } from './inventory';

export const CART_MAX_ITEMS = 50;
export const CART_MAX_QTY = 99;

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

export type AddToCartResult = { item: CartItem; clamped: boolean };

/**
 * 加购：同 SKU 合并；数量钳制到 min(可售, 99)；下架/售罄拒绝；条目上限 50（新 SKU）。
 */
export async function addToCart(
  userId: string,
  skuId: number,
  quantity: number,
  conn: DbOrTx = db,
): Promise<AddToCartResult> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError('VALIDATION', '数量无效');
  return conn.transaction(async (tx) => {
    const sku = await tx.query.skus.findFirst({ where: eq(skus.id, skuId) });
    if (!sku) throw new AppError('NOT_FOUND', '商品不存在');
    if (sku.status !== 'on') throw new AppError('VALIDATION', '该商品已下架，无法加入购物车');
    const available = availableStock(sku);
    if (available <= 0) throw new AppError('VALIDATION', '该商品已售罄');

    const cartId = await getOrCreateCartId(userId, tx);
    const existing = await tx.query.cartItems.findFirst({
      where: and(eq(cartItems.cartId, cartId), eq(cartItems.skuId, skuId)),
    });
    if (!existing) {
      const [{ n }] = await tx
        .select({ n: sql<number>`count(*)`.mapWith(Number) })
        .from(cartItems)
        .where(eq(cartItems.cartId, cartId));
      if ((n ?? 0) >= CART_MAX_ITEMS) {
        throw new AppError('CART_LIMIT', `购物车最多 ${CART_MAX_ITEMS} 种商品，请先清理`);
      }
    }
    const cap = Math.min(available, CART_MAX_QTY);
    const want = (existing?.quantity ?? 0) + quantity;
    const finalQty = Math.min(want, cap);
    const clamped = finalQty < want;
    let item: CartItem;
    if (existing) {
      const [row] = await tx
        .update(cartItems)
        .set({ quantity: finalQty, selected: true })
        .where(eq(cartItems.id, existing.id))
        .returning();
      item = row!;
    } else {
      const [row] = await tx
        .insert(cartItems)
        .values({ cartId, skuId, quantity: finalQty, priceAtAdd: sku.price, selected: true })
        .returning();
      item = row!;
    }
    return { item, clamped };
  });
}

/** 头部角标 = 有效条目（SKU 上架且可售 > 0）的数量之和 */
export async function getCartBadgeCount(userId: string, conn: DbOrTx = db): Promise<number> {
  const [row] = await conn
    .select({ total: sql<number>`coalesce(sum(${cartItems.quantity}), 0)`.mapWith(Number) })
    .from(cartItems)
    .innerJoin(carts, eq(cartItems.cartId, carts.id))
    .innerJoin(skus, eq(cartItems.skuId, skus.id))
    .where(
      and(
        eq(carts.userId, userId),
        eq(skus.status, 'on'),
        gt(sql`${skus.stock} - ${skus.lockedStock}`, 0),
      ),
    );
  return row?.total ?? 0;
}
