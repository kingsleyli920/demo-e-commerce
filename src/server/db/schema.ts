import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Better Auth 表（字段名与 Better Auth 1.7 默认 schema 一致；列名由 casing: snake_case 自动映射）
// ---------------------------------------------------------------------------
export const userRoleEnum = pgEnum('user_role', ['buyer', 'admin']);

export const user = pgTable('user', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: userRoleEnum().notNull().default('buyer'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  'session',
  {
    id: text().primaryKey(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    token: text().notNull().unique(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_id_idx').on(t.userId)],
);

export const account = pgTable(
  'account',
  {
    id: text().primaryKey(),
    issuer: text().notNull(), // Better Auth 1.7+：凭据登录为 "local:credential"
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('account_user_id_idx').on(t.userId),
    uniqueIndex('account_issuer_account_id_uidx').on(t.issuer, t.accountId),
  ],
);

export const verification = pgTable(
  'verification',
  {
    id: text().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)],
);

// ---------------------------------------------------------------------------
// 业务表
// ---------------------------------------------------------------------------
export const productStatusEnum = pgEnum('product_status', ['on', 'off']);
export const skuStatusEnum = pgEnum('sku_status', ['on', 'off']);
export const orderStatusEnum = pgEnum('order_status', [
  'PENDING_PAYMENT',
  'PAID',
  'SHIPPED',
  'COMPLETED',
  'CANCELLED',
]);
export const orderChannelEnum = pgEnum('order_channel', ['web', 'ai_assistant']);
export const paymentMethodEnum = pgEnum('payment_method', ['mock']);
export const paymentStatusEnum = pgEnum('payment_status', ['INIT', 'SUCCESS', 'FAILED']);
export const inventoryLogTypeEnum = pgEnum('inventory_log_type', [
  'lock',
  'unlock',
  'deduct',
  'admin_adjust',
]);

export type ProductAttribute = { name: string; values: string[] };
export type SkuSpec = Record<string, string>;
export type AddressSnapshot = {
  receiver: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
};
export type ShippingInfo = { carrier: string | null; trackingNo: string | null };

export const addresses = pgTable(
  'addresses',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    receiver: text().notNull(),
    phone: text().notNull(),
    province: text().notNull(),
    city: text().notNull(),
    district: text().notNull(),
    detail: text().notNull(),
    isDefault: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('addresses_user_id_idx').on(t.userId),
    // 同一用户只能有一个默认地址（部分唯一索引）
    uniqueIndex('addresses_one_default_per_user')
      .on(t.userId)
      .where(sql`${t.isDefault} = true`),
  ],
);

export const categories = pgTable(
  'categories',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    parentId: integer().references((): AnyPgColumn => categories.id),
    name: text().notNull(),
    slug: text().notNull().unique(),
    sort: integer().notNull().default(0),
  },
  (t) => [index('categories_parent_id_idx').on(t.parentId)],
);

export const products = pgTable(
  'products',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    categoryId: integer()
      .notNull()
      .references(() => categories.id),
    title: text().notNull(),
    subtitle: text(),
    brand: text(),
    images: jsonb().$type<string[]>().notNull().default([]),
    description: text().notNull().default(''),
    attributes: jsonb().$type<ProductAttribute[]>().notNull().default([]),
    status: productStatusEnum().notNull().default('on'),
    minPrice: integer().notNull().default(0),
    salesCount: integer().notNull().default(0),
    rating: real().notNull().default(5),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('products_category_id_idx').on(t.categoryId),
    index('products_status_idx').on(t.status),
    index('products_min_price_idx').on(t.minPrice),
    index('products_sales_count_idx').on(t.salesCount),
  ],
);

export const skus = pgTable(
  'skus',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    productId: integer()
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    spec: jsonb().$type<SkuSpec>().notNull().default({}),
    specKey: text().notNull(),
    price: integer().notNull(),
    originalPrice: integer(),
    stock: integer().notNull().default(0),
    lockedStock: integer().notNull().default(0),
    image: text(),
    status: skuStatusEnum().notNull().default('on'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('skus_product_id_spec_key_uq').on(t.productId, t.specKey),
    check('skus_stock_check', sql`${t.stock} >= ${t.lockedStock} AND ${t.lockedStock} >= 0`),
    check('skus_price_check', sql`${t.price} >= 0`),
  ],
);

