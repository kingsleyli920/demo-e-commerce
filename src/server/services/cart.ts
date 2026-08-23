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

export type ClampReason = 'stock' | 'limit' | null;
export type AddToCartResult = { item: CartItem; clamped: boolean; clampReason: ClampReason };

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
    // 原子 upsert：并发加购同一 SKU 时由 (cart_id, sku_id) 唯一键合并，不丢增量、不抛唯一冲突
    const [item] = await tx
      .insert(cartItems)
      .values({
        cartId,
        skuId,
        quantity: Math.min(quantity, cap),
        priceAtAdd: sku.price,
        selected: true,
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.skuId],
        set: {
          quantity: sql`least(${cartItems.quantity} + ${quantity}, ${cap})`,
          selected: sql`true`,
        },
      })
      .returning();
    const clamped = item!.quantity < want;
    const clampReason: ClampReason = !clamped ? null : available < CART_MAX_QTY ? 'stock' : 'limit';
    return { item: item!, clamped, clampReason };
  });
}

export type CartLine = {
  id: number;
  skuId: number;
  productId: number;
  title: string;
  image: string | null;
  spec: Record<string, string>;
  price: number;
  priceAtAdd: number;
  priceChanged: boolean;
  quantity: number;
  selected: boolean;
  available: number;
  invalidReason: 'off' | 'soldout' | null;
};

export type CartView = {
  items: CartLine[];
  invalidItems: CartLine[];
  totalAmount: number;
  selectedCount: number;
  allSelected: boolean;
};

/** 购物车视图：有效/失效分区；合计只统计已勾选有效项（实时价） */
export async function listCart(userId: string, conn: DbOrTx = db): Promise<CartView> {
  const cartId = await getOrCreateCartId(userId, conn);
  const rows = await conn.query.cartItems.findMany({
    where: eq(cartItems.cartId, cartId),
    with: { sku: { with: { product: true } } },
    orderBy: (t, { desc: d }) => [d(t.createdAt), d(t.id)],
  });
  const lines: CartLine[] = rows.map((r) => {
    const available = availableStock(r.sku);
    const invalidReason =
      r.sku.status !== 'on' ? ('off' as const) : available <= 0 ? ('soldout' as const) : null;
    return {
      id: r.id,
      skuId: r.skuId,
      productId: r.sku.productId,
      title: r.sku.product.title,
      image: r.sku.image ?? r.sku.product.images[0] ?? null,
      spec: r.sku.spec,
      price: r.sku.price,
      priceAtAdd: r.priceAtAdd,
      priceChanged: r.sku.price !== r.priceAtAdd,
      quantity: r.quantity,
      selected: r.selected,
      available,
      invalidReason,
    };
  });
  const items = lines.filter((l) => l.invalidReason === null);
  const invalidItems = lines.filter((l) => l.invalidReason !== null);
  const selectedValid = items.filter((l) => l.selected);
  return {
    items,
    invalidItems,
    totalAmount: selectedValid.reduce((sum, l) => sum + l.price * l.quantity, 0),
    selectedCount: selectedValid.length,
    allSelected: items.length > 0 && selectedValid.length === items.length,
  };
}

async function findOwnItem(userId: string, itemId: number, conn: DbOrTx) {
  const row = await conn.query.cartItems.findMany({
    where: eq(cartItems.id, itemId),
    with: { cart: true, sku: true },
    limit: 1,
  });
  const item = row[0];
  if (!item || item.cart.userId !== userId) throw new AppError('NOT_FOUND', '购物车条目不存在');
  return item;
}

/** 修改数量：钳制 1..min(可售, 99) */
export async function updateCartItemQuantity(
  userId: string,
  itemId: number,
  quantity: number,
  conn: DbOrTx = db,
): Promise<AddToCartResult> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError('VALIDATION', '数量无效');
  const item = await findOwnItem(userId, itemId, conn);
  const available = availableStock(item.sku);
  const cap = Math.max(1, Math.min(available, CART_MAX_QTY));
  const finalQty = Math.min(quantity, cap);
  const [row] = await conn
    .update(cartItems)
    .set({ quantity: finalQty })
    .where(eq(cartItems.id, itemId))
    .returning();
  const clamped = finalQty < quantity;
  return {
    item: row!,
    clamped,
    clampReason: !clamped ? null : available < CART_MAX_QTY ? 'stock' : 'limit',
  };
}

export async function removeCartItem(
  userId: string,
  itemId: number,
  conn: DbOrTx = db,
): Promise<void> {
  await findOwnItem(userId, itemId, conn);
  await conn.delete(cartItems).where(eq(cartItems.id, itemId));
}

/** 勾选/取消勾选；失效项不可勾选 */
export async function setItemSelected(
  userId: string,
  itemId: number,
  selected: boolean,
  conn: DbOrTx = db,
): Promise<void> {
  const item = await findOwnItem(userId, itemId, conn);
  if (selected) {
    const invalid = item.sku.status !== 'on' || availableStock(item.sku) <= 0;
    if (invalid) throw new AppError('VALIDATION', '该条目已失效，不能勾选');
  }
  await conn.update(cartItems).set({ selected }).where(eq(cartItems.id, itemId));
}

/** 全选/取消全选（只影响有效项的勾选状态；取消全选影响全部） */
export async function setAllSelected(
  userId: string,
  selected: boolean,
  conn: DbOrTx = db,
): Promise<void> {
  const cartId = await getOrCreateCartId(userId, conn);
  if (!selected) {
    await conn.update(cartItems).set({ selected: false }).where(eq(cartItems.cartId, cartId));
    return;
  }
  await conn
    .update(cartItems)
    .set({ selected: true })
    .where(
      and(
        eq(cartItems.cartId, cartId),
        sql`${cartItems.skuId} IN (select ${skus.id} from ${skus} where ${skus.status} = 'on' and ${skus.stock} - ${skus.lockedStock} > 0)`,
      ),
    );
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
