import type { FriendRelation, Friends, Gender, MyProfile, PlayerProfile } from '@dozari/shared';
import type { PlayerService } from '../player/service.js';
import type { BadgeService } from '../badges/service.js';
import type { SocialStore } from './store.js';

export type RequestResult = 'ok' | 'self' | 'unknown_player' | 'already' | 'accepted';

/** Public profiles, friend requests and the private gender setting. */
export class SocialService {
  constructor(
    private readonly store: SocialStore,
    private readonly now: () => number = Date.now,
    /** Called after a new friend request (e.g. to tell the target on Bale); must not throw into the request flow. */
    private readonly onRequest?: (targetId: string, fromNickname: string) => void,
    /** Level, stats, city, e-mail and nickname; without it everyone is level 1 with no games. */
    readonly player?: PlayerService,
    /** Badges, medals and the skill tier shown on a profile. */
    readonly badges?: BadgeService,
  ) {}

  private async relation(me: string, other: string): Promise<FriendRelation> {
    const p = await this.store.pair(me, other);
    if (!p) return 'none';
    if (p.status === 'accepted') return 'friends';
    return p.requestedBy === me ? 'sent' : 'received';
  }

  /** What anybody may see of a player. */
  async profile(me: string, id: string): Promise<PlayerProfile | null> {
    const row = await this.store.publicRow(id);
    if (!row) return null;
    const lv = (await this.player?.levelOf(id)) ?? { level: { level: 1 }, stats: { games: 0, wins: 0, losses: 0, draws: 0 } };
    const city = (await this.player?.cityOf(id)) ?? null;
    return { id, nickname: row.nickname, avatarKey: row.avatarKey, level: lv.level.level, coins: row.coins, stats: lv.stats, cityName: city?.nameFa ?? null, badges: (await this.badges?.publicOf(id)) ?? { badge: null, medals: [], skill: 'novice' as const }, memberSince: row.createdAt, relation: me === id ? 'none' : await this.relation(me, id), isMe: me === id };
  }

  async request(me: string, target: string): Promise<RequestResult> {
    if (me === target) return 'self';
    const [mine, theirs] = await Promise.all([this.store.publicRow(me), this.store.publicRow(target)]);
    if (!theirs || !mine) return 'unknown_player';
    const p = await this.store.pair(me, target);
    if (p?.status === 'accepted') return 'already';
    if (p?.status === 'pending') {
      if (p.requestedBy === me) return 'already';
      // They already asked us: asking back means yes.
      await this.store.accept(me, target, this.now());
      return 'accepted';
    }
    if (!(await this.store.createRequest(me, target))) return 'already';
    try {
      this.onRequest?.(target, mine.nickname);
    } catch {
      /* notification problems never fail the request */
    }
    return 'ok';
  }

  async accept(me: string, other: string): Promise<boolean> {
    return this.store.accept(me, other, this.now());
  }

  /** Cancels a request, declines one, or unfriends. */
  remove(me: string, other: string): Promise<boolean> {
    return this.store.remove(me, other);
  }

  async friends(me: string): Promise<Friends> {
    const [friends, incoming] = await Promise.all([this.store.friends(me), this.store.incoming(me)]);
    return { friends, incoming };
  }

  async mine(me: string): Promise<MyProfile | null> {
    const row = await this.store.publicRow(me);
    if (!row) return null;
    const rec = (await this.player?.mine(me)) ?? {
      level: { level: 1, xp: 0, xpInLevel: 0, xpForNext: 50 },
      stats: { games: 0, wins: 0, losses: 0, draws: 0 },
      city: null,
      email: null,
      nicknameRules: { minLen: 2, maxLen: 20, allowDigits: false, allowLatin: false, allowPersian: true },
      nicknameLockedUntilGames: null,
    };
    return { id: me, nickname: row.nickname, avatarKey: row.avatarKey, gender: await this.store.getGender(me), ...rec };
  }

  setGender(me: string, gender: Gender | null): Promise<void> {
    return this.store.setGender(me, gender);
  }
}
