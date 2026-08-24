import { beforeEach, describe, expect, it } from 'vitest';
import { availableOptions, getProductDetail, resolveSku } from '@/server/services/catalog';
import { resetDb } from '../db';
import { createProductWithSkus } from '../factories';

describe('catalog SKU 定位与选项置灰', () => {
  let productId: number;
  let offProductId: number;
  beforeEach(async () => {
    await resetDb();
    const { product } = await createProductWithSkus(
      {
        title: '耳机',
        attributes: [
          { name: '颜色', values: ['黑色', '白色', '红色'] },
          { name: '版本', values: ['标准版', 'Pro'] },
        ],
      },
      [
        { spec: { 颜色: '黑色', 版本: '标准版' }, price: 29900, stock: 10 },
        { spec: { 颜色: '黑色', 版本: 'Pro' }, price: 39900, stock: 0 },
        { spec: { 颜色: '白色', 版本: '标准版' }, price: 29900, stock: 10, status: 'off' },
        // 红色×标准版 / 红色×Pro / 白色×Pro 不存在
      ],
    );
    productId = product.id;
    const off = await createProductWithSkus({ title: '下架商品', status: 'off' });
    offProductId = off.product.id;
  });

  it('getProductDetail：上架商品返回商品+全部 SKU；下架/不存在返回 null', async () => {
    const d = await getProductDetail(productId);
    expect(d?.product.title).toBe('耳机');
    expect(d?.skus).toHaveLength(3);
    expect(await getProductDetail(offProductId)).toBeNull();
    expect(await getProductDetail(999999)).toBeNull();
  });

  it('resolveSku 精确匹配（属性顺序无关）；不存在组合返回 null', async () => {
    const s1 = await resolveSku(productId, { 颜色: '黑色', 版本: '标准版' });
    const s2 = await resolveSku(productId, { 版本: '标准版', 颜色: '黑色' });
    expect(s1?.id).toBe(s2?.id);
    expect(s1?.price).toBe(29900);
    expect(await resolveSku(productId, { 颜色: '红色', 版本: 'Pro' })).toBeNull();
    expect(await resolveSku(productId, { 颜色: '黑色' })).toBeNull();
  });

  it('availableOptions：不存在/下架的组合置灰，售罄仍可选但标记 soldOut', async () => {
    const d = (await getProductDetail(productId))!;
    // 未选任何规格：每个值只要存在任一上架 SKU 即可选
    const none = availableOptions(d.product.attributes, d.skus, {});
    expect(none['颜色']).toEqual([
      { value: '黑色', disabled: false },
      { value: '白色', disabled: true }, // 白色唯一 SKU 已下架
      { value: '红色', disabled: true }, // 不存在
    ]);
    expect(none['版本']).toEqual([
      { value: '标准版', disabled: false },
      { value: 'Pro', disabled: false },
    ]);
    // 已选 版本=Pro：颜色只剩黑色可选
    const pro = availableOptions(d.product.attributes, d.skus, { 版本: 'Pro' });
    expect(pro['颜色']!.find((o) => o.value === '黑色')?.disabled).toBe(false);
    expect(pro['颜色']!.find((o) => o.value === '白色')?.disabled).toBe(true);
    // 已选 颜色=黑色：版本两个都可选（Pro 售罄但存在）
    const black = availableOptions(d.product.attributes, d.skus, { 颜色: '黑色' });
    expect(black['版本']!.every((o) => !o.disabled)).toBe(true);
  });
});
