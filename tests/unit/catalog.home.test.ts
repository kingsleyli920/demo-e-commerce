import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCategoryBySlug,
  getCategoryTree,
  listFeaturedProducts,
  listProductsByIds,
  resolveCategoryIds,
} from '@/server/services/catalog';
import { resetDb } from '../db';
import { createCategory, createProductWithSkus } from '../factories';

describe('catalog 首页数据', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('类目树：一级按 sort，children 归属正确', async () => {
    const b = await createCategory({ name: 'B', slug: 'b', sort: 2 });
    const a = await createCategory({ name: 'A', slug: 'a', sort: 1 });
    const a1 = await createCategory({ name: 'A1', slug: 'a1', parentId: a.id, sort: 1 });
    const tree = await getCategoryTree();
    expect(tree.map((t) => t.slug)).toEqual(['a', 'b']);
    expect(tree[0]!.children.map((c) => c.id)).toEqual([a1.id]);
    expect(tree[1]!.children).toHaveLength(0);
    expect(await resolveCategoryIds(a.id)).toEqual([a.id, a1.id]);
    expect(await resolveCategoryIds(b.id)).toEqual([b.id]);
    expect((await getCategoryBySlug('a1'))?.id).toBe(a1.id);
    expect(await getCategoryBySlug('nope')).toBeNull();
  });

  it('首页商品只含上架商品，按销量降序', async () => {
    const cat = await createCategory();
    await createProductWithSkus({ categoryId: cat.id, title: '低销量', salesCount: 1 });
    await createProductWithSkus({ categoryId: cat.id, title: '高销量', salesCount: 100 });
    await createProductWithSkus({
      categoryId: cat.id,
      title: '已下架',
      salesCount: 999,
      status: 'off',
    });
    const list = await listFeaturedProducts(10);
    expect(list.map((p) => p.title)).toEqual(['高销量', '低销量']);
    expect(list[0]!.minPrice).toBe(9900);
    expect(list[0]!.image).toContain('cdn.dummyjson.com');
  });

  it('listProductsByIds：按 id 取上架商品，空数组返回空', async () => {
    const cat = await createCategory();
    const a = await createProductWithSkus({ categoryId: cat.id, title: 'A' });
    const off = await createProductWithSkus({ categoryId: cat.id, title: 'OFF', status: 'off' });
    expect(await listProductsByIds([])).toEqual([]);
    const got = await listProductsByIds([a.product.id, off.product.id, 99999]);
    expect(got.map((p) => p.title)).toEqual(['A']);
  });
});
