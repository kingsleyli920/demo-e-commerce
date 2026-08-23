import './env';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '../../src/server/db/client';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未设置');
  const db = createDb(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log(`[db:migrate] 已迁移 → ${url.replace(/:[^:@/]+@/, ':***@')}`);
  } finally {
    await db.$client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
