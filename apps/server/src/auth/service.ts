import type { GuestIdentity, Rng, Session } from '@dozari/shared';
import { randomGuestIdentity } from '@dozari/shared';
import type { TokenSigner } from './tokens.js';

export interface UserRecord {
  id: string;
  nickname: string;
  avatarKey: string;
  isBanned: boolean;
  /** Epoch ms; tokens issued before it are refused (log out everywhere). */
  sessionsValidAfter?: number | null;
}

/** I/O boundary of auth: where users live. */
export interface UserRepository {
  findByDeviceId(deviceId: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /** Creates the user, or returns the existing one when another request created it first (same device id). */
  createGuest(deviceId: string, identity: GuestIdentity): Promise<UserRecord>;
  touch(id: string): Promise<void>;
  /** Turns the account into an empty, banned shell (personal data removed; ledger and history stay) and signs it out everywhere. */
  anonymize?(id: string): Promise<void>;
  /** Refuses every token issued before now. */
  signOutEverywhere?(id: string): Promise<void>;
  /** Makes this device id log in to this account from now on (it is taken from any other account that had it). */
  claimDevice?(id: string, deviceId: string): Promise<void>;
}

export type LoginResult = { ok: true; session: Session } | { ok: false; error: 'BANNED' };

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenSigner,
    private readonly rng: Rng = Math.random,
  ) {}

  /** Device id in, session out: the account is created on first sight, so there is no sign-up step. */
  async guestLogin(deviceId: string): Promise<LoginResult> {
    const user = (await this.users.findByDeviceId(deviceId)) ?? (await this.users.createGuest(deviceId, randomGuestIdentity(this.rng)));
    if (user.isBanned) return { ok: false, error: 'BANNED' };
    await this.users.touch(user.id);
    return { ok: true, session: { token: await this.tokens.sign(user.id), user: { id: user.id, nickname: user.nickname, avatarKey: user.avatarKey } } };
  }

  /** A session for an existing account, for the moment the player proved they own it (phone proof, see `PhoneService.resolve`). */
  async sessionFor(userId: string, deviceId?: string): Promise<Session | null> {
    const user = await this.users.findById(userId);
    if (!user || user.isBanned) return null;
    // The device now belongs to this account, so a token that expires later logs in to it, not to the guest it had before.
    if (deviceId) await this.users.claimDevice?.(user.id, deviceId);
    await this.users.touch(user.id);
    return { token: await this.tokens.sign(user.id), user: { id: user.id, nickname: user.nickname, avatarKey: user.avatarKey } };
  }

  async deleteAccount(userId: string): Promise<boolean> {
    if (!this.users.anonymize) return false;
    await this.users.anonymize(userId);
    return true;
  }

  async signOutEverywhere(userId: string): Promise<boolean> {
    if (!this.users.signOutEverywhere) return false;
    await this.users.signOutEverywhere(userId);
    return true;
  }

  /** The user behind a bearer token, or null for a bad/expired token, an unknown user or a banned one. */
  async authenticate(token: string): Promise<UserRecord | null> {
    const t = await this.tokens.verify(token);
    if (!t) return null;
    const user = await this.users.findById(t.userId);
    if (!user || user.isBanned) return null;
    // A token counts as issued at the end of its second, so a fresh login right after a logout is not refused.
    if (user.sessionsValidAfter && (t.issuedAt + 1) * 1000 <= user.sessionsValidAfter) return null;
    return user;
  }
}
