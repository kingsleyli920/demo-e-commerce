import { beforeEach, describe, expect, it } from 'vitest';
import { placeOrder } from '@/server/services/checkout';
import { getOrderByNo } from '@/server/services/order';
import { mockPayCallback } from '@/server/services/payment';
import { cancelOrder } from '@/server/services/order';
import { resetDb, getTestDb } from '../db';
import { createAddress, createProductWithSkus, createUser, getSku } from '../factories';

describe('P0-6 Mock 支付回调', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup(stock = 10) {
    const db = getTestDb();
    const u = await createUser();
    const addr = await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 12000, stock },
    ]);
    const order = await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 2 },
      addressId: addr.id,
    });
    return { db, u, s, order };
  }

  it('成功：payments SUCCESS + 订单 PAID + paid_at + 扣库存', async () => {
    const { db, u, s, order } = await setup();
    const r = await mockPayCallback({
      orderNo: order.orderNo,
      result: 'success',
      transactionNo: 'TX-A',
    });
    expect(r.status).toBe('SUCCESS');
    expect(r.idempotent).toBe(false);
    const fresh = await getOrderByNo(u.id, order.orderNo);
    expect(fresh?.status).toBe('PAID');
    expect(fresh?.paidAt).toBeInstanceOf(Date);
    expect(await getSku(s[0]!.id)).toMatchObject({ stock: 8, lockedStock: 0 });
    const pays = await db.query.payments.findMany();
    expect(pays).toHaveLength(1);
    expect(pays[0]).toMatchObject({ status: 'SUCCESS', transactionNo: 'TX-A' });
    expect(pays[0]!.paidAt).toBeInstanceOf(Date);
  });

  it('失败：payments FAILED、订单仍 PENDING 可重试成功', async () => {
    const { db, u, s, order } = await setup();
    const r = await mockPayCallback({
      orderNo: order.orderNo,
      result: 'fail',
      transactionNo: 'TX-F1',
    });
    expect(r.status).toBe('FAILED');
    expect((await getOrderByNo(u.id, order.orderNo))?.status).toBe('PENDING_PAYMENT');
    expect(await getSku(s[0]!.id)).toMatchObject({ stock: 10, lockedStock: 2 });
    // 重试成功
    const r2 = await mockPayCallback({
      orderNo: order.orderNo,
      result: 'success',
      transactionNo: 'TX-F2',
    });
    expect(r2.status).toBe('SUCCESS');
    expect((await getOrderByNo(u.id, order.orderNo))?.status).toBe('PAID');
    const pays = await db.query.payments.findMany({ orderBy: (t, { asc }) => [asc(t.id)] });
    expect(pays.map((p) => p.status)).toEqual(['FAILED', 'SUCCESS']);
  });

  it('幂等：同 transaction_no 重复回调不重复扣减', async () => {
    const { s, order } = await setup();
    await mockPayCallback({ orderNo: order.orderNo, result: 'success', transactionNo: 'TX-B' });
    const again = await mockPayCallback({
      orderNo: order.orderNo,
      result: 'success',
      transactionNo: 'TX-B',
    });
    expect(again.idempotent).toBe(true);
    expect(again.status).toBe('SUCCESS');
    expect(await getSku(s[0]!.id)).toMatchObject({ stock: 8, lockedStock: 0 });
  });

  it('幂等：已 PAID 订单不同 transaction_no 重复回调 → 成功且不重复扣减', async () => {
    const { db, s, order } = await setup();
    await mockPayCallback({ orderNo: order.orderNo, result: 'success', transactionNo: 'TX-C1' });
    const again = await mockPayCallback({
      orderNo: order.orderNo,
      result: 'success',
      transactionNo: 'TX-C2',
    });
    expect(again.idempotent).toBe(true);
    expect(await getSku(s[0]!.id)).toMatchObject({ stock: 8, lockedStock: 0 });
    expect(await db.query.payments.findMany()).toHaveLength(1); // 不新增支付单
  });

  it('已取消订单回调 → 400 拒绝', async () => {
    const { u, order } = await setup();
    await cancelOrder(u.id, order.orderNo);
    await expect(
      mockPayCallback({ orderNo: order.orderNo, result: 'success', transactionNo: 'TX-D' }),
    ).rejects.toThrowError(/取消/);
  });

  it('不存在的订单 → NOT_FOUND', async () => {
    await expect(
      mockPayCallback({
        orderNo: 'ORD202601010101019999',
        result: 'success',
        transactionNo: 'TX-E',
      }),
    ).rejects.toThrowError(/不存在/);
  });
});
