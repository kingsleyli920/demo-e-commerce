import { beforeEach, describe, expect, it } from 'vitest';
import { placeOrder } from '@/server/services/checkout';
import { mockPayCallback } from '@/server/services/payment';
import { resetDb, getTestDb } from '../db';
import { createAddress, createProductWithSkus, createUser, getSku } from '../factories';

describe('P0-4 并发不超卖', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('库存 10 并发 50 单各 1 件：恰 10 成功；支付后 stock=0 locked=0；日志 10 条 lock', async () => {
    const db = getTestDb();
    const u = await createUser();
    const addr = await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({ title: '并发机' }, [
      { spec: { 颜色: '黑' }, price: 9900, stock: 10 },
    ]);
    const skuId = s[0]!.id;

    const results = await Promise.allSettled(
      Array.from({ length: 50 }, () =>
        placeOrder(u.id, { source: { type: 'buyNow', skuId, quantity: 1 }, addressId: addr.id }),
      ),
    );
    const ok = results.filter((r) => r.status === 'fulfilled');
    const fail = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(10);
    expect(fail).toHaveLength(40);
    for (const f of fail as PromiseRejectedResult[]) {
      expect(String(f.reason)).toMatch(/库存不足/);
    }
    expect(await getSku(skuId)).toMatchObject({ stock: 10, lockedStock: 10 });
    const lockLogs = await db.query.inventoryLogs.findMany();
    expect(lockLogs.filter((l) => l.type === 'lock')).toHaveLength(10);

    // 全部支付成功 → stock=0, locked=0，无负数
    let i = 0;
    for (const r of ok as PromiseFulfilledResult<Awaited<ReturnType<typeof placeOrder>>>[]) {
      await mockPayCallback({
        orderNo: r.value.orderNo,
        result: 'success',
        transactionNo: `TX-C-${i++}`,
      });
    }
    expect(await getSku(skuId)).toMatchObject({ stock: 0, lockedStock: 0 });
    const logs = await db.query.inventoryLogs.findMany();
    expect(logs.filter((l) => l.type === 'deduct')).toHaveLength(10);
    expect(logs.some((l) => l.change === 0)).toBe(false);
  }, 60_000);
});
