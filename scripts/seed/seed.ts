import '../db/env';
import { eq, sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DEMO_ACCOUNTS } from '../../src/lib/demo-accounts';
import { buildSpecKey } from '../../src/lib/spec-key';
import { calcFreight } from '../../src/lib/freight';
import { generateOrderNo } from '../../src/lib/order-no';
import { db } from '../../src/server/db/client';
import {
  addresses,
  carts,
  categories,
  inventoryLogs,
  orderItems,
  orders,
  payments,
  products,
  session,
  skus,
  user,
  type ProductAttribute,
  type SkuSpec,
} from '../../src/server/db/schema';

type CategorySeed = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  sort: number;
};
type SkuSeed = {
  id: number;
  spec: SkuSpec;
  price: number;
  originalPrice: number | null;
  stock: number;
  image: string | null;
  status: 'on' | 'off';
};
type ProductSeed = {
  id: number;
  categorySlug: string;
  title: string;
  subtitle: string;
  brand: string;
  images: string[];
  description: string;
  attributes: ProductAttribute[];
  status: 'on' | 'off';
  salesCount: number;
  rating: number;
  skus: SkuSeed[];
};

const dataDir = path.join(__dirname, 'data');
const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(path.join(dataDir, file), 'utf8')) as T;

async function truncateAll() {
  await db.execute(sql`
    TRUNCATE TABLE
      inventory_logs, payments, order_items, orders,
      cart_items, carts, addresses, skus, products, categories,
      verification, session, account, "user"
    RESTART IDENTITY CASCADE
  `);
}

