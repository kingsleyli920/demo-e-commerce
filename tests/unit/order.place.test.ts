import { beforeEach, describe, expect, it } from 'vitest';
import { ORDER_NO_PATTERN } from '@/lib/order-no';
import { addToCart, listCart, setItemSelected } from '@/server/services/cart';
import { placeOrder } from '@/server/services/checkout';
import { resetDb, getTestDb } from '../db';
import { createAddress, createProductWithSkus, createUser, getSku } from '../factories';

describe('checkout.placeOrder', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const db = getTestDb();
    const u = await createUser();
    const addr = await createAddress(u.id, { isDefault: true, receiver: '张三' });
    const { product, skus: s } = await createProductWithSkus({ title: '测试机' }, [
      { spec: { 颜色: '黑' }, price: 5000, stock: 10 },
      { spec: { 颜色: '白' }, price: 6000, stock: 1 },
    ]);
    return { db, u, addr, product, s };
  }

  it('成功建单：状态/过期时间/快照/订单号/支付单 INIT/购物车项移除/库存锁定/日志', async () => {
    const { db, u, addr, product, s } = await setup();
    await addToCart(u.id, s[0]!.id, 2);
    const before = Date.now();
    const order = await placeOrder(u.id, {
      source: { type: 'cart' },
      addressId: addr.id,
      remark: '轻拿轻放',
    });
    expect(order.status).toBe('PENDING_PAYMENT');
    expect(order.orderNo).toMatch(ORDER_NO_PATTERN);
    expect(order.channel).toBe('web');
    expect(order.totalAmount).toBe(10000);
    expect(order.payAmount).toBe(10000 + 0); // ≥9900 免运费
    expect(order.freight).toBe(0);
    expect(order.remark).toBe('轻拿轻放');
    expect(order.addressSnapshot.receiver).toBe('张三');
    const expireMs = order.expireAt.getTime() - before;
    expect(expireMs).toBeGreaterThan(14 * 60_000);
    expect(expireMs).toBeLessThan(16 * 60_000);
    // 明细快照
    const items = await db.query.orderItems.findMany();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      orderId: order.id,
      skuId: s[0]!.id,
      productId: product.id,
      titleSnapshot: '测试机',
      unitPrice: 5000,
      quantity: 2,
      subtotal: 10000,
    });
    // 支付单 INIT
    const pays = await db.query.payments.findMany();
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({ orderId: order.id, status: 'INIT', amount: order.payAmount });
    // 已勾选项被移除
    expect((await listCart(u.id)).items).toHaveLength(0);
    // 库存锁定 + 日志
    const sku = await getSku(s[0]!.id);
    expect(sku.stock).toBe(10);
    expect(sku.lockedStock).toBe(2);
    const logs = await db.query.inventoryLogs.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      skuId: s[0]!.id,
      change: 2,
      type: 'lock',
      refOrderId: order.id,
    });
  });

  it('价格以服务端为准（购物车加购价 ≠ 实时价时按实时价）', async () => {
    const { db, u, addr, s } = await setup();
    await addToCart(u.id, s[0]!.id, 1); // priceAtAdd 5000
    const { skus: skuTable } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(skuTable).set({ price: 4000 }).where(eq(skuTable.id, s[0]!.id));
    const order = await placeOrder(u.id, { source: { type: 'cart' }, addressId: addr.id });
    expect(order.totalAmount).toBe(4000);
  });

  it('库存不足：整单失败、无残留订单/支付/日志、已锁库存回滚', async () => {
    const { db, u, addr, s } = await setup();
    await addToCart(u.id, s[0]!.id, 2); // 充足
    // s[1] 库存 1，先把它也加进购物车 2 件（addToCart 会钳到 1）→ 手动改回 2 模拟竞态
    const { item } = await addToCart(u.id, s[1]!.id, 1);
    const { cartItems: ciTable } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(ciTable).set({ quantity: 2 }).where(eq(ciTable.id, item.id));
    await expect(
      placeOrder(u.id, { source: { type: 'cart' }, addressId: addr.id }),
    ).rejects.toThrowError(/库存不足/);
    expect(await db.query.orders.findMany()).toHaveLength(0);
    expect(await db.query.payments.findMany()).toHaveLength(0);
    expect(await db.query.inventoryLogs.findMany()).toHaveLength(0);
    expect((await getSku(s[0]!.id)).lockedStock).toBe(0);
    expect((await getSku(s[1]!.id)).lockedStock).toBe(0);
    // 购物车原样保留
    expect((await listCart(u.id)).items).toHaveLength(2);
  });

  it('立即购买：不动购物车；未勾选项不受影响', async () => {
    const { u, addr, s } = await setup();
    const { item } = await addToCart(u.id, s[0]!.id, 1);
    await setItemSelected(u.id, item.id, false);
    const order = await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 2 },
      addressId: addr.id,
    });
    expect(order.totalAmount).toBe(10000);
    const cart = await listCart(u.id);
    expect(cart.items).toHaveLength(1);
    expect((await getSku(s[0]!.id)).lockedStock).toBe(2);
  });

  it('他人地址 / 无效地址 → 拒绝', async () => {
    const { u, s } = await setup();
    const u2 = await createUser();
    const otherAddr = await createAddress(u2.id, {});
    await expect(
      placeOrder(u.id, {
        source: { type: 'buyNow', skuId: s[0]!.id, quantity: 1 },
        addressId: otherAddr.id,
      }),
    ).rejects.toThrowError(/地址/);
  });
});
