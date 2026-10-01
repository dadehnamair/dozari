import type { GuestIdentity, Rng, Session } from '@dozari/shared';
import { randomGuestIdentity } from '@dozari/shared';
import type { TokenSigner } from './tokens.js';

export interface UserRecord {
  id: string;
  nickname: string;
  avatarKey: string;
  isBanned: boolean;
}

/** I/O boundary of auth: where users live. */
export interface UserRepository {
  findByDeviceId(deviceId: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  /** Creates the user, or returns the existing one when another request created it first (same device id). */
  createGuest(deviceId: string, identity: GuestIdentity): Promise<UserRecord>;
  touch(id: string): Promise<void>;
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

  /** The user behind a bearer token, or null for a bad/expired token, an unknown user or a banned one. */
  async authenticate(token: string): Promise<UserRecord | null> {
    const id = await this.tokens.verify(token);
    if (!id) return null;
    const user = await this.users.findById(id);
    return user && !user.isBanned ? user : null;
  }
}
