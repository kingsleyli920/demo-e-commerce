import { and, count, desc, eq, gte, ilike, isNotNull, lte, or, sql } from 'drizzle-orm';
import { db, type DbOrTx } from '@/server/db/client';
import {
  inventoryLogs,
  orders,
  products,
  skus,
  user,
  type Order,
  type OrderItem,
  type OrderStatus,
  type Product,
  type Sku,
} from '@/server/db/schema';
import { AppError } from '@/server/errors';

// ---------------------------------------------------------------------------
// 统计
// ---------------------------------------------------------------------------
export type AdminStats = {
  todayOrders: number;
  /** 已支付 GMV（累计，分） */
  paidGmv: number;
  pendingShipment: number;
  soldOutSkus: number;
};

export async function getAdminStats(conn: DbOrTx = db): Promise<AdminStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [today] = await conn
    .select({ n: count() })
    .from(orders)
    .where(gte(orders.createdAt, startOfDay));
  const [gmv] = await conn
    .select({ total: sql<number>`coalesce(sum(${orders.payAmount}), 0)`.mapWith(Number) })
    .from(orders)
    .where(isNotNull(orders.paidAt));
  const [pending] = await conn.select({ n: count() }).from(orders).where(eq(orders.status, 'PAID'));
  const [soldOut] = await conn
    .select({ n: count() })
    .from(skus)
    .where(and(eq(skus.status, 'on'), lte(sql`${skus.stock} - ${skus.lockedStock}`, 0)));
  return {
    todayOrders: today?.n ?? 0,
    paidGmv: gmv?.total ?? 0,
    pendingShipment: pending?.n ?? 0,
    soldOutSkus: soldOut?.n ?? 0,
  };
}

// ---------------------------------------------------------------------------
// 商品管理
// ---------------------------------------------------------------------------
export type AdminProductRow = Product & { skuCount: number; totalStock: number };

