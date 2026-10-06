import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@dozari/shared';
import type { AgeTrack, ChildRow } from '@dozari/shared';
import { buildServer } from '../index.js';
import { AuthService } from '../auth/service.js';
import type { UserRecord, UserRepository } from '../auth/service.js';
import { createTokenSigner } from '../auth/tokens.js';
import { GuardianService } from '../guardian/service.js';
import type { GuardianStore } from '../guardian/service.js';
import { PhoneLoginService } from '../phone/login.js';
import { createMemoryPhoneStore } from '../phone/store.js';
import type { TrackRecord } from '../agetrack/service.js';

function memoryUsers() {
  const byId = new Map<string, UserRecord & { deviceId: string }>();
  const repo: UserRepository = {
    findByDeviceId: async (d) => [...byId.values()].find((u) => u.deviceId === d) ?? null,
    findById: async (id) => byId.get(id) ?? null,
    createGuest: async (deviceId, identity) => {
      const user = { id: `00000000-0000-7000-8000-${String(byId.size + 1).padStart(12, '0')}`, deviceId, ...identity, isBanned: false };
      byId.set(user.id, user);
      return user;
    },
    touch: async () => undefined,
    claimDevice: async (id, deviceId) => {
      for (const u of byId.values()) if (u.deviceId === deviceId) u.deviceId = '';
      const me = byId.get(id);
      if (me) me.deviceId = deviceId;
    },
  };
  return { byId, repo };
}

function memoryGuardianStore(users: ReturnType<typeof memoryUsers>, tracks: Map<string, TrackRecord>): GuardianStore {
  const links = new Map<string, string>();
  const codes = new Map<string, { childId: string; guardianId: string; expiresAt: number }>();
  let n = 100;
  return {
    guardianOf: async (c) => links.get(c) ?? null,
    childrenOf: async (g) => [...links].filter(([, gg]) => gg === g).map(([c]) => ({ id: c, nickname: users.byId.get(c)!.nickname, avatarKey: users.byId.get(c)!.avatarKey, track: (tracks.get(c)?.track ?? 'adult') as AgeTrack }) satisfies ChildRow),
    link: async (g, c) => (links.has(c) ? false : (links.set(c, g), true)),
    unlink: async (g, c) => (links.get(c) === g ? (links.delete(c), true) : false),
    isChildOf: async (g, c) => links.get(c) === g,
    createChild: async (g, track) => {
      const id = `00000000-0000-7000-8000-${String(++n).padStart(12, '0')}`;
      users.byId.set(id, { id, deviceId: `child:${id}`, nickname: 'کودک', avatarKey: 'avatar-01', isBanned: false });
      tracks.set(id, { track, setAt: new Date() });
      links.set(id, g);
      return id;
    },
    putCode: async (code, childId, guardianId, expiresAt) => (codes.has(code) ? false : (codes.set(code, { childId, guardianId, expiresAt }), true)),
    takeCode: async (code, now) => {
      const c = codes.get(code);
      if (!c || c.expiresAt <= now) return null;
      codes.delete(code);
      return { childId: c.childId, guardianId: c.guardianId };
    },
  };
}

function boot() {
  const clock = { ms: 1_000_000 };
  const users = memoryUsers();
  const tracks = new Map<string, TrackRecord>();
  const phoneStore = createMemoryPhoneStore();
  const sent: { phone: string; code: string }[] = [];
  const auth = new AuthService(users.repo, createTokenSigner('a-test-secret-that-is-long-enough', () => clock.ms), mulberry32(3));
  const login = new PhoneLoginService(phoneStore, auth, { sendCode: async (phone, code) => void sent.push({ phone, code }) }, () => clock.ms, () => '12345');
  const trackStore = { get: async (id: string) => tracks.get(id) ?? { track: 'adult' as AgeTrack, setAt: null }, getMany: async () => new Map<string, AgeTrack>(), save: async (id: string, track: AgeTrack, at: Date) => void tracks.set(id, { track, setAt: at }) };
  let dev = 0;
  const svc = new GuardianService(memoryGuardianStore(users, tracks), trackStore, login, phoneStore, auth, () => `guardian:${++dev}`, () => 0.123456, () => clock.ms);
  return { clock, users, tracks, phoneStore, sent, auth, svc, app: buildServer({ auth, guardian: svc }) };
}

