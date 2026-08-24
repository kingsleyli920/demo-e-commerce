import { eq } from 'drizzle-orm';
import { buildSpecKey } from '@/lib/spec-key';
import {
  addresses,
  carts,
  categories,
  products,
  skus,
  user,
  type ProductAttribute,
  type SkuSpec,
} from '@/server/db/schema';
import { getTestDb } from './db';

let seq = 0;
const next = () => ++seq;

export async function createUser(
  overrides: Partial<{ id: string; name: string; email: string; role: 'buyer' | 'admin' }> = {},
) {
  const db = getTestDb();
  const n = next();
  const id = overrides.id ?? `user_${Date.now()}_${n}`;
  const [row] = await db
    .insert(user)
    .values({
      id,
      name: overrides.name ?? `测试用户${n}`,
      email: overrides.email ?? `u${n}_${Date.now()}@test.local`,
      role: overrides.role ?? 'buyer',
    })
    .returning();
  await db.insert(carts).values({ userId: id }).onConflictDoNothing();
  return row!;
}

export async function createCategory(
  overrides: Partial<{ name: string; slug: string; parentId: number | null; sort: number }> = {},
) {
  const db = getTestDb();
  const n = next();
  const [row] = await db
    .insert(categories)
    .values({
      name: overrides.name ?? `类目${n}`,
      slug: overrides.slug ?? `cat-${n}-${Date.now()}`,
      parentId: overrides.parentId ?? null,
      sort: overrides.sort ?? n,
    })
    .returning();
  return row!;
}

export type SkuInput = {
  spec?: SkuSpec;
  price?: number;
  originalPrice?: number | null;
  stock?: number;
  lockedStock?: number;
  status?: 'on' | 'off';
  image?: string | null;
};

export async function createProductWithSkus(
  overrides: Partial<{
    categoryId: number;
    title: string;
    subtitle: string | null;
    brand: string | null;
    status: 'on' | 'off';
    salesCount: number;
    rating: number;
    images: string[];
    description: string;
    attributes: ProductAttribute[];
    createdAt: Date;
  }> = {},
  skuInputs: SkuInput[] = [{ spec: { 颜色: '黑色' }, price: 9900, stock: 10 }],
) {
  const db = getTestDb();
  const n = next();
  const categoryId = overrides.categoryId ?? (await createCategory()).id;
  const attributes =
    overrides.attributes ??
    (() => {
      const map = new Map<string, Set<string>>();
      for (const s of skuInputs)
        for (const [k, v] of Object.entries(s.spec ?? {})) {
          if (!map.has(k)) map.set(k, new Set());
          map.get(k)!.add(v);
        }
      return [...map.entries()].map(([name, values]) => ({ name, values: [...values] }));
    })();
  const prices = skuInputs.filter((s) => (s.status ?? 'on') === 'on').map((s) => s.price ?? 9900);
  const minPrice = Math.min(...(prices.length ? prices : skuInputs.map((s) => s.price ?? 9900)));
  const [product] = await db
    .insert(products)
    .values({
      categoryId,
      title: overrides.title ?? `测试商品${n}`,
      subtitle: overrides.subtitle ?? `副标题${n}`,
      brand: overrides.brand ?? `品牌${n}`,
      images: overrides.images ?? ['https://cdn.dummyjson.com/product-images/test/thumbnail.webp'],
      description: overrides.description ?? '测试商品描述',
      attributes,
      status: overrides.status ?? 'on',
      minPrice,
      salesCount: overrides.salesCount ?? 0,
      rating: overrides.rating ?? 4.8,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    })
    .returning();
  const skuRows = await db
    .insert(skus)
    .values(
      skuInputs.map((s, i) => {
        const spec = s.spec ?? { 规格: `默认${i + 1}` };
        return {
          productId: product!.id,
          spec,
          specKey: buildSpecKey(spec),
          price: s.price ?? 9900,
          originalPrice: s.originalPrice ?? null,
          stock: s.stock ?? 10,
          lockedStock: s.lockedStock ?? 0,
          image: s.image ?? null,
          status: s.status ?? 'on',
        };
      }),
    )
    .returning();
  return { product: product!, skus: skuRows };
}

export async function createAddress(
  userId: string,
  overrides: Partial<typeof addresses.$inferInsert> = {},
) {
  const db = getTestDb();
  const n = next();
  const [row] = await db
    .insert(addresses)
    .values({
      userId,
      receiver: overrides.receiver ?? `收件人${n}`,
      phone: overrides.phone ?? '13800000000',
      province: overrides.province ?? '广东省',
      city: overrides.city ?? '深圳市',
      district: overrides.district ?? '南山区',
      detail: overrides.detail ?? `测试路 ${n} 号`,
      isDefault: overrides.isDefault ?? false,
    })
    .returning();
  return row!;
}

export async function getSku(id: number) {
  const row = await getTestDb().query.skus.findFirst({ where: eq(skus.id, id) });
  if (!row) throw new Error(`sku ${id} not found`);
  return row;
}
