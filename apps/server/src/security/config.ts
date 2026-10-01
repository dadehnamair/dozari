export interface EnvLike {
  NODE_ENV?: string;
  ADMIN_TOKEN?: string;
  JWT_SECRET?: string;
  CORS_ORIGIN?: string;
  DATABASE_URL?: string;
}

const WEAK = new Set(['dev-admin', 'admin', 'password', 'changeme', 'change-me', 'secret', 'dev-only-secret-change-me']);

/** Problems that must stop a production boot (`fatal`) or deserve a log line (`warn`). Pure so it can be tested. */
export function checkProductionConfig(env: EnvLike): { fatal: string[]; warn: string[] } {
  const fatal: string[] = [];
  const warn: string[] = [];
  if (env.NODE_ENV !== 'production') return { fatal, warn };
  if (!env.JWT_SECRET || env.JWT_SECRET.length < 32 || WEAK.has(env.JWT_SECRET)) fatal.push('JWT_SECRET must be set to a random value of at least 32 characters');
  if (env.ADMIN_TOKEN !== undefined && (env.ADMIN_TOKEN.length < 24 || WEAK.has(env.ADMIN_TOKEN))) fatal.push('ADMIN_TOKEN must be at least 24 characters and not a default value');
  if (env.CORS_ORIGIN === '*') warn.push('CORS_ORIGIN=* lets any website call the API from a browser; list the real origins instead');
  if (!env.DATABASE_URL) warn.push('DATABASE_URL is not set: the server runs without a database');
  return { fatal, warn };
}
