export const ROLES = ['owner', 'editor', 'support', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = ['read', 'users', 'content', 'messages', 'economy', 'system'] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * What each role may do:
 * - viewer: look at everything (except admin accounts), change nothing
 * - support: players (ban, rename, notes, log-out)
 * - editor: catalog, prices, bot, word filter, messages
 * - owner: everything, including coins, settings, maintenance mode and admin accounts
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  viewer: ['read'],
  support: ['read', 'users'],
  editor: ['read', 'content', 'messages'],
  owner: PERMISSIONS,
};

export const can = (role: Role, permission: Permission): boolean => ROLE_PERMISSIONS[role].includes(permission);

/**
 * The permission a request needs, by method and path. Anything not listed needs `system` (deny by default), reads need `read`,
 * and the admin-account list is owner-only even to read.
 */
export function permissionFor(method: string, path: string): Permission {
  const m = method.toUpperCase();
  if (path === '/admin/admins' || path.startsWith('/admin/admins/')) return 'system';
  if (path === '/admin/me') return 'read';
  if (m === 'GET' || m === 'HEAD') return 'read';
  if (/^\/admin\/users\/[^/]+\/coins$/.test(path)) return 'economy';
  if (path.startsWith('/admin/daily-reward') || path.startsWith('/admin/shop') || path.startsWith('/admin/keepsake') || path.startsWith('/admin/wheel') || path.startsWith('/admin/coin-packages') || path.startsWith('/admin/tournaments') || path.startsWith('/admin/sponsors') || path.startsWith('/admin/invites')) return 'economy';
  if (path.startsWith('/admin/users') || path.startsWith('/admin/guardians') || path.startsWith('/admin/bots') || path.startsWith('/admin/badges') || path.startsWith('/admin/user-notes')) return 'users';
  if (path.startsWith('/admin/messages')) return 'messages';
  if (path.startsWith('/admin/short-links') || path.startsWith('/admin/landing') || path.startsWith('/admin/uploads') || path.startsWith('/admin/words') || path.startsWith('/admin/taunt') || path.startsWith('/admin/chat') || path.startsWith('/admin/cities') || path.startsWith('/admin/daily-puzzle') || path.startsWith('/admin/puzzles') || path.startsWith('/admin/ai')) return 'content';
  if (path.startsWith('/admin/catalog') || path.startsWith('/admin/prices') || path.startsWith('/admin/products') || path.startsWith('/admin/bot')) return 'content';
  if (path.startsWith('/admin/bale/broadcast')) return 'messages';
  return 'system'; // settings, bale test, anything new
}
