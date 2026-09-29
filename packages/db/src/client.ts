import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDb(databaseUrl: string = process.env.DATABASE_URL ?? '') {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to connect to Postgres');
  }
  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
