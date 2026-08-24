import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client';

/**
 * 单测直接复用 service 层的 db 单例（vitest node project 已把 DATABASE_URL 指向 DATABASE_URL_TEST）。
 * 这里再做一次安全校验，避免误连开发库。
 */
export function getTestDb() {
  const url = process.env.DATABASE_URL ?? '';
  if (!/_test\b/.test(url)) throw new Error(`单测必须连接 *_test 测试库，当前: ${url}`);
  return db;
}

export async function closeTestDb() {
  await db.$client.end().catch(() => undefined);
}

/** 清空全部业务表与认证表（保留 schema），并重置自增 */
export async function resetDb() {
  await getTestDb().execute(sql`
    TRUNCATE TABLE
      inventory_logs, payments, order_items, orders,
      cart_items, carts, addresses, skus, products, categories,
      verification, session, account, "user"
    RESTART IDENTITY CASCADE
  `);
}
