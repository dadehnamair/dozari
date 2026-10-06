import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';
import * as schema from './schema.js';

export function createDb(databaseUrl: string = process.env.DATABASE_URL ?? '') {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to connect to MySQL');
  }
  // timezone 'Z': DATETIME columns hold UTC; bigint columns come back as bigint, not lossy numbers.
  const pool = createPool({
    uri: databaseUrl,
    timezone: 'Z',
    supportBigNumbers: true,
    connectionLimit: Number(process.env.DB_POOL_SIZE ?? 20),
    queueLimit: 500, // fail fast under overload instead of queueing requests without bound
    enableKeepAlive: true, // survive idle-connection drops by the network or MySQL wait_timeout
  });
  return drizzle(pool, { schema, mode: 'default' });
}

export type Db = ReturnType<typeof createDb>;
