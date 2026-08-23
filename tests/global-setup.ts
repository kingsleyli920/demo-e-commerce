import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { TestProject } from 'vitest/node';
import { createDb } from '../src/server/db/client';

/** 每次 `vitest run` 执行一次：把 migrations 应用到测试库 */
export default async function setup(project: TestProject) {
  const url = process.env.DATABASE_URL_TEST;
  if (!url || !/_test\b/.test(url)) {
    throw new Error('DATABASE_URL_TEST 必须指向 shop_test 测试库（参考 .env.example）');
  }
  const db = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
  } finally {
    await db.$client.end();
  }
  project.provide('dbUrl', url);
}

declare module 'vitest' {
  export interface ProvidedContext {
    dbUrl: string;
  }
}
