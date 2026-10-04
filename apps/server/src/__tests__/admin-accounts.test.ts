import { describe, expect, it } from 'vitest';
import { buildServer } from '../index.js';
import { AdminAccounts } from '../admin/accounts/service.js';
import { createMemoryAdminStore } from '../admin/accounts/store.js';
import { hashPassword, passwordProblem, verifyPassword } from '../admin/accounts/password.js';
import { can, permissionFor } from '../admin/accounts/permissions.js';
import { createMemoryAuditLog } from '../admin/audit.js';
import type { UsersAdmin } from '../admin/users.js';

const LEGACY = 'legacy-admin-token-0123456789';
const PW = 'correct horse battery';

describe('passwords', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword(PW);
    const b = await hashPassword(PW);
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword(PW, a)).toBe(true);
    expect(await verifyPassword('wrong password!', a)).toBe(false);
    expect(await verifyPassword(PW, 'garbage')).toBe(false);
  });
  it('rejects weak passwords', () => {
    expect(passwordProblem('short', 'ali')).toBe('too_short');
    expect(passwordProblem('ali-is-the-best', 'ali')).toBe('contains_username');
    expect(passwordProblem('aaaaaaaaaaaa', 'ali')).toBe('too_simple');
    expect(passwordProblem(PW, 'ali')).toBeNull();
  });
});

describe('role permissions', () => {
  it('maps requests to the permission they need (deny by default)', () => {
    expect(permissionFor('GET', '/admin/users')).toBe('read');
    expect(permissionFor('POST', '/admin/users/x/ban')).toBe('users');
    expect(permissionFor('POST', '/admin/users/x/coins')).toBe('economy');
    expect(permissionFor('PUT', '/admin/daily-reward')).toBe('economy');
    expect(permissionFor('POST', '/admin/messages')).toBe('messages');
    expect(permissionFor('POST', '/admin/bale/broadcast')).toBe('messages');
    expect(permissionFor('POST', '/admin/words')).toBe('content');
    expect(permissionFor('PATCH', '/admin/prices/x')).toBe('content');
    expect(permissionFor('POST', '/admin/bot/run-due')).toBe('content');
    expect(permissionFor('PUT', '/admin/settings/app.maintenance_on')).toBe('system');
    expect(permissionFor('POST', '/admin/bale/test')).toBe('system');
    expect(permissionFor('GET', '/admin/admins')).toBe('system'); // even reading the account list
    expect(permissionFor('POST', '/admin/something-new')).toBe('system');
  });
  it('gives each role only its own areas', () => {
    expect(can('viewer', 'users')).toBe(false);
    expect(can('support', 'users')).toBe(true);
    expect(can('support', 'content')).toBe(false);
    expect(can('editor', 'content')).toBe(true);
    expect(can('editor', 'economy')).toBe(false);
    expect(can('owner', 'system')).toBe(true);
  });
});

function boot(users?: UsersAdmin) {
  let t = 1_700_000_000_000;
  const store = createMemoryAdminStore();
  const accounts = new AdminAccounts(store, 'a-test-secret-that-is-long-enough', LEGACY, () => t);
  const audit = createMemoryAuditLog();
  const app = buildServer({
    admin: { repo: { listCatalog: async () => [], setPriceStatus: async () => 'ok' }, token: LEGACY, accounts },
    adminModules: { audit, users },
  });
  const legacy = { 'x-admin-token': LEGACY };
  const login = async (username: string, password = PW) => app.inject({ method: 'POST', url: '/admin/login', payload: { username, password } });
  const tokenOf = async (username: string) => ({ 'x-admin-token': ((await login(username)).json() as { token: string }).token });
  const make = (username: string, role: string) => app.inject({ method: 'POST', url: '/admin/admins', headers: legacy, payload: { username, displayName: `نام ${username}`, password: PW, role } });
  return { app, accounts, audit, legacy, login, tokenOf, make, tick: (ms: number) => (t += ms) };
}

