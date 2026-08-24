import { beforeEach, describe, expect, it } from 'vitest';
import { cartItems } from '@/server/db/schema';
import {
  addToCart,
  getCartBadgeCount,
  getOrCreateCartId,
  listCart,
  removeCartItem,
  setAllSelected,
  setItemSelected,
  updateCartItemQuantity,
} from '@/server/services/cart';
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

  it('addToCart：新增条目 → 合并数量 → 钳制到 min(可售, 99)', async () => {
    const u = await createUser();
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 1000, stock: 5 },
    ]);
    const r1 = await addToCart(u.id, s[0]!.id, 2);
    expect(r1.item.quantity).toBe(2);
    expect(r1.clamped).toBe(false);
    const r2 = await addToCart(u.id, s[0]!.id, 2);
    expect(r2.item.quantity).toBe(4); // 合并
    const r3 = await addToCart(u.id, s[0]!.id, 5);
    expect(r3.item.quantity).toBe(5); // 钳到可售 5
    expect(r3.clamped).toBe(true);
    expect(await getCartBadgeCount(u.id)).toBe(5);
  });

  it('addToCart：数量上限 99（库存充足时）', async () => {
    const u = await createUser();
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 1000, stock: 500 },
    ]);
    const r = await addToCart(u.id, s[0]!.id, 99);
    expect(r.item.quantity).toBe(99);
    const r2 = await addToCart(u.id, s[0]!.id, 1);
    expect(r2.item.quantity).toBe(99);
    expect(r2.clamped).toBe(true);
  });

  it('addToCart：下架 / 售罄 / 不存在的 SKU 拒绝', async () => {
    const u = await createUser();
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 1000, stock: 10, status: 'off' },
      { spec: { 颜色: '白' }, price: 1000, stock: 0 },
      { spec: { 颜色: '红' }, price: 1000, stock: 3, lockedStock: 3 },
    ]);
    await expect(addToCart(u.id, s[0]!.id, 1)).rejects.toThrowError(/失效|下架/);
    await expect(addToCart(u.id, s[1]!.id, 1)).rejects.toThrowError(/售罄/);
    await expect(addToCart(u.id, s[2]!.id, 1)).rejects.toThrowError(/售罄/);
    await expect(addToCart(u.id, 999999, 1)).rejects.toThrowError(/不存在/);
  });

  it('addToCart：条目上限 50（新 SKU 拒绝，已有 SKU 仍可加量）', async () => {
    const u = await createUser();
    const inputs = Array.from({ length: 51 }, (_, i) => ({
      spec: { 编号: `${i}` },
      price: 100,
      stock: 10,
    }));
    const { skus: s } = await createProductWithSkus(
      { attributes: [{ name: '编号', values: inputs.map((x) => x.spec.编号) }] },
      inputs,
    );
    for (let i = 0; i < 50; i++) await addToCart(u.id, s[i]!.id, 1);
    await expect(addToCart(u.id, s[50]!.id, 1)).rejects.toThrowError(/50/);
    const again = await addToCart(u.id, s[0]!.id, 1);
    expect(again.item.quantity).toBe(2);
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

  it('getCartBadgeCount：失效条目（下架/售罄）不计入角标', async () => {
    const db = getTestDb();
    const u = await createUser();
    const cartId = await getOrCreateCartId(u.id);
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 100, stock: 10 },
      { spec: { 颜色: '白' }, price: 100, stock: 10 },
    ]);
    await addToCart(u.id, s[0]!.id, 2);
    await addToCart(u.id, s[1]!.id, 3);
    expect(await getCartBadgeCount(u.id)).toBe(5);
    const { skus: skuTable } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(skuTable).set({ status: 'off' }).where(eq(skuTable.id, s[1]!.id));
    expect(await getCartBadgeCount(u.id)).toBe(2);
    await db.update(skuTable).set({ status: 'on', stock: 0 }).where(eq(skuTable.id, s[1]!.id));
    expect(await getCartBadgeCount(u.id)).toBe(2);
    void cartId;
  });
});

