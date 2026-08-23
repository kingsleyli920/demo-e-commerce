import { beforeEach, describe, expect, it } from 'vitest';
import { addToCart } from '@/server/services/cart';
import { placeOrder } from '@/server/services/checkout';
import { cancelOrder } from '@/server/services/order';
import { mockPayCallback } from '@/server/services/payment';
import { resetDb, getTestDb } from '../db';
import { createAddress, createProductWithSkus, createUser, getSku } from '../factories';

describe('P0-4 库存：锁定/扣减/释放/日志', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const db = getTestDb();
    const u = await createUser();
    const addr = await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({ title: '库存机' }, [
      { spec: { 颜色: '黑' }, price: 10000, stock: 10 },
      { spec: { 颜色: '白' }, price: 10000, stock: 1 },
    ]);
    return { db, u, addr, s };
  }

  it('锁定成功：locked_stock 增加、stock 不变', async () => {
    const { u, addr, s } = await setup();
    await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 3 },
      addressId: addr.id,
    });
    const sku = await getSku(s[0]!.id);
    expect(sku).toMatchObject({ stock: 10, lockedStock: 3 });
  });

  it('多 SKU 其中一个不足 → 整单回滚', async () => {
    const { db, u, addr, s } = await setup();
    await addToCart(u.id, s[0]!.id, 1);
    const { item } = await addToCart(u.id, s[1]!.id, 1);
    const { cartItems: ci } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(ci).set({ quantity: 5 }).where(eq(ci.id, item.id));
    await expect(
      placeOrder(u.id, { source: { type: 'cart' }, addressId: addr.id }),
    ).rejects.toThrowError(/库存不足: 库存机/);
    expect((await getSku(s[0]!.id)).lockedStock).toBe(0);
  });

  it('支付成功扣减：stock/locked 同时减；取消释放：仅 locked 减', async () => {
    const { db, u, addr, s } = await setup();
    const o1 = await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 2 },
      addressId: addr.id,
    });
    await mockPayCallback({ orderNo: o1.orderNo, result: 'success', transactionNo: 'TX-1' });
    expect(await getSku(s[0]!.id)).toMatchObject({ stock: 8, lockedStock: 0 });

    const o2 = await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 3 },
      addressId: addr.id,
    });
    expect((await getSku(s[0]!.id)).lockedStock).toBe(3);
    await cancelOrder(u.id, o2.orderNo);
    expect(await getSku(s[0]!.id)).toMatchObject({ stock: 8, lockedStock: 0 });

    // 日志：lock(+2) deduct(-2) lock(+3) unlock(-3)
    const logs = await db.query.inventoryLogs.findMany({ orderBy: (t, { asc }) => [asc(t.id)] });
    expect(logs.map((l) => [l.type, l.change])).toEqual([
      ['lock', 2],
      ['deduct', -2],
      ['lock', 3],
      ['unlock', -3],
    ]);
    expect(logs.every((l) => l.refOrderId === o1.id || l.refOrderId === o2.id)).toBe(true);
  });

  it('可售不可为负：恰好清空可售后再下单失败', async () => {
    const { u, addr, s } = await setup();
    await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[1]!.id, quantity: 1 },
      addressId: addr.id,
    });
    await expect(
      placeOrder(u.id, {
        source: { type: 'buyNow', skuId: s[1]!.id, quantity: 1 },
        addressId: addr.id,
      }),
    ).rejects.toThrowError(/库存不足/);
    expect(await getSku(s[1]!.id)).toMatchObject({ stock: 1, lockedStock: 1 });
  });
});