export async function listAdminProducts(
  params: { q?: string; page?: number; pageSize?: number },
  conn: DbOrTx = db,
): Promise<{ items: AdminProductRow[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
  const cond = params.q
    ? or(ilike(products.title, `%${params.q}%`), ilike(products.brand, `%${params.q}%`))
    : undefined;
  const [{ total }] = await conn.select({ total: count() }).from(products).where(cond);
  const rows = await conn
    .select({
      product: products,
      skuCount: sql<number>`count(${skus.id})`.mapWith(Number),
      totalStock: sql<number>`coalesce(sum(${skus.stock}), 0)`.mapWith(Number),
    })
    .from(products)
    .leftJoin(skus, eq(skus.productId, products.id))
    .where(cond)
    .groupBy(products.id)
    .orderBy(desc(products.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    items: rows.map((r) => ({ ...r.product, skuCount: r.skuCount, totalStock: r.totalStock })),
    total: total ?? 0,
    page,
    totalPages: Math.ceil((total ?? 0) / pageSize),
  };
}

export async function getAdminProduct(
  productId: number,
  conn: DbOrTx = db,
): Promise<{ product: Product; skus: Sku[] } | null> {
  const product = await conn.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product) return null;
  const skuRows = await conn
    .select()
    .from(skus)
    .where(eq(skus.productId, productId))
    .orderBy(skus.id);
  return { product, skus: skuRows };
}

/** 上下架切换（即时生效） */
export async function setProductStatus(
  productId: number,
  status: 'on' | 'off',
  conn: DbOrTx = db,
): Promise<Product> {
  const [row] = await conn
    .update(products)
    .set({ status })
    .where(eq(products.id, productId))
    .returning();
  if (!row) throw new AppError('NOT_FOUND', '商品不存在');
  return row;
}

/** 重新派生商品 min_price（取上架 SKU 最低价，无上架 SKU 时取全部） */
async function refreshMinPrice(productId: number, conn: DbOrTx): Promise<void> {
  await conn.execute(sql`
    UPDATE products SET min_price = COALESCE(
      (SELECT min(price) FROM skus WHERE product_id = ${productId} AND status = 'on'),
      (SELECT min(price) FROM skus WHERE product_id = ${productId}),
      0
    ) WHERE id = ${productId}
  `);
}

export type UpdateSkuInput = { price: number; originalPrice: number | null; stock: number };

/** SKU 价格/原价/库存编辑：库存不得小于 locked_stock；库存变动写 admin_adjust 日志；同步 min_price */
export async function updateSku(
  skuId: number,
  input: UpdateSkuInput,
  conn: DbOrTx = db,
): Promise<Sku> {
  if (!Number.isInteger(input.price) || input.price < 0)
    throw new AppError('VALIDATION', '价格无效');
  if (
    input.originalPrice !== null &&
    (!Number.isInteger(input.originalPrice) || input.originalPrice < 0)
  ) {
    throw new AppError('VALIDATION', '划线价格无效');
  }
  if (!Number.isInteger(input.stock) || input.stock < 0)
    throw new AppError('VALIDATION', '库存无效');
  return conn.transaction(async (tx) => {
    const sku = await tx.query.skus.findFirst({ where: eq(skus.id, skuId) });
    if (!sku) throw new AppError('NOT_FOUND', 'SKU 不存在');
    // 条件更新：并发下单抬高 locked_stock 时不靠 DB check 约束裸报错
    const [row] = await tx
      .update(skus)
      .set({ price: input.price, originalPrice: input.originalPrice, stock: input.stock })
      .where(and(eq(skus.id, skuId), lte(skus.lockedStock, input.stock)))
      .returning();
    if (!row) {
      const fresh = await tx.query.skus.findFirst({ where: eq(skus.id, skuId) });
      throw new AppError(
        'VALIDATION',
        `库存不能小于已锁定数量（当前锁定 ${fresh?.lockedStock ?? sku.lockedStock}）`,
      );
    }
    if (input.stock !== sku.stock) {
      await tx.insert(inventoryLogs).values({
        skuId,
        change: input.stock - sku.stock,
        type: 'admin_adjust',
        refOrderId: null,
      });
    }
    await refreshMinPrice(sku.productId, tx);
    return row!;
  });
}

// ---------------------------------------------------------------------------
// 订单管理
// ---------------------------------------------------------------------------
export type AdminOrderRow = Order & { buyerName: string; buyerEmail: string };

export async function listAdminOrders(
  params: { status?: OrderStatus; page?: number; pageSize?: number },
  conn: DbOrTx = db,
): Promise<{ items: AdminOrderRow[]; total: number; page: number; totalPages: number }> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.floor(params.pageSize ?? 20)));
  const cond = params.status ? eq(orders.status, params.status) : undefined;
  const [{ total }] = await conn.select({ total: count() }).from(orders).where(cond);
  const rows = await conn
    .select({ order: orders, buyerName: user.name, buyerEmail: user.email })
    .from(orders)
    .innerJoin(user, eq(orders.userId, user.id))
    .where(cond)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return {
    items: rows.map((r) => ({ ...r.order, buyerName: r.buyerName, buyerEmail: r.buyerEmail })),
    total: total ?? 0,
    page,
    totalPages: Math.ceil((total ?? 0) / pageSize),
  };
}

export type AdminOrderDetail = {
  order: Order;
  items: OrderItem[];
  buyerName: string;
  buyerEmail: string;
};

export async function getAdminOrder(
  orderNo: string,
  conn: DbOrTx = db,
): Promise<AdminOrderDetail | null> {
  const row = await conn.query.orders.findFirst({
    where: eq(orders.orderNo, orderNo),
    with: { items: true, user: { columns: { name: true, email: true } } },
  });
  if (!row) return null;
  const { items, user: buyer, ...order } = row;
  return { order: order as Order, items, buyerName: buyer.name, buyerEmail: buyer.email };
}
