import { beforeEach, describe, expect, it } from 'vitest';
import { cartItems } from '@/server/db/schema';
import { getCartBadgeCount, getOrCreateCartId } from '@/server/services/cart';
import { getTestDb, resetDb } from '../db';
import { createProductWithSkus, createUser } from '../factories';

describe('cart service（M1 基础）', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('getOrCreateCartId：同一用户多次调用返回同一购物车', async () => {
    const u = await createUser();
    const id1 = await getOrCreateCartId(u.id);
    const id2 = await getOrCreateCartId(u.id);
    expect(id1).toBe(id2);
  });

  it('getOrCreateCartId：无购物车时创建', async () => {
    const db = getTestDb();
    const u = await createUser();
    // factories 已建购物车，这里删除后验证自动创建
    const { carts } = await import('@/server/db/schema');
    await db.delete(carts);
    const id = await getOrCreateCartId(u.id);
    expect(id).toBeGreaterThan(0);
    expect(await getOrCreateCartId(u.id)).toBe(id);
  });

  it('getCartBadgeCount：条目数量之和；空购物车为 0', async () => {
    const db = getTestDb();
    const u = await createUser();
    expect(await getCartBadgeCount(u.id)).toBe(0);
    const cartId = await getOrCreateCartId(u.id);
    const { skus } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 100, stock: 10 },
      { spec: { 颜色: '白' }, price: 100, stock: 10 },
    ]);
    await db.insert(cartItems).values([
      { cartId, skuId: skus[0]!.id, quantity: 2, priceAtAdd: 100 },
      { cartId, skuId: skus[1]!.id, quantity: 3, priceAtAdd: 100 },
    ]);
    expect(await getCartBadgeCount(u.id)).toBe(5);
  });
});