describe('admin accounts over HTTP', () => {
  it('the owner creates accounts (validated), who sign in and see who they are', async () => {
    const { app, make, login, tokenOf, legacy } = boot();
    expect((await make('Bad Name!', 'viewer')).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/admin/admins', headers: legacy, payload: { username: 'sara', displayName: 'سارا', password: 'short', role: 'viewer' } })).json()).toEqual({ error: 'weak_password' });
    const made = await make('sara', 'support');
    expect(made.statusCode).toBe(201);
    expect(JSON.stringify(made.json())).not.toContain('scrypt');
    expect((await make('sara', 'viewer')).statusCode).toBe(409);
    expect((await login('sara', 'wrong password!!')).statusCode).toBe(401);
    expect((await login('nobody')).statusCode).toBe(401);
    const ok = await login('sara');
    expect(ok.json()).toMatchObject({ admin: { username: 'sara', role: 'support' }, permissions: ['read', 'users'] });
    const me = (await app.inject({ method: 'GET', url: '/admin/me', headers: await tokenOf('sara') })).json();
    expect(me).toMatchObject({ name: 'نام sara', role: 'support', legacy: false });
    expect((await app.inject({ method: 'GET', url: '/admin/me', headers: legacy })).json()).toMatchObject({ role: 'owner', legacy: true });
  });

  it('enforces roles: viewer reads only, support cannot touch settings, only the owner manages admins', async () => {
    const { app, make, tokenOf } = boot();
    await make('vera', 'viewer');
    await make('sam', 'support');
    await make('eli', 'editor');
    const viewer = await tokenOf('vera');
    const support = await tokenOf('sam');
    const editor = await tokenOf('eli');
    expect((await app.inject({ method: 'GET', url: '/admin/catalog', headers: viewer })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PATCH', url: '/admin/prices/0190a000-0000-7000-8000-000000000001', headers: viewer, payload: { status: 'approved' } })).json()).toEqual({ error: 'forbidden', needs: 'content' });
    expect((await app.inject({ method: 'PATCH', url: '/admin/prices/0190a000-0000-7000-8000-000000000001', headers: editor, payload: { status: 'approved' } })).statusCode).not.toBe(403);
    expect((await app.inject({ method: 'PATCH', url: '/admin/prices/0190a000-0000-7000-8000-000000000001', headers: support, payload: { status: 'approved' } })).statusCode).toBe(403);
    for (const headers of [viewer, support, editor]) {
      expect((await app.inject({ method: 'GET', url: '/admin/admins', headers })).statusCode).toBe(403);
      expect((await app.inject({ method: 'POST', url: '/admin/admins', headers, payload: { username: 'evil', displayName: 'x', password: PW, role: 'owner' } })).statusCode).toBe(403);
    }
  });

  it('locks an account after 5 wrong passwords and unlocks after the pause', async () => {
    const { login, make, tick } = boot();
    await make('lena', 'viewer');
    for (let i = 0; i < 4; i++) expect((await login('lena', 'wrong password!!')).statusCode).toBe(401);
    expect((await login('lena', 'wrong password!!')).statusCode).toBe(423);
    expect((await login('lena')).statusCode).toBe(423); // even the right password, while locked
    tick(16 * 60_000);
    expect((await login('lena')).statusCode).toBe(200);
  });

  it('ends sessions when the password changes or the account is switched off, and protects the last owner', async () => {
    const { app, make, tokenOf, legacy, accounts } = boot();
    const id = (await make('omar', 'owner')).json().id as string;
    const t1 = await tokenOf('omar');
    expect((await app.inject({ method: 'GET', url: '/admin/me', headers: t1 })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url: `/admin/admins/${id}/password`, headers: legacy, payload: { password: 'brand new password 1' } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/admin/me', headers: t1 })).statusCode).toBe(401);
    const t2 = { 'x-admin-token': ((await app.inject({ method: 'POST', url: '/admin/login', payload: { username: 'omar', password: 'brand new password 1' } })).json() as { token: string }).token };
    expect((await app.inject({ method: 'GET', url: '/admin/me', headers: t2 })).statusCode).toBe(200);
    expect((await app.inject({ method: 'PUT', url: `/admin/admins/${id}`, headers: legacy, payload: { isActive: false } })).statusCode).toBe(200); // legacy token still exists: allowed
    expect((await app.inject({ method: 'GET', url: '/admin/me', headers: t2 })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/admin/login', payload: { username: 'omar', password: 'brand new password 1' } })).statusCode).toBe(401);
    // without a legacy token the last active owner cannot be demoted
    const solo = new AdminAccounts(createMemoryAdminStore(), 'a-test-secret-that-is-long-enough');
    const owner = (await solo.create({ username: 'only', displayName: 'تنها', password: PW, role: 'owner' })) as { id: string };
    expect(await solo.update(owner.id, { role: 'viewer' })).toBe('LAST_OWNER');
    expect(await solo.update(owner.id, { isActive: false })).toBe('LAST_OWNER');
    expect(accounts.hasLegacyToken).toBe(true);
  });

  it('records which admin did what in the audit log', async () => {
    const { app, make, tokenOf, audit } = boot();
    await make('nima', 'editor');
    const h = await tokenOf('nima');
    await app.inject({ method: 'POST', url: '/admin/words', headers: h, payload: { word: 'x' } }); // no words module: 404, no audit
    expect(audit.entries.map((e) => e.action)).toContain('admin.create');
    expect(audit.entries.find((e) => e.action === 'admin.create')?.actor).toBe('توکن اصلی');
  });

  it('login is rate limited per IP and never accepts a forged session', async () => {
    const { app } = boot();
    for (let i = 0; i < 10; i++) expect((await app.inject({ method: 'POST', url: '/admin/login', payload: { username: 'x', password: 'y' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/admin/login', payload: { username: 'x', password: 'y' } })).statusCode).toBe(429);
    const fresh = boot();
    expect((await fresh.app.inject({ method: 'GET', url: '/admin/me', headers: { 'x-admin-token': 'aaa.bbb.ccc' } })).statusCode).toBe(401);
  });
});

describe('birth date privacy in the user sheet', () => {
  const ID = '0190a000-0000-7000-8000-000000000042';
  const users = { detail: async (id: string) => (id === ID ? { id, nickname: 'n', avatarKey: 'avatar-01', isBanned: false, balance: 0, createdAt: 1, lastSeenAt: 2, gender: null, banReason: null, bannedAt: null, friends: 0, age: 24, birth: { year: 1381, month: 5, day: 9 }, baleLinked: false, notes: [] } : null) } as unknown as UsersAdmin;

  it('shows the age to support and the exact date only to the owner', async () => {
    const { app, make, tokenOf, legacy } = boot(users);
    await make('sam', 'support');
    const asSupport = (await app.inject({ method: 'GET', url: `/admin/users/${ID}`, headers: await tokenOf('sam') })).json();
    expect(asSupport).toMatchObject({ age: 24, birth: null });
    const asOwner = (await app.inject({ method: 'GET', url: `/admin/users/${ID}`, headers: legacy })).json();
    expect(asOwner).toMatchObject({ age: 24, birth: { year: 1381, month: 5, day: 9 } });
  });
});