export const carts = pgTable('carts', {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  userId: text()
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const cartItems = pgTable(
  'cart_items',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    cartId: integer()
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    skuId: integer()
      .notNull()
      .references(() => skus.id, { onDelete: 'cascade' }),
    quantity: integer().notNull().default(1),
    selected: boolean().notNull().default(true),
    priceAtAdd: integer().notNull(), // 加购时价格，用于「价格有变动」提示
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('cart_items_cart_id_sku_id_uq').on(t.cartId, t.skuId),
    check('cart_items_quantity_check', sql`${t.quantity} >= 1 AND ${t.quantity} <= 99`),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    orderNo: text().notNull().unique(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: orderStatusEnum().notNull().default('PENDING_PAYMENT'),
    totalAmount: integer().notNull(),
    freight: integer().notNull().default(0),
    payAmount: integer().notNull(),
    addressSnapshot: jsonb().$type<AddressSnapshot>().notNull(),
    remark: text(),
    channel: orderChannelEnum().notNull().default('web'),
    expireAt: timestamp({ withTimezone: true }).notNull(),
    paidAt: timestamp({ withTimezone: true }),
    shippedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    shipping: jsonb().$type<ShippingInfo>(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('orders_user_id_created_at_idx').on(t.userId, t.createdAt),
    index('orders_status_idx').on(t.status),
    index('orders_status_expire_at_idx').on(t.status, t.expireAt),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    orderId: integer()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    skuId: integer()
      .notNull()
      .references(() => skus.id),
    productId: integer()
      .notNull()
      .references(() => products.id),
    titleSnapshot: text().notNull(),
    specSnapshot: jsonb().$type<SkuSpec>().notNull().default({}),
    imageSnapshot: text(),
    unitPrice: integer().notNull(),
    quantity: integer().notNull(),
    subtotal: integer().notNull(),
  },
  (t) => [index('order_items_order_id_idx').on(t.orderId)],
);

export const payments = pgTable(
  'payments',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    orderId: integer()
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    method: paymentMethodEnum().notNull().default('mock'),
    amount: integer().notNull(),
    status: paymentStatusEnum().notNull().default('INIT'),
    transactionNo: text().unique(),
    paidAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index('payments_order_id_idx').on(t.orderId)],
);

export const inventoryLogs = pgTable(
  'inventory_logs',
  {
    id: integer().primaryKey().generatedByDefaultAsIdentity(),
    skuId: integer()
      .notNull()
      .references(() => skus.id, { onDelete: 'cascade' }),
    change: integer().notNull(),
    type: inventoryLogTypeEnum().notNull(),
    refOrderId: integer().references(() => orders.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('inventory_logs_sku_id_idx').on(t.skuId),
    index('inventory_logs_ref_order_id_idx').on(t.refOrderId),
  ],
);

// ---------------------------------------------------------------------------
// relations（v1 relational queries）
// ---------------------------------------------------------------------------
export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  addresses: many(addresses),
  orders: many(orders),
}));
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'category_parent',
  }),
  children: many(categories, { relationName: 'category_parent' }),
  products: many(products),
}));
export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  skus: many(skus),
}));
export const skusRelations = relations(skus, ({ one }) => ({
  product: one(products, { fields: [skus.productId], references: [products.id] }),
}));
export const cartsRelations = relations(carts, ({ one, many }) => ({
  user: one(user, { fields: [carts.userId], references: [user.id] }),
  items: many(cartItems),
}));
export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  sku: one(skus, { fields: [cartItems.skuId], references: [skus.id] }),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(user, { fields: [orders.userId], references: [user.id] }),
  items: many(orderItems),
  payments: many(payments),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  sku: one(skus, { fields: [orderItems.skuId], references: [skus.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));
export const inventoryLogsRelations = relations(inventoryLogs, ({ one }) => ({
  sku: one(skus, { fields: [inventoryLogs.skuId], references: [skus.id] }),
  order: one(orders, { fields: [inventoryLogs.refOrderId], references: [orders.id] }),
}));

// ---------------------------------------------------------------------------
// 类型导出
// ---------------------------------------------------------------------------
export type User = typeof user.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sku = typeof skus.$inferSelect;
export type Cart = typeof carts.$inferSelect;
export type CartItem = typeof cartItems.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type InventoryLog = typeof inventoryLogs.$inferSelect;
export type OrderStatus = Order['status'];
