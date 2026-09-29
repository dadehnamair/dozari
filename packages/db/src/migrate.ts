import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client.js';

const db = createDb();
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied.');
process.exit(0);