const DEVICE = '0f8fad5b-d9cb-469f-a165-70867728950e';
async function childAccount(t: ReturnType<typeof boot>, track: AgeTrack = 'kid') {
  const login = await t.auth.guestLogin(DEVICE);
  if (!login.ok) throw new Error('login');
  t.tracks.set(login.session.user.id, { track, setAt: new Date() });
  return login.session;
}

describe('guardian link, the child asks', () => {
  it('links a kid to a guardian who proves their phone, creating the guardian account', async () => {
    const t = boot();
    const child = await childAccount(t);
    expect(await t.svc.requestCode(child.user.id, '09123456789')).toEqual({ ok: true });
    expect(t.sent).toEqual([{ phone: '+989123456789', code: '12345' }]);
    expect(await t.svc.confirm(child.user.id, '09123456789', '12345')).toEqual({ ok: true });
    expect(await t.svc.mine(child.user.id)).toEqual({ linked: true });
    const guardianId = await t.phoneStore.holderOf('+989123456789');
    expect(guardianId).toBeTruthy();
    expect((await t.svc.children(guardianId!)).children.map((c) => c.id)).toEqual([child.user.id]);
  });

  it('refuses an adult asking, a wrong code, and a second guardian', async () => {
    const t = boot();
    const adult = await childAccount(t, 'adult');
    expect(await t.svc.requestCode(adult.user.id, '09123456789')).toMatchObject({ ok: false, error: 'not_a_child' });
    const t2 = boot();
    const kid = await childAccount(t2, 'teen');
    await t2.svc.requestCode(kid.user.id, '09123456789');
    expect(await t2.svc.confirm(kid.user.id, '09123456789', '00000')).toMatchObject({ ok: false, error: 'wrong' });
    expect(await t2.svc.confirm(kid.user.id, '09123456789', '12345')).toEqual({ ok: true });
    expect(await t2.svc.requestCode(kid.user.id, '09120000000')).toMatchObject({ ok: false, error: 'already_linked' });
  });

  it('refuses a number held by a kid or teen account as guardian', async () => {
    const t = boot();
    const kidGuardian = await childAccount(t, 'kid');
    await t.phoneStore.markVerified(kidGuardian.user.id, '+989129999999', t.clock.ms);
    const other = await t.auth.guestLogin('1'.repeat(32));
    if (!other.ok) throw new Error('login');
    t.tracks.set(other.session.user.id, { track: 'teen', setAt: new Date() });
    await t.svc.requestCode(other.session.user.id, '09129999999');
    expect(await t.svc.confirm(other.session.user.id, '09129999999', '12345')).toMatchObject({ ok: false, error: 'not_adult' });
  });
});

