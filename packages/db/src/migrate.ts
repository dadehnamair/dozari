import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createDb } from './client.js';

const db = createDb();
await migrate(db, { migrationsFolder: './drizzle' });
console.log('Migrations applied.');
process.exit(0);
