import { generateHandle, normalizeInviteCode, normalizeIranPhone } from '@dozari/shared';
import type { FoundPlayer, MyFind, Rng } from '@dozari/shared';
import { RateLimiter } from '../security/rate-limit.js';
import type { Meetable, SocialBlocked } from '../agetrack/service.js';
import type { SocialStore } from '../social/store.js';
import type { FindStore } from './store.js';
import type { Shortener } from './shortener.js';

export interface FindSettings {
  inviteBase: string;
  shortenerUrl: string;
  autoFriendHours: number;
  autoFriendPerDay: number;
}

export type LinkFriendResult = 'friends' | 'sent' | 'already' | 'self' | 'unknown' | 'limit' | 'needs_guardian';

const DAY_MS = 86_400_000;
const looksLikeHandle = (s: string) => /^[2-9A-HJKMNP-Z]{4,12}$/.test(s);

/** Finding players (public ID, verified phone, contacts) and sharing an invite link that makes friends. All lookups are exact, never prefix. */
export class FindService {
  // Enumeration is the abuse: 20 searches a minute and 6 contact uploads an hour per player.
  private readonly searches = new RateLimiter(20, 60_000);
  private readonly uploads = new RateLimiter(6, 60 * 60_000);
  private readonly linkFriends = new RateLimiter(500, DAY_MS);

  constructor(
    private readonly find: FindStore,
    private readonly social: Pick<SocialStore, 'pair' | 'publicRow' | 'createRequest' | 'accept'>,
    private readonly settings: () => Promise<FindSettings>,
    private readonly shortener: Shortener,
    private readonly rng: Rng,
    private readonly now: () => number = Date.now,
    /** Age-track gate: only players on `me`'s own track are found or befriended (docs/logic/age-tracks.md). Absent = no rule. */
    private readonly sameTrack?: Meetable,
    /** Kid/teen without a linked guardian cannot make friends through a link yet. */
    private readonly blocked?: SocialBlocked,
  ) {}

  /** The player's public ID, made on first use. */
  async handle(userId: string): Promise<string> {
    const have = await this.find.handleOf(userId);
    if (have) return have;
    for (let i = 0; i < 10; i++) {
      const candidate = generateHandle(this.rng);
      if (await this.find.assignHandle(userId, candidate)) return candidate;
      const raced = await this.find.handleOf(userId);
      if (raced) return raced;
    }
    throw new Error('could not assign a handle');
  }

  async me(userId: string): Promise<MyFind> {
    const [handle, findableByPhone, s] = await Promise.all([this.handle(userId), this.find.findable(userId), this.settings()]);
    const inviteUrl = `${s.inviteBase}${handle}`;
    return { handle, findableByPhone, inviteUrl, shareUrl: await this.shortener.shorten(inviteUrl, s.shortenerUrl) };
  }

  setFindable(userId: string, value: boolean): Promise<void> {
    return this.find.setFindable(userId, value);
  }

  private async card(me: string, id: string): Promise<FoundPlayer | null> {
    if (id === me || (this.sameTrack && !(await this.sameTrack(me, [id])).has(id))) return null;
    const row = await this.social.publicRow(id);
    if (!row) return null;
    const p = await this.social.pair(me, id);
    const relation = !p ? 'none' : p.status === 'accepted' ? 'friends' : p.requestedBy === me ? 'sent' : 'received';
    return { id, nickname: row.nickname, avatarKey: row.avatarKey, relation };
  }

  /** One exact match by public ID or verified phone; `rate_limited` after 20 a minute. */
  async search(me: string, raw: string): Promise<{ player: FoundPlayer | null } | 'rate_limited'> {
    if (!this.searches.take(me)) return 'rate_limited';
    const phone = normalizeIranPhone(raw);
    if (phone) {
      const [id] = await this.find.byPhones([phone]);
      return { player: id ? await this.card(me, id) : null };
    }
    const handle = normalizeInviteCode(raw);
    if (!looksLikeHandle(handle)) return { player: null };
    const id = await this.find.byHandle(handle);
    return { player: id ? await this.card(me, id) : null };
  }

  /** Phone numbers from the player's address book: the players among them who verified that number and allow being found. */
  async contacts(me: string, phones: readonly string[]): Promise<{ players: FoundPlayer[] } | 'rate_limited'> {
    if (!this.uploads.take(me)) return 'rate_limited';
    const normalised = [...new Set(phones.map((p) => normalizeIranPhone(p)).filter((p): p is string => p !== null))].slice(0, 500);
    const ids = [...new Set(await this.find.byPhones(normalised))];
    const out: FoundPlayer[] = [];
    for (const id of ids) {
      const c = await this.card(me, id);
      if (c) out.push(c);
    }
    return { players: out };
  }

  /**
   * Somebody opened this player's invite link. A brand-new account (younger than `friend.link_auto_hours`) becomes a friend at once — the
   * link owner invited them; anyone else just sends a normal request. The link owner can gain only `friend.link_auto_per_day` such friends a day.
   */
  async friendByLink(me: string, rawHandle: string): Promise<LinkFriendResult> {
    const handle = normalizeInviteCode(rawHandle);
    if (!looksLikeHandle(handle)) return 'unknown';
    if (await this.blocked?.(me)) return 'needs_guardian';
    const owner = await this.find.byHandle(handle);
    if (!owner) return 'unknown';
    if (owner === me) return 'self';
    if (this.sameTrack && !(await this.sameTrack(me, [owner])).has(owner)) return 'unknown';
    const [mine, s, pair] = await Promise.all([this.social.publicRow(me), this.settings(), this.social.pair(me, owner)]);
    if (!mine) return 'unknown';
    if (pair?.status === 'accepted') return 'already';
    const fresh = this.now() - mine.createdAt < s.autoFriendHours * 3_600_000;
    if (fresh && s.autoFriendPerDay > 0) {
      if (!this.autoCap(owner, s.autoFriendPerDay)) return 'limit';
      if (pair?.status === 'pending' && pair.requestedBy === owner) {
        await this.social.accept(me, owner, this.now());
        return 'friends';
      }
      if (!pair && (await this.social.createRequest(me, owner))) {
        await this.social.accept(owner, me, this.now());
        return 'friends';
      }
      return 'sent';
    }
    if (pair) return 'sent';
    return (await this.social.createRequest(me, owner)) ? 'sent' : 'already';
  }

  private readonly autoCount = new Map<string, { day: number; n: number }>();
  private autoCap(owner: string, perDay: number): boolean {
    const day = Math.floor(this.now() / DAY_MS);
    const cur = this.autoCount.get(owner);
    const n = cur && cur.day === day ? cur.n : 0;
    if (n >= perDay) return false;
    this.autoCount.set(owner, { day, n: n + 1 });
    return true;
  }
}
