import { and, eq, inArray, sql } from 'drizzle-orm';
import { calcFreight } from '@/lib/freight';
import { generateOrderNo } from '@/lib/order-no';
import { availableStock } from '@/lib/stock';
import { db, type DbOrTx, type Tx } from '@/server/db/client';
import {
  cartItems,
  inventoryLogs,
  orderItems,
  orders,
  payments,
  skus,
  type Address,
  type Order,
  type SkuSpec,
} from '@/server/db/schema';
import { AppError } from '@/server/errors';
import { getAddress, listAddresses } from './address';
import { getOrCreateCartId, listCart } from './cart';

export type CheckoutSource = { type: 'cart' } | { type: 'buyNow'; skuId: number; quantity: number };

export type CheckoutItem = {
  cartItemId: number | null;
  skuId: number;
  productId: number;
  title: string;
  image: string | null;
  spec: SkuSpec;
  price: number;
  quantity: number;
};

export type CheckoutPreview = {
  items: CheckoutItem[];
  totalAmount: number;
  freight: number;
  payAmount: number;
  address: Address | null;
  addresses: Address[];
};

function describeSku(title: string, spec: SkuSpec): string {
  const specText = Object.values(spec).join('/');
  return specText ? `${title}（${specText}）` : title;
}

/** 结算条目（服务端实时价）：cart = 已勾选有效项（含失效勾选项则拒绝）；buyNow = 单 SKU */
export async function getCheckoutItems(
  userId: string,
  source: CheckoutSource,
  conn: DbOrTx = db,
): Promise<CheckoutItem[]> {
  if (source.type === 'cart') {
    const view = await listCart(userId, conn);
    const rows = await conn.query.cartItems.findMany({
      where: and(
        eq(cartItems.cartId, await getOrCreateCartId(userId, conn)),
        eq(cartItems.selected, true),
      ),
      with: { sku: { with: { product: true } } },
    });
    const invalidSelected = rows.filter((r) => r.sku.status !== 'on' || availableStock(r.sku) <= 0);
    if (invalidSelected.length > 0) {
      throw new AppError('VALIDATION', '结算商品中含已失效条目，请回购物车处理');
    }
    void view;
    if (rows.length === 0) throw new AppError('VALIDATION', '没有可结算的商品，请先在购物车勾选');
    return rows.map((r) => ({
      cartItemId: r.id,
      skuId: r.skuId,
      productId: r.sku.productId,
      title: r.sku.product.title,
      image: r.sku.image ?? r.sku.product.images[0] ?? null,
      spec: r.sku.spec,
      price: r.sku.price,
      quantity: r.quantity,
    }));
  }
  // buyNow
  if (!Number.isInteger(source.quantity) || source.quantity < 1)
    throw new AppError('VALIDATION', '数量无效');
  const sku = await conn.query.skus.findFirst({
    where: eq(skus.id, source.skuId),
    with: { product: true },
  });
  if (!sku || sku.product.status !== 'on') throw new AppError('NOT_FOUND', '商品不存在或已下架');
  if (sku.status !== 'on') throw new AppError('VALIDATION', '该规格已下架');
  const available = availableStock(sku);
  if (available < source.quantity) {
    throw new AppError(
      'INSUFFICIENT_STOCK',
      `库存不足: ${describeSku(sku.product.title, sku.spec)}`,
    );
  }
  return [
    {
      cartItemId: null,
      skuId: sku.id,
      productId: sku.productId,
      title: sku.product.title,
      image: sku.image ?? sku.product.images[0] ?? null,
      spec: sku.spec,
      price: sku.price,
      quantity: source.quantity,
    },
  ];
}

/** 结算预览（服务端计算金额；不锁库存） */
export async function previewCheckout(
  userId: string,
  source: CheckoutSource,
  addressId?: number,
  conn: DbOrTx = db,
): Promise<CheckoutPreview> {
  const items = await getCheckoutItems(userId, source, conn);
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const freight = calcFreight(totalAmount);
  const addresses = await listAddresses(userId, conn);
  const address = addressId
    ? (addresses.find((a) => a.id === addressId) ?? null)
    : (addresses.find((a) => a.isDefault) ?? addresses[0] ?? null);
  return { items, totalAmount, freight, payAmount: totalAmount + freight, address, addresses };
}