async function seedCategories() {
  const rows = readJson<CategorySeed[]>('categories.zh.json');
  // 先插一级再插二级，满足自引用外键
  const parents = rows.filter((r) => r.parentId === null);
  const children = rows.filter((r) => r.parentId !== null);
  await db.insert(categories).values(parents);
  await db.insert(categories).values(children);
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT max(id) FROM categories))`,
  );
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function seedProducts(slugToId: Map<string, number>) {
  const rows = readJson<ProductSeed[]>('products.zh.json');
  const productRows = rows.map((p) => {
    const categoryId = slugToId.get(p.categorySlug);
    if (!categoryId) throw new Error(`未知类目 slug: ${p.categorySlug}（商品 ${p.title}）`);
    const onSale = p.skus.filter((s) => s.status === 'on');
    const minPrice = Math.min(...(onSale.length ? onSale : p.skus).map((s) => s.price));
    return {
      id: p.id,
      categoryId,
      title: p.title,
      subtitle: p.subtitle,
      brand: p.brand,
      images: p.images,
      description: p.description,
      attributes: p.attributes,
      status: p.status,
      minPrice,
      salesCount: p.salesCount,
      rating: p.rating,
    };
  });
  const skuRows = rows.flatMap((p) =>
    p.skus.map((s) => ({
      id: s.id,
      productId: p.id,
      spec: s.spec,
      specKey: buildSpecKey(s.spec),
      price: s.price,
      originalPrice: s.originalPrice,
      stock: s.stock,
      lockedStock: 0,
      image: s.image,
      status: s.status,
    })),
  );
  const chunk = <T>(arr: T[], n: number) =>
    Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
  for (const c of chunk(productRows, 50)) await db.insert(products).values(c);
  for (const c of chunk(skuRows, 100)) await db.insert(skus).values(c);
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT max(id) FROM products))`,
  );
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('skus', 'id'), (SELECT max(id) FROM skus))`,
  );
  return { products: productRows.length, skus: skuRows.length, rows };
}

async function seedUsers() {
  // 延迟加载：auth 实例依赖 BETTER_AUTH_SECRET 等 env（已由 ../db/env 注入）
  const { auth } = await import('../../src/server/auth/auth');
  const ids: Record<'buyer' | 'admin', string> = { buyer: '', admin: '' };
  for (const key of ['buyer', 'admin'] as const) {
    const acc = DEMO_ACCOUNTS[key];
    const res = await auth.api.signUpEmail({
      body: { email: acc.email, password: acc.password, name: acc.name },
    });
    ids[key] = res.user.id;
    if (acc.role === 'admin') {
      await db.update(user).set({ role: 'admin' }).where(eq(user.id, res.user.id));
    }
  }
  // signUp 自动创建的会话不需要保留
  await db.delete(session);
  // 每个用户一个购物车
  await db.insert(carts).values([{ userId: ids.buyer }, { userId: ids.admin }]);
  return ids;
}

async function seedAddresses(ids: Record<'buyer' | 'admin', string>) {
  await db.insert(addresses).values([
    {
      userId: ids.buyer,
      receiver: '张小明',
      phone: '13800001111',
      province: '广东省',
      city: '深圳市',
      district: '南山区',
      detail: '科技园南区科苑路 15 号科兴科学园 A 座 1203',
      isDefault: true,
    },
    {
      userId: ids.buyer,
      receiver: '张小明',
      phone: '13800001111',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      detail: '张江高科技园区碧波路 456 号 3 号楼 501',
      isDefault: false,
    },
    {
      userId: ids.admin,
      receiver: '李管理',
      phone: '13900002222',
      province: '北京市',
      city: '北京市',
      district: '海淀区',
      detail: '中关村大街 27 号中关村大厦 12 层',
      isDefault: true,
    },
    {
      userId: ids.admin,
      receiver: '李管理',
      phone: '13900002222',
      province: '浙江省',
      city: '杭州市',
      district: '西湖区',
      detail: '文三路 478 号华星时代广场 B 座 1608',
      isDefault: false,
    },
  ]);
}

/** 买家预置 3 笔历史订单：PAID / SHIPPED / COMPLETED（直接写入快照，库存按已支付扣减） */
async function seedOrders(buyerId: string, productRows: ProductSeed[]) {
  const buyerAddress = await db.query.addresses.findFirst({
    where: (a, { and, eq }) => and(eq(a.userId, buyerId), eq(a.isDefault, true)),
  });
  if (!buyerAddress) throw new Error('买家默认地址缺失');
  const snapshot = {
    receiver: buyerAddress.receiver,
    phone: buyerAddress.phone,
    province: buyerAddress.province,
    city: buyerAddress.city,
    district: buyerAddress.district,
    detail: buyerAddress.detail,
  };
  // 选 3 个上架且 SKU 库存充足的商品
  const candidates = productRows
    .filter((p) => p.status === 'on')
    .map((p) => ({ p, s: p.skus.find((s) => s.status === 'on' && s.stock >= 10) }))
    .filter((x): x is { p: ProductSeed; s: SkuSeed } => Boolean(x.s))
    .slice(0, 3);
  if (candidates.length < 3) throw new Error('可用于历史订单的商品不足 3 个');

  const now = Date.now();
  const plans = [
    { status: 'PAID' as const, daysAgo: 1, qty: 1 },
    { status: 'SHIPPED' as const, daysAgo: 3, qty: 2 },
    { status: 'COMPLETED' as const, daysAgo: 10, qty: 1 },
  ];
  for (let i = 0; i < plans.length; i++) {
    const { p, s } = candidates[i]!;
    const plan = plans[i]!;
    const createdAt = new Date(now - plan.daysAgo * 86_400_000);
    const paidAt = new Date(createdAt.getTime() + 5 * 60_000);
    const shippedAt = plan.status !== 'PAID' ? new Date(paidAt.getTime() + 6 * 3_600_000) : null;
    const completedAt =
      plan.status === 'COMPLETED' ? new Date(shippedAt!.getTime() + 2 * 86_400_000) : null;
    const subtotal = s.price * plan.qty;
    const freight = calcFreight(subtotal);
    const [order] = await db
      .insert(orders)
      .values({
        orderNo: generateOrderNo(createdAt, () => (i + 1) / 10),
        userId: buyerId,
        status: plan.status,
        totalAmount: subtotal,
        freight,
        payAmount: subtotal + freight,
        addressSnapshot: snapshot,
        channel: 'web',
        expireAt: new Date(createdAt.getTime() + 15 * 60_000),
        paidAt,
        shippedAt,
        completedAt,
        shipping: shippedAt ? { carrier: '顺丰速运', trackingNo: `SF${1000000000 + i}` } : null,
        createdAt,
      })
      .returning({ id: orders.id });
    const orderId = order!.id;
    await db.insert(orderItems).values({
      orderId,
      skuId: s.id,
      productId: p.id,
      titleSnapshot: p.title,
      specSnapshot: s.spec,
      imageSnapshot: s.image ?? p.images[0] ?? null,
      unitPrice: s.price,
      quantity: plan.qty,
      subtotal,
    });
    await db.insert(payments).values({
      orderId,
      method: 'mock',
      amount: subtotal + freight,
      status: 'SUCCESS',
      transactionNo: `MOCKSEED${createdAt.getTime()}${i}`,
      paidAt,
      createdAt,
    });
    // 已支付：实物库存扣减（lock → deduct）
    await db
      .update(skus)
      .set({ stock: sql`${skus.stock} - ${plan.qty}` })
      .where(eq(skus.id, s.id));
    await db.insert(inventoryLogs).values([
      { skuId: s.id, change: plan.qty, type: 'lock', refOrderId: orderId, createdAt },
      { skuId: s.id, change: -plan.qty, type: 'deduct', refOrderId: orderId, createdAt: paidAt },
    ]);
  }
}

async function main() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url) throw new Error('DATABASE_URL 未设置');
  console.log(`[db:seed] 目标库 ${url.replace(/:[^:@/]+@/, ':***@')}`);
  const t0 = Date.now();
  await truncateAll();
  const slugToId = await seedCategories();
  const { products: pc, skus: sc, rows } = await seedProducts(slugToId);
  const ids = await seedUsers();
  await seedAddresses(ids);
  await seedOrders(ids.buyer, rows);
  console.log(
    `[db:seed] 完成：类目 ${slugToId.size}，商品 ${pc}，SKU ${sc}，账号 2，地址 4，历史订单 3（${Date.now() - t0}ms）`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$client.end();
  });
