import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { db, type DbOrTx } from '@/server/db/client';
import { categories, products, type Category } from '@/server/db/schema';

export type CategoryNode = Category & { children: Category[] };

export type ProductCard = {
  id: number;
  title: string;
  subtitle: string | null;
  brand: string | null;
  image: string | null;
  minPrice: number;
  salesCount: number;
  rating: number;
  categoryId: number;
};

function toCard(p: typeof products.$inferSelect): ProductCard {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    brand: p.brand,
    image: p.images[0] ?? null,
    minPrice: p.minPrice,
    salesCount: p.salesCount,
    rating: p.rating,
    categoryId: p.categoryId,
  };
}

/** 两级类目树：一级按 sort 升序，children 按 sort 升序 */
export async function getCategoryTree(conn: DbOrTx = db): Promise<CategoryNode[]> {
  const rows = await conn
    .select()
    .from(categories)
    .orderBy(asc(categories.sort), asc(categories.id));
  const parents = rows.filter((r) => r.parentId === null);
  return parents.map((p) => ({ ...p, children: rows.filter((r) => r.parentId === p.id) }));
}

export async function getCategoryBySlug(slug: string, conn: DbOrTx = db): Promise<Category | null> {
  const row = await conn.query.categories.findFirst({ where: eq(categories.slug, slug) });
  return row ?? null;
}

/** 某类目（含其子类目）的全部 id，用于「父类目包含子类目商品」 */
export async function resolveCategoryIds(categoryId: number, conn: DbOrTx = db): Promise<number[]> {
  const children = await conn
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, categoryId));
  return [categoryId, ...children.map((c) => c.id)];
}

/** 首页商品：上架商品按销量降序、新品优先 */
export async function listFeaturedProducts(limit = 20, conn: DbOrTx = db): Promise<ProductCard[]> {
  const rows = await conn
    .select()
    .from(products)
    .where(eq(products.status, 'on'))
    .orderBy(desc(products.salesCount), desc(products.createdAt), asc(products.id))
    .limit(limit);
  return rows.map(toCard);
}

export async function listProductsByIds(ids: number[], conn: DbOrTx = db): Promise<ProductCard[]> {
  if (ids.length === 0) return [];
  const rows = await conn
    .select()
    .from(products)
    .where(and(inArray(products.id, ids), eq(products.status, 'on')));
  return rows.map(toCard);
}