describe('guardian side', () => {
  async function guardianWithPhone(t: ReturnType<typeof boot>) {
    const g = await t.auth.guestLogin('2'.repeat(32));
    if (!g.ok) throw new Error('login');
    await t.phoneStore.markVerified(g.session.user.id, '+989121111111', t.clock.ms);
    return g.session;
  }

  it('needs a verified phone before adding a child, then adds, codes, moves and removes', async () => {
    const t = boot();
    const g = await t.auth.guestLogin('2'.repeat(32));
    if (!g.ok) throw new Error('login');
    expect(await t.svc.addChild(g.session.user.id, 'kid')).toMatchObject({ ok: false, error: 'phone_required' });
    await t.phoneStore.markVerified(g.session.user.id, '+989121111111', t.clock.ms);
    const added = await t.svc.addChild(g.session.user.id, 'kid');
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(await t.svc.setTrack(g.session.user.id, added.childId, 'teen')).toEqual({ ok: true });
    expect(t.tracks.get(added.childId)?.track).toBe('teen');
    const code = await t.svc.linkCode(g.session.user.id, added.childId);
    expect(code).toMatchObject({ ok: true, code: '123456', expiresInSec: 600 });
    expect(await t.svc.remove(g.session.user.id, added.childId)).toEqual({ ok: true });
    expect(await t.svc.remove(g.session.user.id, added.childId)).toMatchObject({ ok: false, error: 'not_found' });
  });

  it("does not let one guardian touch another's child", async () => {
    const t = boot();
    const g = await guardianWithPhone(t);
    const added = await t.svc.addChild(g.user.id, 'kid');
    if (!added.ok) throw new Error('add');
    expect(await t.svc.linkCode('someone-else', added.childId)).toMatchObject({ ok: false, error: 'not_found' });
    expect(await t.svc.setTrack('someone-else', added.childId, 'teen')).toMatchObject({ ok: false, error: 'not_found' });
  });

  it("the child's device signs in with the code, once, and not after it expires", async () => {
    const t = boot();
    const g = await guardianWithPhone(t);
    const added = await t.svc.addChild(g.user.id, 'kid');
    if (!added.ok) throw new Error('add');
    const code = await t.svc.linkCode(g.user.id, added.childId);
    if (!code.ok) throw new Error('code');
    const session = await t.svc.redeem(code.code, '3'.repeat(32));
    expect(session?.user.id).toBe(added.childId);
    expect(await t.svc.redeem(code.code, '3'.repeat(32))).toBeNull();
    const again = await t.svc.linkCode(g.user.id, added.childId);
    if (!again.ok) throw new Error('code');
    t.clock.ms += 601_000;
    expect(await t.svc.redeem(again.code, '4'.repeat(32))).toBeNull();
  });

  it("opens one of the guardian's own children, and nobody else's", async () => {
    const t = boot();
    const g = await guardianWithPhone(t);
    const added = await t.svc.addChild(g.user.id, 'kid');
    if (!added.ok) throw new Error('add');
    const session = await t.svc.switchTo(g.user.id, added.childId, '5'.repeat(32));
    expect(session?.user.id).toBe(added.childId);
    expect(await t.svc.switchTo('someone-else', added.childId, '5'.repeat(32))).toBeNull();
  });
});

describe('guardian routes', () => {
  it('needs a signed-in player, validates the body, and the sign-in route answers 400 for a bad code', async () => {
    const t = boot();
    expect((await t.app.inject({ method: 'GET', url: '/guardian/children' })).statusCode).toBe(401);
    const child = await childAccount(t);
    const headers = { authorization: `Bearer ${child.token}` };
    expect((await t.app.inject({ method: 'POST', url: '/guardian/request', headers, payload: {} })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'POST', url: '/guardian/request', headers, payload: { phone: '09123456789' } })).json()).toEqual({ ok: true });
    expect((await t.app.inject({ method: 'POST', url: '/guardian/confirm', headers, payload: { phone: '09123456789', code: '99999' } })).statusCode).toBe(400);
    expect((await t.app.inject({ method: 'POST', url: '/guardian/confirm', headers, payload: { phone: '09123456789', code: '12345' } })).json()).toEqual({ ok: true });
    expect((await t.app.inject({ method: 'GET', url: '/me/guardian', headers })).json()).toEqual({ linked: true });
    expect((await t.app.inject({ method: 'POST', url: '/auth/child-link', payload: { code: '000000', deviceId: DEVICE } })).statusCode).toBe(400);
  });

  it('limits guesses of the link code', async () => {
    const t = boot();
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await t.app.inject({ method: 'POST', url: '/auth/child-link', payload: { code: '000000', deviceId: DEVICE } })).statusCode;
    expect(last).toBe(429);
  });
});
