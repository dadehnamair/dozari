import type { FastifyInstance } from 'fastify';
import { GUARDIAN_LINK_CODE_LENGTH, GUARDIAN_LINK_CODE_TTL_SEC, GUARDIAN_MAX_CHILDREN, childCreateSchema, childLinkRequestSchema, childTrackPutSchema, guardianConfirmSchema, guardianRequestSchema, guardianSettingsSchema } from '@dozari/shared';
import type { ChildRow, ChildrenResponse, Session } from '@dozari/shared';
import type { AuthService } from '../auth/service.js';
import { currentUser } from '../auth/routes.js';
import type { AgeTrackStore } from '../agetrack/service.js';
import { RateLimiter } from '../security/rate-limit.js';
import type { ChildDigest, GuardianSettings } from '@dozari/shared';
import type { GuardianSettingsService } from './settings.js';
import type { BlockedRow, GuardianBlockStore } from './extras.js';

/** I/O boundary of guardian links (docs/logic/age-tracks.md): child profiles, link codes, new child accounts. */
export interface GuardianStore {
  guardianOf(childId: string): Promise<string | null>;
  childrenOf(guardianId: string): Promise<ChildRow[]>;
  /** False when the child already has a guardian. */
  link(guardianId: string, childId: string): Promise<boolean>;
  unlink(guardianId: string, childId: string): Promise<boolean>;
  isChildOf(guardianId: string, childId: string): Promise<boolean>;
  /** Makes a child account (no device, no phone) of the given track and links it. Returns its id. */
  createChild(guardianId: string, track: 'kid' | 'teen'): Promise<string>;
  /** Replaces any live code of this child; false when the code is already taken by another child. */
  putCode(code: string, childId: string, guardianId: string, expiresAt: number): Promise<boolean>;
  /** Uses a code up: the child it opens, or null when unknown or expired. */
  takeCode(code: string, now: number): Promise<{ childId: string; guardianId: string } | null>;
}

/** The slice of the SMS-code service the guardian flow needs (`PhoneLoginService`). */
export interface GuardianProof {
  sendCode(phone: string): Promise<{ ok: true } | { ok: false; error: string; retryAfterSec?: number }>;
  prove(phone: string, code: string): Promise<{ ok: true; phone: string } | { ok: false; error: string }>;
}

/** The slice of the phone store the guardian flow needs. */
export interface GuardianPhones {
  holderOf(phone: string): Promise<string | null>;
  markVerified(userId: string, phone: string, now: number): Promise<boolean>;
  state(userId: string): Promise<{ phone: string | null }>;
}

/** The slice of the social service a guardian uses on a child's friendships: list, approve what the child may not accept, remove. */
export interface GuardianFriends {
  friends(childId: string): Promise<{ id: string; nickname: string; avatarKey: string }[]>;
  incoming(childId: string): Promise<{ id: string; nickname: string; avatarKey: string }[]>;
  /** Accepts a request on the child's behalf. */
  approve(childId: string, otherId: string): Promise<boolean>;
  remove(childId: string, otherId: string): Promise<boolean>;
}

export type GuardianError =
  | 'not_a_child'
  | 'already_linked'
  | 'not_adult'
  | 'phone_required'
  | 'too_many_children'
  | 'not_found'
  | 'self'
  | 'sms_unavailable'
  | 'too_soon'
  | 'rate_limited'
  | 'send_failed'
  | 'invalid_phone'
  | 'no_code'
  | 'expired'
  | 'wrong'
  | 'too_many'
  | 'account_failed'
  | 'code_failed';
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: GuardianError; retryAfterSec?: number };

export class GuardianService {
  /** Settings of each child (chat mode, friend approval, duels, quiet hours, reminder); set at start-up. */
  settings?: GuardianSettingsService;
  /** A child's friendships, for the panel; set at start-up. */
  friends?: GuardianFriends;
  /** Players blocked for each child; set at start-up. */
  blocks?: GuardianBlockStore;
  /** Builds the digest of a child; set at start-up. */
  digest?: (childId: string) => Promise<ChildDigest>;
  /** Writes a row to the audit log (guardian links, band moves, settings changes); set at start-up, best effort. */
  audit?: (action: string, target: string, detail?: string) => void;

  constructor(
    private readonly store: GuardianStore,
    private readonly tracks: AgeTrackStore,
    private readonly proof: GuardianProof,
    private readonly phones: GuardianPhones,
    private readonly auth: AuthService,
    private readonly newDeviceId: () => string,
    private readonly rng: () => number = Math.random,
    private readonly now: () => number = Date.now,
  ) {}

