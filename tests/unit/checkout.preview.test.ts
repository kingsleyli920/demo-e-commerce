import { beforeEach, describe, expect, it } from 'vitest';
import { FREE_SHIPPING_THRESHOLD, FREIGHT_FEE } from '@/lib/freight';
import { addToCart, setItemSelected, listCart } from '@/server/services/cart';
import { previewCheckout } from '@/server/services/checkout';
import { resetDb, getTestDb } from '../db';
import { createAddress, createProductWithSkus, createUser } from '../factories';

describe('checkout.previewCheckout', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('运费边界：9899 收 1000；9900 免运费；应付 = 合计 + 运费', async () => {
    const u = await createUser();
    await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 规格: 'A' }, price: 9899, stock: 10 },
      { spec: { 规格: 'B' }, price: 9900, stock: 10 },
    ]);
    const p1 = await previewCheckout(u.id, { type: 'buyNow', skuId: s[0]!.id, quantity: 1 });
    expect(p1.totalAmount).toBe(FREE_SHIPPING_THRESHOLD - 1);
    expect(p1.freight).toBe(FREIGHT_FEE);
    expect(p1.payAmount).toBe(9899 + FREIGHT_FEE);
    const p2 = await previewCheckout(u.id, { type: 'buyNow', skuId: s[1]!.id, quantity: 1 });
    expect(p2.freight).toBe(0);
    expect(p2.payAmount).toBe(9900);
  });

  it('购物车来源：只计已勾选项；未勾选不计入', async () => {
    const u = await createUser();
    await createAddress(u.id, {});
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 规格: 'A' }, price: 3000, stock: 10 },
      { spec: { 规格: 'B' }, price: 4000, stock: 10 },
    ]);
    await addToCart(u.id, s[0]!.id, 2);
    const { item } = await addToCart(u.id, s[1]!.id, 1);
    await setItemSelected(u.id, item.id, false);
    const p = await previewCheckout(u.id, { type: 'cart' });
    expect(p.items).toHaveLength(1);
    expect(p.totalAmount).toBe(6000);
  });

  it('勾选项中含失效项 → 拒绝并提示', async () => {
    const db = getTestDb();
    const u = await createUser();
    await createAddress(u.id, {});
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 规格: 'A' }, price: 3000, stock: 10 },
    ]);
    await addToCart(u.id, s[0]!.id, 1);
    const { skus: skuTable } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(skuTable).set({ status: 'off' }).where(eq(skuTable.id, s[0]!.id));
    await expect(previewCheckout(u.id, { type: 'cart' })).rejects.toThrowError(/失效/);
  });

  it('空勾选 / 空购物车 → 拒绝', async () => {
    const u = await createUser();
    await createAddress(u.id, {});
    await expect(previewCheckout(u.id, { type: 'cart' })).rejects.toThrowError(/没有|为空/);
  });

  it('buyNow：下架/售罄/数量超可售 → 拒绝；地址列表与默认地址返回', async () => {
    const u = await createUser();
    const a = await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 规格: 'A' }, price: 3000, stock: 2 },
      { spec: { 规格: 'B' }, price: 3000, stock: 10, status: 'off' },
    ]);
    await expect(
      previewCheckout(u.id, { type: 'buyNow', skuId: s[1]!.id, quantity: 1 }),
    ).rejects.toThrowError(/下架|失效/);
    await expect(
      previewCheckout(u.id, { type: 'buyNow', skuId: s[0]!.id, quantity: 3 }),
    ).rejects.toThrowError(/库存不足/);
    const p = await previewCheckout(u.id, { type: 'buyNow', skuId: s[0]!.id, quantity: 2 });
    expect(p.address?.id).toBe(a.id);
    expect(p.addresses).toHaveLength(1);
  });
});
