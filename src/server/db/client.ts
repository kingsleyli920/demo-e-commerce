import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type DB = NodePgDatabase<typeof schema> & { $client: Pool };
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];
export type DbOrTx = DB | Tx;

const globalForDb = globalThis as unknown as { __shopDb?: DB; __shopPool?: Pool };

export function createDb(connectionString: string, opts: { max?: number } = {}): DB {
  const pool = new Pool({
    connectionString,
    max: opts.max ?? 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pool.on('error', (err) => {
    console.error('[db] idle client error', err);
  });
  return drizzle({ client: pool, schema, casing: 'snake_case' });
}

function resolveUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL 未设置（参考 .env.example）');
  return url;
}

/** 应用内单例（Next dev HMR 下复用同一个连接池） */
export const db: DB =
  globalForDb.__shopDb ??
  (() => {
    const instance = createDb(resolveUrl());
    if (process.env.NODE_ENV !== 'production') globalForDb.__shopDb = instance;
    return instance;
  })();

export { schema };
