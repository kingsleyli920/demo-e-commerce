import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCategoryBreadcrumb,
  getCategoryBySlug,
  getCategoryTree,
  resolveCategoryIds,
} from '@/server/services/catalog';
import { resetDb } from '../db';
import { createCategory } from '../factories';

describe('catalog 类目', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('类目树构建：parent→children，顺序按 sort', async () => {
    const b = await createCategory({ name: 'B', slug: 'b', sort: 2 });
    const a = await createCategory({ name: 'A', slug: 'a', sort: 1 });
    const a2 = await createCategory({ name: 'A2', slug: 'a2', parentId: a.id, sort: 2 });
    const a1 = await createCategory({ name: 'A1', slug: 'a1', parentId: a.id, sort: 1 });
    const tree = await getCategoryTree();
    expect(tree.map((t) => t.slug)).toEqual(['a', 'b']);
    expect(tree[0]!.children.map((c) => c.slug)).toEqual(['a1', 'a2']);
    expect(tree[1]!.children).toEqual([]);
    expect(await resolveCategoryIds(a.id)).toEqual([a.id, a1.id, a2.id]);
    expect(await resolveCategoryIds(b.id)).toEqual([b.id]);
  });

  it('slug 查找与面包屑', async () => {
    const a = await createCategory({ name: 'A', slug: 'a', sort: 1 });
    const a1 = await createCategory({ name: 'A1', slug: 'a1', parentId: a.id, sort: 1 });
    expect((await getCategoryBySlug('a1'))?.id).toBe(a1.id);
    expect(await getCategoryBySlug('missing')).toBeNull();
    const crumb = await getCategoryBreadcrumb(a1.id);
    expect(crumb.map((c) => c.slug)).toEqual(['a', 'a1']);
    expect(await getCategoryBreadcrumb(a.id)).toHaveLength(1);
    expect(await getCategoryBreadcrumb(99999)).toEqual([]);
  });
});
