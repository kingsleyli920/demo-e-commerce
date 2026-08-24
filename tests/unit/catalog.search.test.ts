import { beforeEach, describe, expect, it } from 'vitest';
import { searchProducts } from '@/server/services/catalog';
import { resetDb } from '../db';
import { createCategory, createProductWithSkus } from '../factories';

describe('catalog.searchProducts', () => {
  let parentId: number;
  let childAId: number;

  beforeEach(async () => {
    await resetDb();
    const parent = await createCategory({ name: '数码', slug: 'digital', sort: 1 });
    const childA = await createCategory({
      name: '耳机',
      slug: 'audio',
      parentId: parent.id,
      sort: 1,
    });
    const childB = await createCategory({
      name: '手机',
      slug: 'phones',
      parentId: parent.id,
      sort: 2,
    });
    const other = await createCategory({ name: '服饰', slug: 'fashion', sort: 2 });
    parentId = parent.id;
    childAId = childA.id;
    const d = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000);
    await createProductWithSkus(
      {
        categoryId: childA.id,
        title: 'Apple AirPods 无线蓝牙耳机',
        subtitle: '主动降噪',
        brand: 'Apple',
        salesCount: 500,
        createdAt: d(10),
      },
      [{ spec: { 颜色: '白' }, price: 129900, stock: 10 }],
    );
    await createProductWithSkus(
      {
        categoryId: childA.id,
        title: 'Beats 运动耳机',
        subtitle: '跑步防汗',
        brand: 'Beats',
        salesCount: 900,
        createdAt: d(5),
      },
      [
        { spec: { 颜色: '黑' }, price: 25900, stock: 10 },
        { spec: { 颜色: '红' }, price: 29900, stock: 10 },
      ],
    );
    await createProductWithSkus(
      {
        categoryId: childB.id,
        title: 'Galaxy S24 手机',
        subtitle: 'AI 旗舰',
        brand: 'SAMSUNG',
        salesCount: 300,
        createdAt: d(1),
      },
      [{ spec: { 颜色: '黑' }, price: 599900, stock: 10 }],
    );
    await createProductWithSkus(
      {
        categoryId: other.id,
        title: '纯棉 T 恤',
        subtitle: '夏季新款 earphone 印花',
        brand: 'Uniqlo',
        salesCount: 50,
        createdAt: d(2),
      },
      [{ spec: { 尺码: 'M' }, price: 9900, stock: 10 }],
    );
    await createProductWithSkus(
      { categoryId: childA.id, title: '已下架耳机', status: 'off', salesCount: 9999 },
      [{ spec: { 颜色: '黑' }, price: 100, stock: 10 }],
    );
  });

  it('关键词匹配标题/品牌/副标题且不区分大小写', async () => {
    const byTitle = await searchProducts({ q: '耳机' });
    expect(byTitle.items.map((p) => p.title).sort()).toEqual([
      'Apple AirPods 无线蓝牙耳机',
      'Beats 运动耳机',
    ]);
    const byBrand = await searchProducts({ q: 'apple' });
    expect(byBrand.items.map((p) => p.title)).toEqual(['Apple AirPods 无线蓝牙耳机']);
    const byBrandUpper = await searchProducts({ q: 'samsung' });
    expect(byBrandUpper.total).toBe(1);
    const bySubtitle = await searchProducts({ q: '跑步' });
    expect(bySubtitle.items.map((p) => p.title)).toEqual(['Beats 运动耳机']);
    const bySubtitleEn = await searchProducts({ q: 'EARPHONE' });
    expect(bySubtitleEn.items.map((p) => p.title)).toEqual(['纯棉 T 恤']);
  });

  it('空关键词返回全部上架商品（不含下架）', async () => {
    const all = await searchProducts({});
    expect(all.total).toBe(4);
    expect(all.items.some((p) => p.title === '已下架耳机')).toBe(false);
  });

  it('父类目包含子类目商品；叶子类目只含自身', async () => {
    const parent = await searchProducts({ categoryId: parentId });
    expect(parent.items.map((p) => p.title).sort()).toEqual([
      'Apple AirPods 无线蓝牙耳机',
      'Beats 运动耳机',
      'Galaxy S24 手机',
    ]);
    const leaf = await searchProducts({ categoryId: childAId });
    expect(leaf.total).toBe(2);
    const bySlug = await searchProducts({ categorySlug: 'phones' });
    expect(bySlug.items.map((p) => p.title)).toEqual(['Galaxy S24 手机']);
    const unknownSlug = await searchProducts({ categorySlug: 'nope' });
    expect(unknownSlug.total).toBe(0);
  });

  it('价格区间按 min_price 过滤（元→分，含等于边界）', async () => {
    // Beats min_price 25900 分 = 259 元；AirPods 1299 元；T 恤 99 元；手机 5999 元
    const r1 = await searchProducts({ minPrice: 259, maxPrice: 1299 });
    expect(r1.items.map((p) => p.title).sort()).toEqual([
      'Apple AirPods 无线蓝牙耳机',
      'Beats 运动耳机',
    ]);
    const r2 = await searchProducts({ minPrice: 259.01 });
    expect(r2.items.map((p) => p.title).sort()).toEqual([
      'Apple AirPods 无线蓝牙耳机',
      'Galaxy S24 手机',
    ]);
    const r3 = await searchProducts({ maxPrice: 98.99 });
    expect(r3.total).toBe(0);
    const r4 = await searchProducts({ minPrice: 300, maxPrice: 100 }); // 反转 → [100, 300] 元
    expect(r4.items.map((p) => p.title)).toEqual(['Beats 运动耳机']);
  });

  it('4 种排序顺序正确；默认综合 = 销量降序→新品', async () => {
    const def = await searchProducts({});
    expect(def.items.map((p) => p.title)).toEqual([
      'Beats 运动耳机',
      'Apple AirPods 无线蓝牙耳机',
      'Galaxy S24 手机',
      '纯棉 T 恤',
    ]);
    const sales = await searchProducts({ sort: 'sales' });
    expect(sales.items.map((p) => p.salesCount)).toEqual([900, 500, 300, 50]);
    const asc = await searchProducts({ sort: 'price_asc' });
    expect(asc.items.map((p) => p.minPrice)).toEqual([9900, 25900, 129900, 599900]);
    const desc = await searchProducts({ sort: 'price_desc' });
    expect(desc.items.map((p) => p.minPrice)).toEqual([599900, 129900, 25900, 9900]);
    const newest = await searchProducts({ sort: 'newest' });
    expect(newest.items.map((p) => p.title)).toEqual([
      'Galaxy S24 手机',
      '纯棉 T 恤',
      'Beats 运动耳机',
      'Apple AirPods 无线蓝牙耳机',
    ]);
  });

  it('分页：total / totalPages / 越界空页', async () => {
    const p1 = await searchProducts({ page: 1, pageSize: 3 });
    expect(p1.total).toBe(4);
    expect(p1.totalPages).toBe(2);
    expect(p1.items).toHaveLength(3);
    const p2 = await searchProducts({ page: 2, pageSize: 3 });
    expect(p2.items).toHaveLength(1);
    const p9 = await searchProducts({ page: 9, pageSize: 3 });
    expect(p9.items).toHaveLength(0);
    expect(p9.total).toBe(4);
    expect(p9.page).toBe(9);
  });

  it('组合条件：关键词 + 类目 + 价格 + 排序', async () => {
    const r = await searchProducts({
      q: '耳机',
      categoryId: parentId,
      maxPrice: 300,
      sort: 'price_asc',
    });
    expect(r.items.map((p) => p.title)).toEqual(['Beats 运动耳机']);
  });
});
