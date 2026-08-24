import { beforeEach, describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/safe-next';
import { REGIONS } from '@/lib/regions.zh';
import { isSpecComplete, priceRange } from '@/lib/sku';
import { addressInputSchema } from '@/server/dto/address';
import { parseSearchQuery, pickSearchParams, addToCartSchema } from '@/server/dto/catalog';
import { AppError } from '@/server/errors';
import { getAdminOrder, getAdminProduct, updateSku } from '@/server/services/admin';
import { getDefaultAddress } from '@/server/services/address';
import { previewCheckout, placeOrder } from '@/server/services/checkout';
import { transitionTimestampField } from '@/server/services/order';
import { getTestDb, resetDb } from '../db';
import { createAddress, createProductWithSkus, createUser } from '../factories';

describe('lib/safe-next', () => {
  it('放行站内路径，拒绝外站/协议相对/反斜杠变体', () => {
    expect(safeNextPath('/orders')).toBe('/orders');
    expect(safeNextPath('/p/1?a=b')).toBe('/p/1?a=b');
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('/a\\b')).toBe('/');
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath(undefined, '/cart')).toBe('/cart');
  });
});

describe('dto/catalog', () => {
  it('parseSearchQuery：默认值、容错、数组参数取首个', () => {
    expect(parseSearchQuery({})).toMatchObject({ sort: 'default', page: 1 });
    expect(
      parseSearchQuery({ q: ' 耳机 ', min: '100', max: '300', sort: 'price_asc', page: '2' }),
    ).toMatchObject({
      q: '耳机',
      min: 100,
      max: 300,
      sort: 'price_asc',
      page: 2,
    });
    expect(parseSearchQuery({ sort: 'bogus', page: '-3', min: 'abc' })).toMatchObject({
      sort: 'default',
      page: 1,
      min: undefined,
    });
    expect(pickSearchParams({ q: ['a', 'b'], x: undefined })).toEqual({ q: 'a', x: undefined });
    expect(parseSearchQuery({ q: ['蓝牙', '第二个'] }).q).toBe('蓝牙');
  });

  it('addToCartSchema：默认数量 1、非法拒绝', () => {
    expect(addToCartSchema.parse({ skuId: '10191' })).toEqual({ skuId: 10191, quantity: 1 });
    expect(addToCartSchema.safeParse({ skuId: 'x' }).success).toBe(false);
    expect(addToCartSchema.safeParse({ skuId: 1, quantity: 100 }).success).toBe(false);
  });
});

describe('dto/address 与 regions', () => {
  it('addressInputSchema 校验手机号与必填', () => {
    const ok = addressInputSchema.safeParse({
      receiver: '张三',
      phone: '13800001111',
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail: '测试路 1 号',
    });
    expect(ok.success).toBe(true);
    expect(ok.success && ok.data.isDefault).toBe(false);
    expect(
      addressInputSchema.safeParse({
        receiver: '张',
        phone: '13800001111',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '测试路 1 号',
      }).success,
    ).toBe(false);
    expect(
      addressInputSchema.safeParse({
        receiver: '张三',
        phone: '238',
        province: '广东省',
        city: '深圳市',
        district: '南山区',
        detail: '测试路 1 号',
      }).success,
    ).toBe(false);
  });

  it('REGIONS 结构：每省至少一市、每市至少一区', () => {
    expect(REGIONS.length).toBeGreaterThanOrEqual(8);
    for (const r of REGIONS) {
      expect(r.cities.length).toBeGreaterThan(0);
      for (const c of r.cities) expect(c.districts.length).toBeGreaterThan(0);
    }
  });
});

describe('lib/sku 纯函数补充', () => {
  it('isSpecComplete / priceRange', () => {
    const attrs = [
      { name: '颜色', values: ['黑', '白'] },
      { name: '版本', values: ['标准'] },
    ];
    expect(isSpecComplete(attrs, { 颜色: '黑', 版本: '标准' })).toBe(true);
    expect(isSpecComplete(attrs, { 颜色: '黑' })).toBe(false);
    expect(isSpecComplete(attrs, { 颜色: '', 版本: '标准' })).toBe(false);
    expect(
      priceRange([
        { price: 200, status: 'on' },
        { price: 100, status: 'on' },
        { price: 50, status: 'off' },
      ]),
    ).toEqual([100, 200]);
    expect(priceRange([{ price: 100, status: 'off' }])).toBeNull();
  });
});

describe('order.transitionTimestampField 非法输入', () => {
  it('PENDING_PAYMENT 无时间戳字段 → 抛错', () => {
    expect(() => transitionTimestampField('PENDING_PAYMENT')).toThrowError(AppError);
  });
});

describe('service 分支补充（DB）', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('getDefaultAddress：默认优先，无默认取第一条，空返回 null', async () => {
    const u = await createUser();
    expect(await getDefaultAddress(u.id)).toBeNull();
    const a = await createAddress(u.id, { isDefault: true });
    const b = await createAddress(u.id, {});
    expect((await getDefaultAddress(u.id))?.id).toBe(a.id);
    const db = getTestDb();
    const { addresses } = await import('@/server/db/schema');
    await db.update(addresses).set({ isDefault: false });
    const got = await getDefaultAddress(u.id);
    expect([a.id, b.id]).toContain(got?.id);
  });

  it('getAdminProduct / getAdminOrder：存在与不存在', async () => {
    const u = await createUser();
    const addr = await createAddress(u.id, { isDefault: true });
    const { product, skus: s } = await createProductWithSkus({ title: '后台详情机' }, [
      { spec: { 颜色: '黑' }, price: 5000, stock: 10 },
    ]);
    expect(await getAdminProduct(999999)).toBeNull();
    const detail = await getAdminProduct(product.id);
    expect(detail?.product.title).toBe('后台详情机');
    expect(detail?.skus).toHaveLength(1);
    const order = await placeOrder(u.id, {
      source: { type: 'buyNow', skuId: s[0]!.id, quantity: 1 },
      addressId: addr.id,
    });
    expect(await getAdminOrder('ORD000000000000000000')).toBeNull();
    const adminOrder = await getAdminOrder(order.orderNo);
    expect(adminOrder?.order.id).toBe(order.id);
    expect(adminOrder?.buyerEmail).toContain('@');
    expect(adminOrder?.items).toHaveLength(1);
  });

  it('updateSku：划线价非法拒绝；previewCheckout buyNow 数量非法拒绝', async () => {
    const u = await createUser();
    await createAddress(u.id, { isDefault: true });
    const { skus: s } = await createProductWithSkus({}, [
      { spec: { 颜色: '黑' }, price: 5000, stock: 10 },
    ]);
    await expect(
      updateSku(s[0]!.id, { price: 5000, originalPrice: -2, stock: 5 }),
    ).rejects.toThrowError(/划线价/);
    await expect(
      updateSku(s[0]!.id, { price: 5000, originalPrice: null, stock: -1 }),
    ).rejects.toThrowError(/库存/);
    await expect(
      previewCheckout(u.id, { type: 'buyNow', skuId: s[0]!.id, quantity: 0 }),
    ).rejects.toThrowError(/数量/);
    await expect(
      previewCheckout(u.id, { type: 'buyNow', skuId: 999999, quantity: 1 }),
    ).rejects.toThrowError(/不存在/);
  });
});