  async mine(userId: string): Promise<{ linked: boolean }> {
    return { linked: (await this.store.guardianOf(userId)) !== null };
  }

  /** The child side: may this account ask a guardian to link? Only a kid or teen without a guardian. */
  private async childCheck(childId: string): Promise<GuardianError | null> {
    const t = (await this.tracks.get(childId)).track;
    if (t === 'adult') return 'not_a_child';
    if (await this.store.guardianOf(childId)) return 'already_linked';
    return null;
  }

  async requestCode(childId: string, phone: string): Promise<Result> {
    const bad = await this.childCheck(childId);
    if (bad) return { ok: false, error: bad };
    const out = await this.proof.sendCode(phone);
    return out.ok ? { ok: true } : { ok: false, error: out.error as GuardianError, ...(out.retryAfterSec ? { retryAfterSec: out.retryAfterSec } : {}) };
  }

  /** The guardian proved their number: find or make their account and link the asking child to it. */
  async confirm(childId: string, phone: string, code: string): Promise<Result> {
    const bad = await this.childCheck(childId);
    if (bad) return { ok: false, error: bad };
    const proven = await this.proof.prove(phone, code);
    if (!proven.ok) return { ok: false, error: proven.error as GuardianError };
    let guardianId = await this.phones.holderOf(proven.phone);
    if (!guardianId) {
      const made = await this.auth.guestLogin(this.newDeviceId());
      if (!made.ok) return { ok: false, error: 'account_failed' };
      guardianId = made.session.user.id;
      if (!(await this.phones.markVerified(guardianId, proven.phone, this.now()))) return { ok: false, error: 'account_failed' };
    }
    if (guardianId === childId) return { ok: false, error: 'self' };
    if ((await this.tracks.get(guardianId)).track !== 'adult') return { ok: false, error: 'not_adult' };
    if ((await this.store.childrenOf(guardianId)).length >= GUARDIAN_MAX_CHILDREN) return { ok: false, error: 'too_many_children' };
    if (!(await this.store.link(guardianId, childId))) return { ok: false, error: 'already_linked' };
    this.audit?.('guardian.link', childId, guardianId);
    return { ok: true };
  }

  /** The guardian side: may this account hold children? An adult with a verified number. */
  private async guardianCheck(guardianId: string): Promise<GuardianError | null> {
    if ((await this.tracks.get(guardianId)).track !== 'adult') return 'not_adult';
    if (!(await this.phones.state(guardianId)).phone) return 'phone_required';
    return null;
  }

  async children(guardianId: string): Promise<ChildrenResponse> {
    return { children: await this.store.childrenOf(guardianId), phoneVerified: !!(await this.phones.state(guardianId)).phone, max: GUARDIAN_MAX_CHILDREN };
  }

  async addChild(guardianId: string, track: 'kid' | 'teen'): Promise<Result<{ childId: string }>> {
    const bad = await this.guardianCheck(guardianId);
    if (bad) return { ok: false, error: bad };
    if ((await this.store.childrenOf(guardianId)).length >= GUARDIAN_MAX_CHILDREN) return { ok: false, error: 'too_many_children' };
    const childId = await this.store.createChild(guardianId, track);
    this.audit?.('guardian.add_child', childId, `${guardianId} ${track}`);
    return { ok: true, childId };
  }

