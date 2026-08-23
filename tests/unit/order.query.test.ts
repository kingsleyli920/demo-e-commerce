import { beforeEach, describe, expect, it } from 'vitest';
import { placeOrder } from '@/server/services/checkout';
import {
  cancelOrder,
  confirmReceipt,
  getOrderByNo,
  getOrderDetail,
  listOrders,
  shipOrder,
} from '@/server/services/order';
import { mockPayCallback } from '@/server/services/payment';
import { resetDb, getTestDb } from '../db';
import { createAddress, createProductWithSkus, createUser } from '../factories';

describe('P0-7 订单查询/操作', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const u = await createUser();
    const addr = await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({ title: '订单机' }, [
      { spec: { 颜色: '黑' }, price: 5000, stock: 50 },
    ]);
    const mk = () =>
      placeOrder(u.id, {
        source: { type: 'buyNow', skuId: s[0]!.id, quantity: 1 },
        addressId: addr.id,
      });
    return { u, addr, s, mk };
  }

  it('Tab 过滤与计数正确；按创建时间倒序', async () => {
    const { u, mk } = await setup();
    const o1 = await mk(); // PENDING
    const o2 = await mk();
    await mockPayCallback({ orderNo: o2.orderNo, result: 'success', transactionNo: 'T1' }); // PAID
    const o3 = await mk();
    await mockPayCallback({ orderNo: o3.orderNo, result: 'success', transactionNo: 'T2' });
    await shipOrder(o3.orderNo, { carrier: '顺丰', trackingNo: 'SF1' }); // SHIPPED
    const o4 = await mk();
    await cancelOrder(u.id, o4.orderNo); // CANCELLED

    const all = await listOrders(u.id, {});
    expect(all.orders.map((o) => o.orderNo)).toEqual([
      o4.orderNo,
      o3.orderNo,
      o2.orderNo,
      o1.orderNo,
    ]);
    expect(all.counts).toMatchObject({
      ALL: 4,
      PENDING_PAYMENT: 1,
      PAID: 1,
      SHIPPED: 1,
      COMPLETED: 0,
      CANCELLED: 1,
    });
    const paidTab = await listOrders(u.id, { status: 'PAID' });
    expect(paidTab.orders.map((o) => o.orderNo)).toEqual([o2.orderNo]);
    // 明细带 items
    expect(all.orders[0]!.items[0]!.titleSnapshot).toBe('订单机');
  });

  it('取消：仅待付款可取消；其它状态服务端拒绝', async () => {
    const { u, mk } = await setup();
    const o = await mk();
    await mockPayCallback({ orderNo: o.orderNo, result: 'success', transactionNo: 'T3' });
    await expect(cancelOrder(u.id, o.orderNo)).rejects.toThrowError(/状态|取消/);
  });

  it('确认收货：仅 SHIPPED → COMPLETED；其它状态拒绝', async () => {
    const { u, mk } = await setup();
    const o = await mk();
    await expect(confirmReceipt(u.id, o.orderNo)).rejects.toThrowError(/状态|收货/);
    await mockPayCallback({ orderNo: o.orderNo, result: 'success', transactionNo: 'T4' });
    await expect(confirmReceipt(u.id, o.orderNo)).rejects.toThrowError(/状态|收货/);
    await shipOrder(o.orderNo, { carrier: '顺丰', trackingNo: 'SF2' });
    const done = await confirmReceipt(u.id, o.orderNo);
    expect(done.status).toBe('COMPLETED');
    expect(done.completedAt).toBeInstanceOf(Date);
  });

  it('发货：仅 PAID 可发货；写 shipping 与 shipped_at', async () => {
    const { mk } = await setup();
    const o = await mk();
    await expect(shipOrder(o.orderNo, { carrier: 'X', trackingNo: '1' })).rejects.toThrowError(
      /状态|发货/,
    );
    await mockPayCallback({ orderNo: o.orderNo, result: 'success', transactionNo: 'T5' });
    const shipped = await shipOrder(o.orderNo, { carrier: '顺丰速运', trackingNo: 'SF999' });
    expect(shipped.status).toBe('SHIPPED');
    expect(shipped.shipping).toEqual({ carrier: '顺丰速运', trackingNo: 'SF999' });
    expect(shipped.shippedAt).toBeInstanceOf(Date);
  });

  it('历史订单不受商品改价影响（快照）', async () => {
    const { u, mk, s } = await setup();
    void u;
    const db = getTestDb();
    const o = await mk();
    const { skus: skuTable } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(skuTable).set({ price: 9999 }).where(eq(skuTable.id, s[0]!.id));
    const detail = await getOrderDetail(u.id, o.orderNo);
    expect(detail?.items[0]!.unitPrice).toBe(5000);
    expect(detail?.order.totalAmount).toBe(5000);
  });

  it('越权：他人订单查询返回 null；他人取消/收货拒绝', async () => {
    const { mk } = await setup();
    const o = await mk();
    const u2 = await createUser();
    expect(await getOrderByNo(u2.id, o.orderNo)).toBeNull();
    expect(await getOrderDetail(u2.id, o.orderNo)).toBeNull();
    await expect(cancelOrder(u2.id, o.orderNo)).rejects.toThrowError(/不存在/);
    await expect(confirmReceipt(u2.id, o.orderNo)).rejects.toThrowError(/不存在/);
  });
});
