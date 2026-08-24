import { beforeEach, describe, expect, it } from 'vitest';
import { placeOrder } from '@/server/services/checkout';
import { mockPayCallback } from '@/server/services/payment';
import { shipOrder } from '@/server/services/order';
import {
  getAdminStats,
  listAdminOrders,
  listAdminProducts,
  setProductStatus,
  updateSku,
} from '@/server/services/admin';
import { resetDb, getTestDb } from '../db';
import { createAddress, createProductWithSkus, createUser, getSku } from '../factories';

describe('P0-8 admin service', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('上下架切换即时生效', async () => {
    const db = getTestDb();
    const { product } = await createProductWithSkus({ title: '开关机' });
    await setProductStatus(product.id, 'off');
    const { products } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    expect(
      (await db.query.products.findFirst({ where: eq(products.id, product.id) }))?.status,
    ).toBe('off');
    await setProductStatus(product.id, 'on');
    expect(
      (await db.query.products.findFirst({ where: eq(products.id, product.id) }))?.status,
    ).toBe('on');
    await expect(setProductStatus(999999, 'on')).rejects.toThrowError(/不存在/);
  });

  it('SKU 价格/原价/库存更新；更新写 admin_adjust 日志并同步 min_price', async () => {
    const db = getTestDb();
    const { product, skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 5000, stock: 10 },
      { spec: { 颜色: '白' }, price: 6000, stock: 10 },
    ]);
    await updateSku(s[0]!.id, { price: 5500, originalPrice: 6900, stock: 8 });
    const sku = await getSku(s[0]!.id);
    expect(sku).toMatchObject({ price: 5500, originalPrice: 6900, stock: 8 });
    const logs = await db.query.inventoryLogs.findMany();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ skuId: s[0]!.id, change: -2, type: 'admin_adjust' });
    // min_price 派生更新
    const { products } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    expect(
      (await db.query.products.findFirst({ where: eq(products.id, product.id) }))?.minPrice,
    ).toBe(5500);
    // 库存不变不写日志
    await updateSku(s[0]!.id, { price: 5500, originalPrice: null, stock: 8 });
    expect(await db.query.inventoryLogs.findMany()).toHaveLength(1);
  });

  it('库存不得小于 locked_stock；非法价格拒绝', async () => {
    const u = await createUser();
    const addr = await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 5000, stock: 10 },
    ]);
    await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 3 },
      addressId: addr.id,
    });
    await expect(
      updateSku(s[0]!.id, { price: 5000, originalPrice: null, stock: 2 }),
    ).rejects.toThrowError(/锁定|不能小于/);
    await updateSku(s[0]!.id, { price: 5000, originalPrice: null, stock: 3 }); // 恰好等于 locked 允许
    expect((await getSku(s[0]!.id)).stock).toBe(3);
    await expect(
      updateSku(s[0]!.id, { price: -1, originalPrice: null, stock: 5 }),
    ).rejects.toThrowError(/价格/);
    await expect(
      updateSku(999999, { price: 100, originalPrice: null, stock: 1 }),
    ).rejects.toThrowError(/不存在/);
  });

  it('发货仅 PAID（复用 order.shipOrder，已在 order.query 测试覆盖状态约束）', async () => {
    const u = await createUser();
    const addr = await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 5000, stock: 10 },
    ]);
    const o = await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 1 },
      addressId: addr.id,
    });
    await expect(shipOrder(o.orderNo, { carrier: 'X', trackingNo: '1' })).rejects.toThrowError(
      /发货/,
    );
    await mockPayCallback({ orderNo: o.orderNo, result: 'success', transactionNo: 'ADM-1' });
    const shipped = await shipOrder(o.orderNo, { carrier: '顺丰', trackingNo: 'SF-1' });
    expect(shipped.status).toBe('SHIPPED');
  });

  it('统计卡片：今日订单数 / 已支付 GMV / 待发货数 / 售罄 SKU 数', async () => {
    const db = getTestDb();
    const u = await createUser();
    const addr = await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 10000, stock: 10 },
      { spec: { 颜色: '白' }, price: 10000, stock: 0 }, // 售罄
      { spec: { 颜色: '红' }, price: 10000, stock: 5, status: 'off' }, // 下架不计售罄
    ]);
    const o1 = await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 1 },
      addressId: addr.id,
    });
    const o2 = await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 2 },
      addressId: addr.id,
    });
    await mockPayCallback({ orderNo: o1.orderNo, result: 'success', transactionNo: 'ST-1' }); // 10000，PAID
    await mockPayCallback({ orderNo: o2.orderNo, result: 'success', transactionNo: 'ST-2' }); // 20000，PAID
    await shipOrder(o2.orderNo, { carrier: null, trackingNo: null }); // 发货 → 不再待发货
    // 一笔昨日订单（不计今日）
    const o3 = await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 1 },
      addressId: addr.id,
    });
    const { orders } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await db
      .update(orders)
      .set({ createdAt: new Date(Date.now() - 2 * 86400_000) })
      .where(eq(orders.id, o3.id));

    const stats = await getAdminStats();
    expect(stats.todayOrders).toBe(2);
    expect(stats.paidGmv).toBe(30000);
    expect(stats.pendingShipment).toBe(1);
    expect(stats.soldOutSkus).toBe(1);
  });

  it('商品列表分页/搜索；订单列表状态筛选（含全部用户订单）', async () => {
    const u1 = await createUser();
    const u2 = await createUser();
    const a1 = await createAddress(u1.id, { isDefault: true });
    const a2 = await createAddress(u2.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({ title: '后台搜索目标机' }, [
      { spec: { 颜色: '黑' }, price: 9900, stock: 50 },
    ]);
    await createProductWithSkus({ title: '另一台', status: 'off' });
    const list = await listAdminProducts({ q: '搜索目标' });
    expect(list.total).toBe(1);
    expect(list.items[0]!.title).toBe('后台搜索目标机');
    // 下架商品也出现在后台列表
    const all = await listAdminProducts({});
    expect(all.total).toBe(2);

    const o1 = await placeOrder(u1.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 1 },
      addressId: a1.id,
    });
    await placeOrder(u2.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 1 },
      addressId: a2.id,
    });
    await mockPayCallback({ orderNo: o1.orderNo, result: 'success', transactionNo: 'AL-1' });
    const paid = await listAdminOrders({ status: 'PAID' });
    expect(paid.total).toBe(1);
    expect(paid.items[0]!.orderNo).toBe(o1.orderNo);
    const allOrders = await listAdminOrders({});
    expect(allOrders.total).toBe(2);
    expect(new Set(allOrders.items.map((o) => o.userId)).size).toBe(2);
  });
});
