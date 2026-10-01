import { createDb } from '@dozari/db';
import { ROLES } from './permissions.js';
import type { Role } from './permissions.js';
import { AdminAccounts } from './service.js';
import { createDbAdminStore } from './store.js';

/**
 * Creates an admin account from the command line (the first owner, or a lost-access recovery):
 *   NEW_ADMIN_PASSWORD='...' pnpm --filter @dozari/server admin:create <username> <owner|editor|support|viewer> ["display name"]
 * The password comes from the environment so it never lands in the shell history or the process list.
 */
const [username, roleArg, displayName] = process.argv.slice(2);
const password = process.env.NEW_ADMIN_PASSWORD;
if (!username || !password || !ROLES.includes(roleArg as Role)) {
  console.error('usage: NEW_ADMIN_PASSWORD=... admin:create <username> <owner|editor|support|viewer> ["display name"]');
  process.exit(1);
}
const out = await new AdminAccounts(createDbAdminStore(createDb()), process.env.JWT_SECRET ?? 'unused-for-creation').create({ username, displayName: displayName ?? username, password, role: roleArg as Role });
if (typeof out === 'string') {
  console.error(`could not create the account: ${out}`);
  process.exit(1);
}
console.log(`created ${out.role} «${out.username}»`);
process.exit(0);
