import { createHash, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { hashPassword, passwordProblem, verifyPassword } from './password.js';
import { ROLE_PERMISSIONS } from './permissions.js';
import type { Permission, Role } from './permissions.js';
import type { AdminRecord, AdminStore } from './store.js';

export const SESSION_HOURS = 8;
const MAX_FAILED = 5;
const LOCK_MS = 15 * 60_000;
const USERNAME = /^[a-z0-9][a-z0-9_.-]{2,29}$/;

/** Who is calling the admin API. `legacy` = the static ADMIN_TOKEN (break-glass owner access, no personal audit trail). */
export interface AdminActor {
  id: string;
  name: string;
  role: Role;
  legacy: boolean;
}

export interface PublicAdmin {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  locked: boolean;
}

export type AccountError = 'DUPLICATE' | 'INVALID_USERNAME' | 'WEAK_PASSWORD' | 'NOT_FOUND' | 'LAST_OWNER';

const digest = (s: string) => createHash('sha256').update(s).digest();

export class AdminAccounts {
  private readonly key: Uint8Array;
  private dummyHash: Promise<string> | null = null;

  constructor(
    private readonly store: AdminStore,
    secret: string,
    private readonly legacyToken?: string,
    private readonly now: () => number = Date.now,
  ) {
    this.key = digest(`${secret}:dozari-admin`);
  }

  get hasLegacyToken(): boolean {
    return Boolean(this.legacyToken);
  }

  private pub(r: AdminRecord): PublicAdmin {
    return { id: r.id, username: r.username, displayName: r.displayName, role: r.role, isActive: r.isActive, createdAt: r.createdAt, lastLoginAt: r.lastLoginAt, locked: r.lockedUntil !== null && r.lockedUntil > this.now() };
  }

  permissions(role: Role): readonly Permission[] {
    return ROLE_PERMISSIONS[role];
  }

  async login(username: string, password: string): Promise<{ ok: true; token: string; admin: PublicAdmin } | { ok: false; error: 'invalid' | 'locked' }> {
    const rec = await this.store.byUsername(username.trim().toLowerCase());
    if (!rec || !rec.isActive) {
      // Same work as a real check, so a wrong username cannot be told from a wrong password by timing.
      this.dummyHash ??= hashPassword('not-a-real-password');
      await verifyPassword(password, await this.dummyHash);
      return { ok: false, error: 'invalid' };
    }
    if (rec.lockedUntil !== null && rec.lockedUntil > this.now()) return { ok: false, error: 'locked' };
    if (!(await verifyPassword(password, rec.passwordHash))) {
      const failed = rec.failedLogins + 1;
      await this.store.update(rec.id, failed >= MAX_FAILED ? { failedLogins: 0, lockedUntil: this.now() + LOCK_MS } : { failedLogins: failed });
      return { ok: false, error: failed >= MAX_FAILED ? 'locked' : 'invalid' };
    }
    await this.store.update(rec.id, { failedLogins: 0, lockedUntil: null, lastLoginAt: this.now() });
    const iat = Math.floor(this.now() / 1000);
    const token = await new SignJWT({ ver: rec.sessionVersion }).setProtectedHeader({ alg: 'HS256' }).setSubject(rec.id).setIssuer('dozari-admin').setIssuedAt(iat).setExpirationTime(iat + SESSION_HOURS * 3600).sign(this.key);
    return { ok: true, token, admin: this.pub({ ...rec, lastLoginAt: this.now() }) };
  }

  /** The caller behind the `x-admin-token` header value: the static break-glass token, or a signed session. */
  async authenticate(value: string): Promise<AdminActor | null> {
    if (this.legacyToken && timingSafeEqual(digest(value), digest(this.legacyToken))) return { id: 'legacy', name: 'توکن اصلی', role: 'owner', legacy: true };
    try {
      const { payload } = await jwtVerify(value, this.key, { algorithms: ['HS256'], issuer: 'dozari-admin', currentDate: new Date(this.now()) });
      const rec = typeof payload.sub === 'string' ? await this.store.byId(payload.sub) : null;
      if (!rec || !rec.isActive || rec.sessionVersion !== payload.ver) return null;
      return { id: rec.id, name: rec.displayName, role: rec.role, legacy: false };
    } catch {
      return null;
    }
  }

  async list(): Promise<PublicAdmin[]> {
    return (await this.store.list()).map((r) => this.pub(r));
  }

  async create(input: { username: string; displayName: string; password: string; role: Role }): Promise<PublicAdmin | AccountError> {
    const username = input.username.trim().toLowerCase();
    if (!USERNAME.test(username)) return 'INVALID_USERNAME';
    if (passwordProblem(input.password, username)) return 'WEAK_PASSWORD';
    const out = await this.store.create({ username, displayName: input.displayName.trim(), passwordHash: await hashPassword(input.password), role: input.role });
    return out === 'duplicate' ? 'DUPLICATE' : this.pub(out);
  }

  private async activeOwners(): Promise<AdminRecord[]> {
    return (await this.store.list()).filter((r) => r.role === 'owner' && r.isActive);
  }

  /** Changes role / name / active flag. The last active owner can be neither demoted nor deactivated. Deactivating ends the sessions. */
  async update(id: string, patch: { displayName?: string; role?: Role; isActive?: boolean }): Promise<PublicAdmin | AccountError> {
    const rec = await this.store.byId(id);
    if (!rec) return 'NOT_FOUND';
    const losesOwner = rec.role === 'owner' && rec.isActive && ((patch.role !== undefined && patch.role !== 'owner') || patch.isActive === false);
    if (losesOwner && (await this.activeOwners()).length <= 1 && !this.hasLegacyToken) return 'LAST_OWNER';
    const deactivating = patch.isActive === false && rec.isActive;
    await this.store.update(id, { ...patch, ...(deactivating || (patch.role !== undefined && patch.role !== rec.role) ? { sessionVersion: rec.sessionVersion + 1 } : {}) });
    return this.pub((await this.store.byId(id))!);
  }

  async setPassword(id: string, password: string): Promise<'ok' | AccountError> {
    const rec = await this.store.byId(id);
    if (!rec) return 'NOT_FOUND';
    if (passwordProblem(password, rec.username)) return 'WEAK_PASSWORD';
    await this.store.update(id, { passwordHash: await hashPassword(password), sessionVersion: rec.sessionVersion + 1, failedLogins: 0, lockedUntil: null });
    return 'ok';
  }
}
