import './env';
import { sql } from 'drizzle-orm';
import { createDb } from '../../src/server/db/client';

// 仅用于本地开发：清空 public/drizzle schema 后由 db:migrate + db:seed 重建
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未设置');
  if (/prod/i.test(url)) throw new Error('拒绝对疑似生产库执行 reset');
  const db = createDb(url, { max: 1 });
  try {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
    await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
    await db.execute(sql`CREATE SCHEMA public`);
    console.log('[db:reset] schema 已清空');
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
