import { LEADERBOARD_SIZE, PERIOD_DAYS } from '@dozari/shared';
import type { FriendRelation, Friends, Gender, Leaderboard, LeaderboardPeriod, LeaderboardScope, MyProfile, PlayerProfile } from '@dozari/shared';
import type { PlayerService } from '../player/service.js';
import type { BadgeService } from '../badges/service.js';
import type { Meetable, SocialBlocked } from '../agetrack/service.js';
import type { SocialStore } from './store.js';

export type RequestResult = 'ok' | 'self' | 'unknown_player' | 'already' | 'accepted' | 'needs_guardian' | 'ask_guardian';

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
    /** Whether a player has a live socket (see `realtime/presence.ts`); without it nobody shows as online. */
    private readonly isOnline: (userId: string) => boolean = () => false,
    /** Birthday-week flag and the age of those who show it (never the date); without it nobody has a party badge. */
    private readonly birthdayInfo: (ids: string[]) => Promise<Map<string, { badge: boolean; age: number | null }>> = async () => new Map(),
  ) {}

  private async relation(me: string, other: string): Promise<FriendRelation> {
    const p = await this.store.pair(me, other);
    if (!p) return 'none';
    if (p.status === 'accepted') return 'friends';
    return p.requestedBy === me ? 'sent' : 'received';
  }

  /** Age-track gate (docs/logic/age-tracks.md §Friends): who `me` may see, befriend and rank against. Absent = no track rule. */
  sameTrack?: Meetable;
  /** Kid/teen without a linked guardian: no friend requests or accepts yet. */
  blocked?: SocialBlocked;
  /** Kid/teen whose guardian wants to approve friends first: they neither send nor accept requests; the guardian accepts for them. */
  asksGuardian?: SocialBlocked;

  private async meets(me: string, other: string): Promise<boolean> {
    return !this.sameTrack || (await this.sameTrack(me, [other])).has(other);
  }

  /** What a player wears now (set at start-up when the shop exists); shown on their public profile. */
  wornOf?: (userId: string) => Promise<{ slot: string; iconKey: string | null }[]>;

  /** What anybody may see of a player. */
  async profile(me: string, id: string): Promise<PlayerProfile | null> {
    const row = await this.store.publicRow(id);
    if (!row || (me !== id && !(await this.meets(me, id)))) return null;
    const lv = (await this.player?.levelOf(id)) ?? { level: { level: 1 }, stats: { games: 0, wins: 0, losses: 0, draws: 0 } };
    const city = (await this.player?.cityOf(id)) ?? null;
    const party = (await this.birthdayInfo([id])).get(id);
    return { id, nickname: row.nickname, avatarKey: row.avatarKey, level: lv.level.level, coins: row.coins, stats: lv.stats, cityName: city?.nameFa ?? null, cityProvince: city?.province ?? null, badges: (await this.badges?.publicOf(id)) ?? { badge: null, medals: [], skill: 'novice' as const }, memberSince: row.createdAt, relation: me === id ? 'none' : await this.relation(me, id), isMe: me === id, online: this.isOnline(id), birthday: party?.badge ?? false, age: party?.age ?? null, worn: ((await this.wornOf?.(id)) ?? []).map(({ slot, iconKey }) => ({ slot, iconKey })) };
  }

  async request(me: string, target: string): Promise<RequestResult> {
    if (me === target) return 'self';
    if (await this.blocked?.(me)) return 'needs_guardian';
    if (await this.asksGuardian?.(me)) return 'ask_guardian';
    const [mine, theirs] = await Promise.all([this.store.publicRow(me), this.store.publicRow(target)]);
    if (!theirs || !mine || !(await this.meets(me, target))) return 'unknown_player';
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

  async accept(me: string, other: string): Promise<boolean | 'needs_guardian' | 'ask_guardian'> {
    if (await this.blocked?.(me)) return 'needs_guardian';
    if (await this.asksGuardian?.(me)) return 'ask_guardian';
    if (!(await this.meets(me, other))) return false;
    return this.store.accept(me, other, this.now());
  }

  /** The guardian's yes: accepts a pending request for the child (the request must come from the other side, and the other must be on the child's track). */
  async approveFor(child: string, other: string): Promise<boolean> {
    if (!(await this.meets(child, other))) return false;
    return this.store.accept(child, other, this.now());
  }

  /** Cancels a request, declines one, or unfriends. */
  remove(me: string, other: string): Promise<boolean> {
    return this.store.remove(me, other);
  }

  async friends(me: string): Promise<Friends> {
    const [allFriends, allIncoming] = await Promise.all([this.store.friends(me), this.store.incoming(me)]);
    // A friendship that crossed tracks (one side moved) stays stored but is not shown or used.
    const ok = this.sameTrack ? await this.sameTrack(me, [...allFriends, ...allIncoming].map((f) => f.id)) : null;
    const friends = ok ? allFriends.filter((f) => ok.has(f.id)) : allFriends;
    const incoming = ok ? allIncoming.filter((f) => ok.has(f.id)) : allIncoming;
    const party = await this.birthdayInfo(friends.map((f) => f.id));
    return { friends: friends.map((f) => ({ ...f, online: this.isOnline(f.id), birthday: party.get(f.id)?.badge ?? false })), incoming };
  }

  /** Top of a scope by total XP plus the caller's own place (D108). A scope that does not apply (no city) is empty. */
  async leaderboard(me: string, scope: LeaderboardScope, period: LeaderboardPeriod = 'all'): Promise<Leaderboard> {
    const player = this.player;
    if (!player) return { scope, period, entries: [], me: null, hasCity: true };
    const days = PERIOD_DAYS[period];
    const since = days === null ? undefined : this.now() - days * 86_400_000;
    let filter: { cityId?: string; userIds?: string[] } = {};
    if (scope === 'city') {
      const city = await player.cityOf(me);
      if (!city) return { scope, period, entries: [], me: null, hasCity: false };
      filter = { cityId: city.id };
    } else if (scope === 'friends') {
      filter = { userIds: [me, ...(await this.store.friends(me)).map((f) => f.id)] };
    }
    let rows = await player.ranking(filter, LEADERBOARD_SIZE, since);
    if (this.sameTrack) {
      // Other tracks never appear on a board. The list is cut after ranking, so a kid/teen board can be shorter than the usual size.
      const ok = await this.sameTrack(me, rows.map((r) => r.userId).filter((id) => id !== me));
      rows = rows.filter((r) => r.userId === me || ok.has(r.userId));
    }
    const entries = [];
    for (const [i, r] of rows.entries()) {
      const [who, lv, city] = await Promise.all([this.store.publicRow(r.userId), player.levelOf(r.userId), player.cityOf(r.userId)]);
      if (!who) continue;
      entries.push({ rank: i + 1, id: r.userId, nickname: who.nickname, avatarKey: who.avatarKey, level: lv.level.level, xp: r.xp, province: city?.province ?? null, isMe: r.userId === me });
    }
    const mine = await player.levelOf(me);
    return { scope, period, entries, me: { rank: this.sameTrack ? (entries.find((e) => e.isMe)?.rank ?? (await player.rankOf(me, filter, since))) : await player.rankOf(me, filter, since), xp: since === undefined ? mine.level.xp : await player.xpSince(me, since), level: mine.level.level }, hasCity: true };
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
