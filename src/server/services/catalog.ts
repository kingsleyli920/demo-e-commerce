import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, type SQL } from 'drizzle-orm';
import { buildSpecKey } from '@/lib/spec-key';
import { db, type DbOrTx } from '@/server/db/client';
import {
  categories,
  products,
  skus,
  type Category,
  type Product,
  type Sku,
  type SkuSpec,
} from '@/server/db/schema';
import { PAGE_SIZE, type ProductSort } from '@/server/dto/catalog';

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

function toCard(p: Product): ProductCard {
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

// ---------------------------------------------------------------------------
// 类目
// ---------------------------------------------------------------------------

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
    .where(eq(categories.parentId, categoryId))
    .orderBy(asc(categories.sort), asc(categories.id));
  return [categoryId, ...children.map((c) => c.id)];
}

/** 面包屑：[一级, 二级]；不存在返回 [] */
export async function getCategoryBreadcrumb(
  categoryId: number,
  conn: DbOrTx = db,
): Promise<Category[]> {
  const leaf = await conn.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  if (!leaf) return [];
  if (leaf.parentId === null) return [leaf];
  const parent = await conn.query.categories.findFirst({ where: eq(categories.id, leaf.parentId) });
  return parent ? [parent, leaf] : [leaf];
}

// ---------------------------------------------------------------------------
// 列表 / 搜索
// ---------------------------------------------------------------------------

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

export type SearchParams = {
  q?: string;
  categoryId?: number;
  categorySlug?: string;
  /** 元（支持小数），内部换算为分 */
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
};

export type SearchResult = {
  items: ProductCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  category: Category | null;
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

function orderBy(sort: ProductSort): SQL[] {
  switch (sort) {
    case 'sales':
      return [desc(products.salesCount), asc(products.id)];
    case 'price_asc':
      return [asc(products.minPrice), asc(products.id)];
    case 'price_desc':
      return [desc(products.minPrice), asc(products.id)];
    case 'newest':
      return [desc(products.createdAt), desc(products.id)];
    case 'default':
    default:
      return [desc(products.salesCount), desc(products.createdAt), asc(products.id)];
  }
}

/** 商品搜索 / 列表：仅上架商品；关键词 ILIKE 标题/品牌/副标题；类目含子类目；价格区间按 min_price；分页 */
export async function searchProducts(
  params: SearchParams,
  conn: DbOrTx = db,
): Promise<SearchResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? PAGE_SIZE)));
  const sort = params.sort ?? 'default';

  let category: Category | null = null;
  let categoryIds: number[] | null = null;
  if (params.categorySlug) {
    category = await getCategoryBySlug(params.categorySlug, conn);
    if (!category) {
      return { items: [], total: 0, page, pageSize, totalPages: 0, category: null };
    }
  } else if (params.categoryId) {
    category =
      (await conn.query.categories.findFirst({ where: eq(categories.id, params.categoryId) })) ??
      null;
    if (!category) return { items: [], total: 0, page, pageSize, totalPages: 0, category: null };
  }
  if (category) categoryIds = await resolveCategoryIds(category.id, conn);

  const conds: SQL[] = [eq(products.status, 'on')];
  if (params.q) {
    const pattern = `%${escapeLike(params.q)}%`;
    conds.push(
      or(
        ilike(products.title, pattern),
        ilike(products.brand, pattern),
        ilike(products.subtitle, pattern),
      )!,
    );
  }
  if (categoryIds) conds.push(inArray(products.categoryId, categoryIds));
  let min = params.minPrice;
  let max = params.maxPrice;
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  if (min !== undefined) conds.push(gte(products.minPrice, Math.round(min * 100)));
  if (max !== undefined) conds.push(lte(products.minPrice, Math.round(max * 100)));
  const where = and(...conds);

  const [{ total }] = await conn.select({ total: count() }).from(products).where(where);
  const rows = await conn
    .select()
    .from(products)
    .where(where)
    .orderBy(...orderBy(sort))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    items: rows.map(toCard),
    total: total ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((total ?? 0) / pageSize),
    category,
  };
}

// ---------------------------------------------------------------------------
// 详情 / SKU
// ---------------------------------------------------------------------------

export type ProductDetail = {
  product: Product;
  skus: Sku[];
  breadcrumb: Category[];
};

/** 上架商品详情（含全部 SKU，包含下架/售罄 SKU 以便置灰）；下架或不存在 → null */
export async function getProductDetail(
  productId: number,
  conn: DbOrTx = db,
): Promise<ProductDetail | null> {
  const product = await conn.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product || product.status !== 'on') return null;
  const skuRows = await conn
    .select()
    .from(skus)
    .where(eq(skus.productId, productId))
    .orderBy(asc(skus.id));
  const breadcrumb = await getCategoryBreadcrumb(product.categoryId, conn);
  return { product, skus: skuRows, breadcrumb };
}

/** 按规格精确定位 SKU（属性顺序无关）；不存在返回 null（不过滤下架，调用方自行判断） */
export async function resolveSku(
  productId: number,
  spec: SkuSpec,
  conn: DbOrTx = db,
): Promise<Sku | null> {
  const key = buildSpecKey(spec);
  const row = await conn.query.skus.findFirst({
    where: and(eq(skus.productId, productId), eq(skus.specKey, key)),
  });
  return row ?? null;
}

// 纯函数（选项置灰 / 选满判断 / 价格区间）在 src/lib/sku.ts，客户端组件可直接使用
export { availableOptions, isSpecComplete, priceRange, type AttributeOption } from '@/lib/sku';
