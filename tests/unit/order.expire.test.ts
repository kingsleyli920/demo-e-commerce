import { beforeEach, describe, expect, it } from 'vitest';
import { orders } from '@/server/db/schema';
import { placeOrder } from '@/server/services/checkout';
import { expireOrders, getOrderByNo, listOrders } from '@/server/services/order';
import { resetDb, getTestDb } from '../db';
import { createAddress, createProductWithSkus, createUser, getSku } from '../factories';

async function makePending(minutesAgoExpired: number | null) {
  const db = getTestDb();
  const u = await createUser();
  const addr = await createAddress(u.id, { isDefault: true });
  const { skus: s } = await createProductWithSkus({}, [
    { spec: { 颜色: '黑' }, price: 5000, stock: 10 },
  ]);
  const order = await placeOrder(u.id, {
    source: { type: 'buyNow', skuId: s[0]!.id, quantity: 1 },
    addressId: addr.id,
  });
  if (minutesAgoExpired !== null) {
    const { eq } = await import('drizzle-orm');
    await db
      .update(orders)
      .set({ expireAt: new Date(Date.now() - minutesAgoExpired * 60_000) })
      .where(eq(orders.id, order.id));
  }
  return { db, u, s, order };
}

describe('P0-6 超时取消', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('过期订单在读取详情时惰性取消并释放库存', async () => {
    const { u, s, order } = await makePending(5);
    const read = await getOrderByNo(u.id, order.orderNo);
    expect(read?.status).toBe('CANCELLED');
    expect(read?.cancelledAt).toBeInstanceOf(Date);
    expect(await getSku(s[0]!.id)).toMatchObject({ stock: 10, lockedStock: 0 });
  });

  it('过期订单在列表读取时惰性取消', async () => {
    const { u, order } = await makePending(5);
    const list = await listOrders(u.id, {});
    expect(list.orders.find((o) => o.orderNo === order.orderNo)?.status).toBe('CANCELLED');
    expect(list.counts.CANCELLED).toBe(1);
  });

  it('未过期订单不动', async () => {
    const { u, s, order } = await makePending(null);
    const read = await getOrderByNo(u.id, order.orderNo);
    expect(read?.status).toBe('PENDING_PAYMENT');
    expect(await getSku(s[0]!.id)).toMatchObject({ lockedStock: 1 });
  });

  it('批量处理：expireOrders 返回处理数量', async () => {
    await makePending(3);
    await makePending(7);
    await makePending(null);
    const n = await expireOrders();
    expect(n).toBe(2);
    expect(await expireOrders()).toBe(0);
  });
});

describe('POST /api/cron/expire-orders', () => {
  beforeEach(async () => {
    await resetDb();
    process.env.CRON_SECRET = 'test-cron-secret';
  });

  it('无/错误 secret → 401；正确 secret → 返回数量', async () => {
    await makePending(5);
    const { POST } = await import('@/app/api/cron/expire-orders/route');
    const bad = await POST(
      new Request('http://localhost/api/cron/expire-orders', { method: 'POST' }),
    );
    expect(bad.status).toBe(401);
    const wrong = await POST(
      new Request('http://localhost/api/cron/expire-orders', {
        method: 'POST',
        headers: { 'x-cron-secret': 'nope' },
      }),
    );
    expect(wrong.status).toBe(401);
    const ok = await POST(
      new Request('http://localhost/api/cron/expire-orders', {
        method: 'POST',
        headers: { 'x-cron-secret': 'test-cron-secret' },
      }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ expired: 1 });
  });
});