  async linkCode(guardianId: string, childId: string): Promise<Result<{ code: string; expiresInSec: number }>> {
    if (!(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    for (let i = 0; i < 5; i++) {
      const code = String(Math.floor(this.rng() * 10 ** GUARDIAN_LINK_CODE_LENGTH)).padStart(GUARDIAN_LINK_CODE_LENGTH, '0');
      if (await this.store.putCode(code, childId, guardianId, this.now() + GUARDIAN_LINK_CODE_TTL_SEC * 1000)) return { ok: true, code, expiresInSec: GUARDIAN_LINK_CODE_TTL_SEC };
    }
    return { ok: false, error: 'code_failed' };
  }

  /** The child's device shows the code: it signs in as the child. Null for an unknown or expired code (and for a banned child). */
  async redeem(code: string, deviceId: string): Promise<Session | null> {
    const hit = await this.store.takeCode(code, this.now());
    if (!hit) return null;
    return this.auth.sessionFor(hit.childId, deviceId);
  }

  /** A guardian may move their child to any child track (an older one needs their say, which is this call). */
  /** The guardian's device (just signed in by phone) picks one of their children to play as: a session for that child. */
  async switchTo(guardianId: string, childId: string, deviceId: string): Promise<Session | null> {
    if (!(await this.store.isChildOf(guardianId, childId))) return null;
    return this.auth.sessionFor(childId, deviceId);
  }

  async setTrack(guardianId: string, childId: string, track: 'kid' | 'teen'): Promise<Result> {
    if (!(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    await this.tracks.save(childId, track, new Date(this.now()));
    this.audit?.('guardian.child_track', childId, `${guardianId} ${track}`);
    return { ok: true };
  }

  /** The panel of one child: only their own guardian reads or changes it. */
  async getSettings(guardianId: string, childId: string): Promise<Result<{ settings: GuardianSettings }>> {
    if (!this.settings || !(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    return { ok: true, settings: await this.settings.get(childId) };
  }

  async putSettings(guardianId: string, childId: string, next: GuardianSettings): Promise<Result<{ settings: GuardianSettings }>> {
    if (!this.settings || !(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    const saved = await this.settings.put(childId, next);
    this.audit?.('guardian.settings', childId, `${guardianId} chat=${next.chatMode} friends=${next.friendApproval} duels=${next.duelsEnabled}`);
    return { ok: true, settings: saved };
  }

  /** «امروز چه یاد گرفت»: words learned, games this week, level and friends. */
  async digestOf(guardianId: string, childId: string): Promise<Result<{ digest: ChildDigest }>> {
    if (!this.digest || !(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    return { ok: true, digest: await this.digest(childId) };
  }

  /** Friends and the requests waiting for the guardian's yes (`friend_approval = ask`). */
  async friendsOf(guardianId: string, childId: string): Promise<Result<{ friends: { id: string; nickname: string; avatarKey: string }[]; requests: { id: string; nickname: string; avatarKey: string }[] }>> {
    if (!this.friends || !(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    return { ok: true, friends: await this.friends.friends(childId), requests: await this.friends.incoming(childId) };
  }

  async listBlocks(guardianId: string, childId: string): Promise<Result<{ blocked: BlockedRow[] }>> {
    if (!this.blocks || !(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    return { ok: true, blocked: await this.blocks.list(childId) };
  }

  /** Blocks a player for the child: any friendship between them is removed and they can no longer find, see or befriend each other. */
  async block(guardianId: string, childId: string, otherId: string): Promise<Result> {
    if (!this.blocks || !(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    if (otherId === childId || otherId === guardianId) return { ok: false, error: 'self' };
    await this.blocks.add(childId, otherId);
    await this.friends?.remove(childId, otherId);
    this.audit?.('guardian.block', childId, `${guardianId} ${otherId}`);
    return { ok: true };
  }

  async unblock(guardianId: string, childId: string, otherId: string): Promise<Result> {
    if (!this.blocks || !(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    if (!(await this.blocks.remove(childId, otherId))) return { ok: false, error: 'not_found' };
    this.audit?.('guardian.unblock', childId, `${guardianId} ${otherId}`);
    return { ok: true };
  }

  async approveFriend(guardianId: string, childId: string, otherId: string): Promise<Result> {
    if (!this.friends || !(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    return (await this.friends.approve(childId, otherId)) ? { ok: true } : { ok: false, error: 'not_found' };
  }

  async removeFriend(guardianId: string, childId: string, otherId: string): Promise<Result> {
    if (!this.friends || !(await this.store.isChildOf(guardianId, childId))) return { ok: false, error: 'not_found' };
    return (await this.friends.remove(childId, otherId)) ? { ok: true } : { ok: false, error: 'not_found' };
  }

  async remove(guardianId: string, childId: string): Promise<Result> {
    if (!(await this.store.unlink(guardianId, childId))) return { ok: false, error: 'not_found' };
    this.audit?.('guardian.remove_child', childId, guardianId);
    return { ok: true };
  }
}

const STATUS: Partial<Record<GuardianError, number>> = {
  not_a_child: 409,
  already_linked: 409,
  not_adult: 403,
  phone_required: 403,
  too_many_children: 409,
  not_found: 404,
  self: 409,
  sms_unavailable: 503,
  too_soon: 429,
  rate_limited: 429,
  send_failed: 502,
  invalid_phone: 400,
  no_code: 400,
  expired: 400,
  wrong: 400,
  too_many: 429,
};

export function registerGuardianRoutes(app: FastifyInstance, auth: AuthService, svc: GuardianService, now: () => number = Date.now) {
  /** The link code is 6 digits: 10 tries per 10 minutes per address keeps guessing hopeless. */
  const guesses = new RateLimiter(10, 10 * 60_000, now);
  type Reply = { code(n: number): { send(b: unknown): unknown } };
  const fail = (reply: Reply, out: { ok: false; error: GuardianError; retryAfterSec?: number }) =>
    reply.code(STATUS[out.error] ?? 400).send({ error: out.error, ...(out.retryAfterSec ? { retryAfterSec: out.retryAfterSec } : {}) });

  // Child side: a kid or teen asks a guardian to link by proving the guardian's phone number.
  app.get('/me/guardian', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return svc.mine(user.id);
  });
  app.post('/guardian/request', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = guardianRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await svc.requestCode(user.id, body.data.phone);
    return out.ok ? { ok: true } : fail(reply, out);
  });
  app.post('/guardian/confirm', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = guardianConfirmSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await svc.confirm(user.id, body.data.phone, body.data.code);
    return out.ok ? { ok: true } : fail(reply, out);
  });

  // Guardian side.
  app.get('/guardian/children', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return svc.children(user.id);
  });
  app.post('/guardian/children', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = childCreateSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await svc.addChild(user.id, body.data.track);
    return out.ok ? reply.code(201).send({ childId: out.childId }) : fail(reply, out);
  });
  app.post<{ Params: { id: string } }>('/guardian/children/:id/link-code', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.linkCode(user.id, req.params.id);
    return out.ok ? { code: out.code, expiresInSec: out.expiresInSec } : fail(reply, out);
  });
  app.post<{ Params: { id: string } }>('/guardian/children/:id/switch', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = childLinkRequestSchema.pick({ deviceId: true }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const session = await svc.switchTo(user.id, req.params.id, body.data.deviceId);
    return session ? session : reply.code(404).send({ error: 'not_found' });
  });
  app.put<{ Params: { id: string } }>('/guardian/children/:id/track', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = childTrackPutSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await svc.setTrack(user.id, req.params.id, body.data.track);
    return out.ok ? { ok: true } : fail(reply, out);
  });
  app.get<{ Params: { id: string } }>('/guardian/children/:id/settings', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.getSettings(user.id, req.params.id);
    return out.ok ? out.settings : fail(reply, out);
  });
  app.put<{ Params: { id: string } }>('/guardian/children/:id/settings', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const body = guardianSettingsSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    const out = await svc.putSettings(user.id, req.params.id, body.data);
    return out.ok ? out.settings : fail(reply, out);
  });
  app.get<{ Params: { id: string } }>('/guardian/children/:id/digest', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.digestOf(user.id, req.params.id);
    return out.ok ? out.digest : fail(reply, out);
  });
  app.get<{ Params: { id: string } }>('/guardian/children/:id/friends', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.friendsOf(user.id, req.params.id);
    return out.ok ? { friends: out.friends, requests: out.requests } : fail(reply, out);
  });
  app.get<{ Params: { id: string } }>('/guardian/children/:id/blocks', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.listBlocks(user.id, req.params.id);
    return out.ok ? { blocked: out.blocked } : fail(reply, out);
  });
  app.post<{ Params: { id: string; otherId: string } }>('/guardian/children/:id/blocks/:otherId', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.block(user.id, req.params.id, req.params.otherId);
    return out.ok ? { ok: true } : fail(reply, out);
  });
  app.delete<{ Params: { id: string; otherId: string } }>('/guardian/children/:id/blocks/:otherId', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.unblock(user.id, req.params.id, req.params.otherId);
    return out.ok ? { ok: true } : fail(reply, out);
  });
  app.post<{ Params: { id: string; otherId: string } }>('/guardian/children/:id/friends/:otherId/approve', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.approveFriend(user.id, req.params.id, req.params.otherId);
    return out.ok ? { ok: true } : fail(reply, out);
  });
  app.delete<{ Params: { id: string; otherId: string } }>('/guardian/children/:id/friends/:otherId', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.removeFriend(user.id, req.params.id, req.params.otherId);
    return out.ok ? { ok: true } : fail(reply, out);
  });
  app.delete<{ Params: { id: string } }>('/guardian/children/:id', async (req, reply) => {
    const user = await currentUser(auth, req);
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    const out = await svc.remove(user.id, req.params.id);
    return out.ok ? { ok: true } : fail(reply, out);
  });

  // The child's device, signed out: the code the guardian shows opens the child's account on it.
  app.post('/auth/child-link', async (req, reply) => {
    const body = childLinkRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid_request' });
    if (!guesses.take(req.ip)) return reply.code(429).send({ error: 'rate_limited' });
    const session = await svc.redeem(body.data.code, body.data.deviceId);
    return session ? session : reply.code(400).send({ error: 'invalid_code' });
  });
}