describe('cart service（M3 完整）', () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function setup() {
    const db = getTestDb();
    const u = await createUser();
    const { skus: s } = await createProductWithSkus({ title: '商品A' }, [
      { spec: { 颜色: '黑' }, price: 5000, stock: 10 },
      { spec: { 颜色: '白' }, price: 6000, stock: 4 },
      { spec: { 颜色: '红' }, price: 7000, stock: 10 },
    ]);
    return { db, u, s };
  }

  it('listCart：行数据、合计只统计已勾选有效项', async () => {
    const { u, s } = await setup();
    await addToCart(u.id, s[0]!.id, 2); // 5000×2
    await addToCart(u.id, s[1]!.id, 1); // 6000×1
    const view = await listCart(u.id);
    expect(view.items).toHaveLength(2);
    expect(view.invalidItems).toHaveLength(0);
    expect(view.selectedCount).toBe(2);
    expect(view.totalAmount).toBe(16000);
    expect(view.items.map((i) => i.title)).toEqual(['商品A', '商品A']);
    // 取消勾选一行
    const first = view.items.find((i) => i.skuId === s[0]!.id)!;
    await setItemSelected(u.id, first.id, false);
    const v2 = await listCart(u.id);
    expect(v2.totalAmount).toBe(6000);
    expect(v2.allSelected).toBe(false);
  });

  it('updateCartItemQuantity：钳制 1..min(可售,99)；0 或负数拒绝', async () => {
    const { u, s } = await setup();
    const { item } = await addToCart(u.id, s[1]!.id, 1); // 库存 4
    const r1 = await updateCartItemQuantity(u.id, item.id, 3);
    expect(r1.item.quantity).toBe(3);
    expect(r1.clamped).toBe(false);
    const r2 = await updateCartItemQuantity(u.id, item.id, 9);
    expect(r2.item.quantity).toBe(4);
    expect(r2.clamped).toBe(true);
    await expect(updateCartItemQuantity(u.id, item.id, 0)).rejects.toThrowError(/数量/);
  });

  it('removeCartItem：删除行；他人条目 404', async () => {
    const { u, s } = await setup();
    const u2 = await createUser();
    const { item } = await addToCart(u.id, s[0]!.id, 1);
    await expect(removeCartItem(u2.id, item.id)).rejects.toThrowError(/不存在/);
    await removeCartItem(u.id, item.id);
    expect((await listCart(u.id)).items).toHaveLength(0);
  });

  it('全选/取消全选', async () => {
    const { u, s } = await setup();
    await addToCart(u.id, s[0]!.id, 1);
    await addToCart(u.id, s[1]!.id, 1);
    await setAllSelected(u.id, false);
    const v = await listCart(u.id);
    expect(v.items.every((i) => !i.selected)).toBe(true);
    expect(v.totalAmount).toBe(0);
    await setAllSelected(u.id, true);
    expect((await listCart(u.id)).totalAmount).toBe(11000);
  });

  it('失效项：下架或可售 0 → 单独分区、不可勾选、不计合计、可删除', async () => {
    const { db, u, s } = await setup();
    await addToCart(u.id, s[0]!.id, 1);
    await addToCart(u.id, s[1]!.id, 2);
    const { skus: skuTable } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(skuTable).set({ status: 'off' }).where(eq(skuTable.id, s[0]!.id));
    await db.update(skuTable).set({ stock: 0 }).where(eq(skuTable.id, s[1]!.id));
    const v = await listCart(u.id);
    expect(v.items).toHaveLength(0);
    expect(v.invalidItems).toHaveLength(2);
    expect(v.invalidItems.map((i) => i.invalidReason).sort()).toEqual(['off', 'soldout']);
    expect(v.totalAmount).toBe(0);
    // 失效项不可勾选
    await expect(setItemSelected(u.id, v.invalidItems[0]!.id, true)).rejects.toThrowError(/失效/);
    // 可删除
    await removeCartItem(u.id, v.invalidItems[0]!.id);
    expect((await listCart(u.id)).invalidItems).toHaveLength(1);
  });

  it('价格变动：与加购时不同 → priceChanged 标记，合计按实时价', async () => {
    const { db, u, s } = await setup();
    await addToCart(u.id, s[0]!.id, 2); // priceAtAdd 5000
    const { skus: skuTable } = await import('@/server/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(skuTable).set({ price: 4500 }).where(eq(skuTable.id, s[0]!.id));
    const v = await listCart(u.id);
    expect(v.items[0]!.priceChanged).toBe(true);
    expect(v.items[0]!.price).toBe(4500);
    expect(v.items[0]!.priceAtAdd).toBe(5000);
    expect(v.totalAmount).toBe(9000);
  });
});