export function orderExpireMinutes(): number {
  const n = Number(process.env.ORDER_EXPIRE_MINUTES ?? 15);
  return Number.isFinite(n) && n > 0 ? n : 15;
}

export type PlaceOrderInput = {
  source: CheckoutSource;
  addressId: number;
  remark?: string;
};

/**
 * 提交订单（事务）：地址校验 → 服务端实时价 → 逐 SKU 条件原子锁库存（不足整单回滚）
 * → orders(PENDING_PAYMENT, expire_at) + order_items 快照 + payments(INIT) + inventory_logs(lock)
 * → 购物车来源移除已勾选项。
 */
export async function placeOrder(
  userId: string,
  input: PlaceOrderInput,
  conn: DbOrTx = db,
): Promise<Order> {
  return conn.transaction(async (tx: Tx) => {
    const address = await getAddress(userId, input.addressId, tx);
    if (!address) throw new AppError('VALIDATION', '收货地址无效，请重新选择地址');
    const items = await getCheckoutItems(userId, input.source, tx);

    // 逐 SKU 条件原子锁定
    for (const item of items) {
      const locked = await tx
        .update(skus)
        .set({ lockedStock: sql`${skus.lockedStock} + ${item.quantity}` })
        .where(
          and(
            eq(skus.id, item.skuId),
            eq(skus.status, 'on'),
            sql`${skus.stock} - ${skus.lockedStock} >= ${item.quantity}`,
          ),
        )
        .returning({ id: skus.id });
      if (locked.length === 0) {
        throw new AppError('INSUFFICIENT_STOCK', `库存不足: ${describeSku(item.title, item.spec)}`);
      }
    }

    const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const freight = calcFreight(totalAmount);
    const payAmount = totalAmount + freight;

    // 订单号唯一：冲突时重试
    let order: Order | undefined;
    for (let attempt = 0; attempt < 3 && !order; attempt++) {
      const orderNo = generateOrderNo();
      const inserted = await tx
        .insert(orders)
        .values({
          orderNo,
          userId,
          status: 'PENDING_PAYMENT',
          totalAmount,
          freight,
          payAmount,
          addressSnapshot: {
            receiver: address.receiver,
            phone: address.phone,
            province: address.province,
            city: address.city,
            district: address.district,
            detail: address.detail,
          },
          remark: input.remark ?? null,
          channel: 'web',
          expireAt: new Date(Date.now() + orderExpireMinutes() * 60_000),
        })
        .onConflictDoNothing({ target: orders.orderNo })
        .returning();
      order = inserted[0];
    }
    if (!order) throw new AppError('CONFLICT', '订单号生成冲突，请重试');

    await tx.insert(orderItems).values(
      items.map((i) => ({
        orderId: order!.id,
        skuId: i.skuId,
        productId: i.productId,
        titleSnapshot: i.title,
        specSnapshot: i.spec,
        imageSnapshot: i.image,
        unitPrice: i.price,
        quantity: i.quantity,
        subtotal: i.price * i.quantity,
      })),
    );
    await tx
      .insert(payments)
      .values({ orderId: order.id, method: 'mock', amount: payAmount, status: 'INIT' });
    await tx.insert(inventoryLogs).values(
      items.map((i) => ({
        skuId: i.skuId,
        change: i.quantity,
        type: 'lock' as const,
        refOrderId: order!.id,
      })),
    );

    // 购物车来源：移除本次结算的条目
    const cartItemIds = items.map((i) => i.cartItemId).filter((x): x is number => x !== null);
    if (cartItemIds.length > 0) {
      await tx.delete(cartItems).where(inArray(cartItems.id, cartItemIds));
    }
    return order;
  });
}
