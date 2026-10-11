import { TOURNAMENT_MAX_ENTRY_COINS, TOURNAMENT_MAX_ENTRY_GEMS, TOURNAMENT_MAX_GRACE_MINUTES, TOURNAMENT_MAX_PRIZE_GEMS, TOURNAMENT_MAX_PRIZE_COINS, TOURNAMENT_MAX_ROUND_GAP_MINUTES, TOURNAMENT_MIN_GRACE_MINUTES, TOURNAMENT_SIZES, buildBracket, finalPlaces, forfeitOutcome, matchDeadline, nextSlot, roundCount, roundOpensAt, turnState } from '@dozari/shared';
import type { Sponsor, TournamentDetail, TournamentError, TournamentListItem, TournamentTurn } from '@dozari/shared';
import type { MatchRow, NewTournament, PrizeRow, TournamentRow, TournamentStore } from './store.js';

export interface TournamentDeps {
  levelOf(userId: string): Promise<number>;
  profileOf(userId: string): Promise<{ nickname: string; avatarKey: string } | null>;
  /** Starts the live duel between two players; false when one of them is busy right now. */
  startMatch(a: string, b: string): Promise<boolean>;
  inMatch(userId: string): boolean;
  /** Idle bot accounts to fill empty seats (admin bot players); omit to never fill. */
  fillBots?(n: number): string[];
  /** Bots take part but are never paid prize coins. */
  isBot?(userId: string): boolean;
  /** Looks a sponsor up (admin-defined); omit and tournaments carry no sponsor. */
  sponsorOf?(id: string): Promise<(Sponsor & { isActive: boolean }) | null>;
  /** Tell a player something (Bale); must not throw into the flow. */
  notify?(userId: string, text: string): void;
  now?: () => number;
}

export interface TournamentInput {
  titleFa: string;
  descriptionFa: string;
  iconKey: string | null;
  size: number;
  minPlayers: number;
  entryCoins: number;
  /** Gems charged on top of the coins; may be left out = 0. */
  entryGems?: number;
  minLevel: number;
  startsAt: number;
  botFill?: boolean;
  allowConcurrent?: boolean;
  /** Minutes between rounds (0 or left out = the old back-to-back rounds) and the check-in grace once a match opens (default 15). */
  roundGapMinutes?: number;
  graceMinutes?: number;
  /** The sponsor of the tournament (must exist and be active); null / left out = none. */
  sponsorId?: string | null;
  /** `spins` (lucky-wheel spins) may be left out = 0. */
  prizes: { place: number; coins: number; gems?: number; spins?: number }[];
}

/** `reason` (INVALID only) names the exact field the admin form got wrong, so the panel can say what to fix. */
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: TournamentError | 'INVALID'; reason?: string };

/** Single-elimination tournaments: entry (coins + level), bracket, advancing from live duel results, prizes. D60. */
export class TournamentService {
  constructor(
    private readonly store: TournamentStore,
    private readonly deps: TournamentDeps,
  ) {}

  private now(): number {
    return (this.deps.now ?? Date.now)();
  }

  // ---- admin -------------------------------------------------------------------------------------------------------

  /** The first problem with the input as a reason code, or null when it is fine. */
  private validate(i: TournamentInput): string | null {
    if (!(TOURNAMENT_SIZES as readonly number[]).includes(i.size)) return 'bad_size';
    if (i.minPlayers < 2 || i.minPlayers > i.size) return 'bad_min_players';
    if (i.entryCoins < 0 || i.entryCoins > TOURNAMENT_MAX_ENTRY_COINS) return 'bad_entry_coins';
    if ((i.entryGems ?? 0) < 0 || (i.entryGems ?? 0) > TOURNAMENT_MAX_ENTRY_GEMS) return 'bad_entry_gems';
    if (i.minLevel < 1) return 'bad_min_level';
    if ((i.roundGapMinutes ?? 0) !== 0 && ((i.roundGapMinutes ?? 0) < 60 || (i.roundGapMinutes ?? 0) > TOURNAMENT_MAX_ROUND_GAP_MINUTES)) return 'bad_round_gap';
    if ((i.graceMinutes ?? 15) < TOURNAMENT_MIN_GRACE_MINUTES || (i.graceMinutes ?? 15) > TOURNAMENT_MAX_GRACE_MINUTES) return 'bad_grace';
    if (i.titleFa.trim().length < 2) return 'bad_title';
    if (!i.prizes.every((p) => [1, 2, 3].includes(p.place) && p.coins >= 0 && p.coins <= TOURNAMENT_MAX_PRIZE_COINS && (p.spins ?? 0) >= 0 && (p.spins ?? 0) <= 20 && (p.gems ?? 0) >= 0 && (p.gems ?? 0) <= TOURNAMENT_MAX_PRIZE_GEMS)) return 'bad_prize';
    if (new Set(i.prizes.map((p) => p.place)).size !== i.prizes.length) return 'dup_prize';
    return null;
  }

  async create(input: TournamentInput, publish: boolean): Promise<Result<{ id: string }>> {
    const bad = this.validate(input);
    if (bad) return { ok: false, error: 'INVALID', reason: bad };
    // A start time in the past is allowed on purpose (back-dated tournaments): once open, the next tick starts it at once.
    if (!(await this.sponsorOk(input.sponsorId))) return { ok: false, error: 'INVALID', reason: 'bad_sponsor' };
    const t: NewTournament = { titleFa: input.titleFa.trim(), descriptionFa: input.descriptionFa.trim(), iconKey: input.iconKey, status: publish ? 'open' : 'draft', size: input.size, minPlayers: input.minPlayers, entryCoins: input.entryCoins, entryGems: input.entryGems ?? 0, minLevel: input.minLevel, botFill: input.botFill ?? false, allowConcurrent: input.allowConcurrent ?? false, sponsorId: input.sponsorId ?? null, roundGapMinutes: input.roundGapMinutes ?? 0, graceMinutes: input.graceMinutes ?? 15, startsAt: input.startsAt };
    const row = await this.store.create(t, input.prizes.map((p) => ({ ...p, gems: p.gems ?? 0, spins: p.spins ?? 0 })));
    return { ok: true, id: row.id };
  }

  /** Edit a draft freely; an open one only until the first player joins (a title, description or prizes can always change). */
  async update(id: string, input: Partial<TournamentInput>): Promise<Result> {
    const t = await this.store.get(id);
    if (!t) return { ok: false, error: 'NOT_FOUND' };
    if (t.status !== 'draft' && t.status !== 'open') return { ok: false, error: 'BAD_STATE' };
    const entered = (await this.store.entries(id)).length > 0;
    const structural = ['size', 'minPlayers', 'entryCoins', 'entryGems', 'minLevel'] as const;
    if (entered && structural.some((k) => input[k] !== undefined && input[k] !== t[k])) return { ok: false, error: 'BAD_STATE' };
    const merged: TournamentInput = { titleFa: t.titleFa, descriptionFa: t.descriptionFa, iconKey: t.iconKey, size: t.size, minPlayers: t.minPlayers, entryCoins: t.entryCoins, entryGems: t.entryGems, minLevel: t.minLevel, botFill: t.botFill, allowConcurrent: t.allowConcurrent, sponsorId: t.sponsorId, roundGapMinutes: t.roundGapMinutes, graceMinutes: t.graceMinutes, startsAt: t.startsAt, prizes: input.prizes ?? (await this.store.prizes(id)), ...input };
    const bad = this.validate(merged);
    if (bad) return { ok: false, error: 'INVALID', reason: bad };
    // An unchanged sponsor stays even if it was switched off since; only a newly chosen one has to be active.
    if (input.sponsorId !== undefined && input.sponsorId !== t.sponsorId && !(await this.sponsorOk(input.sponsorId))) return { ok: false, error: 'INVALID', reason: 'bad_sponsor' };
    await this.store.update(id, { titleFa: merged.titleFa.trim(), descriptionFa: merged.descriptionFa.trim(), iconKey: merged.iconKey, size: merged.size, minPlayers: merged.minPlayers, entryCoins: merged.entryCoins, entryGems: merged.entryGems ?? 0, minLevel: merged.minLevel, botFill: merged.botFill ?? false, allowConcurrent: merged.allowConcurrent ?? false, sponsorId: merged.sponsorId ?? null, roundGapMinutes: merged.roundGapMinutes ?? 0, graceMinutes: merged.graceMinutes ?? 15, startsAt: merged.startsAt });
    if (input.prizes) await this.store.setPrizes(id, input.prizes.map((p) => ({ ...p, gems: p.gems ?? 0, spins: p.spins ?? 0 })));
    return { ok: true };
  }

  private async sponsorOk(id: string | null | undefined): Promise<boolean> {
    if (!id) return true;
    const s = await this.deps.sponsorOf?.(id);
    return !!s && s.isActive;
  }

  /** The sponsor of a tournament in full (what its page shows); a sponsor switched off later is hidden. */
  private async sponsorFor(id: string | null): Promise<Sponsor | null> {
    if (!id || !this.deps.sponsorOf) return null;
    const s = await this.deps.sponsorOf(id);
    if (!s || !s.isActive) return null;
    return { id: s.id, nameFa: s.nameFa, taglineFa: s.taglineFa, descriptionFa: s.descriptionFa, bannerUrl: s.bannerUrl, logoUrl: s.logoUrl, linkUrl: s.linkUrl, accent: s.accent };
  }

  async publish(id: string): Promise<Result> {
    const t = await this.store.get(id);
    if (!t) return { ok: false, error: 'NOT_FOUND' };
    if (t.status !== 'draft') return { ok: false, error: 'BAD_STATE', reason: 'not_draft' };
    await this.store.update(id, { status: 'open' });
    return { ok: true };
  }

  /** Registration closes now; the next tick starts the tournament (or cancels it when too few joined). */
  async startNow(id: string): Promise<Result> {
    const t = await this.store.get(id);
    if (!t) return { ok: false, error: 'NOT_FOUND' };
    if (t.status !== 'open') return { ok: false, error: 'BAD_STATE' };
    await this.store.update(id, { startsAt: this.now() });
    await this.tick();
    return { ok: true };
  }

  async cancel(id: string): Promise<Result<{ refunded: number }>> {
    const t = await this.store.get(id);
    if (!t) return { ok: false, error: 'NOT_FOUND' };
    if (t.status === 'finished' || t.status === 'cancelled') return { ok: false, error: 'BAD_STATE' };
    const entries = await this.store.entries(id);
    const refunded = await this.store.cancel(id);
    for (const e of entries) this.deps.notify?.(e.userId, `تورنومنت «${t.titleFa}» لغو شد و ورودی‌ات برگشت.`);
    return { ok: true, refunded };
  }

  async adminList(): Promise<(TournamentRow & { joined: number; prizes: PrizeRow[] })[]> {
    const rows = await this.store.list(['draft', 'open', 'running', 'finished', 'cancelled'], 100);
    return Promise.all(rows.map(async (t) => ({ ...t, joined: (await this.store.entries(t.id)).length, prizes: await this.store.prizes(t.id) })));
  }

  // ---- players -----------------------------------------------------------------------------------------------------

  async list(userId: string): Promise<TournamentListItem[]> {
    // Past, cancelled and full ones stay listed too (the app labels their status and they are view only), so the list is never bare.
    const rows = await this.store.list(['open', 'running', 'finished', 'cancelled'], 40);
    const mine = await this.store.entriesOf(userId, rows.map((r) => r.id));
    return Promise.all(rows.map(async (t) => {
      const sp = await this.sponsorFor(t.sponsorId);
      return { id: t.id, titleFa: t.titleFa, status: t.status, size: t.size, entryCoins: t.entryCoins, entryGems: t.entryGems, minLevel: t.minLevel, startsAt: t.startsAt, joined: (await this.store.entries(t.id)).length, iconKey: t.iconKey, entered: mine.has(t.id), sponsor: sp ? { id: sp.id, nameFa: sp.nameFa, logoUrl: sp.logoUrl } : null };
    }));
  }

  async detail(userId: string, id: string): Promise<TournamentDetail | null> {
    const t = await this.store.get(id);
    if (!t || t.status === 'draft') return null;
    const [entries, prizes, matches, level, balance, gems] = await Promise.all([this.store.entries(id), this.store.prizes(id), this.store.matches(id), this.deps.levelOf(userId), this.store.balance(userId), this.store.gemBalance(userId)]);
    const names = new Map<string, { nickname: string; avatarKey: string }>();
    const who = async (uid: string | null) => {
      if (!uid) return null;
      if (!names.has(uid)) names.set(uid, (await this.deps.profileOf(uid)) ?? { nickname: '؟', avatarKey: 'avatar-01' });
      return { id: uid, ...names.get(uid)! };
    };
    const players = [];
    for (const e of entries) players.push((await who(e.userId))!);
    const bracket = [];
    for (const m of matches) {
      const a = await who(m.a);
      const b = await who(m.b);
      bracket.push({ round: m.round, slot: m.slot, a: a ? { id: a.id, nickname: a.nickname } : null, b: b ? { id: b.id, nickname: b.nickname } : null, winnerId: m.winner, status: m.status, opensAt: m.opensAt });
    }
    const entered = entries.some((e) => e.userId === userId);
    const busy = !entered && !t.allowConcurrent && t.status === 'open' && (await this.store.busyElsewhere(userId, id));
    const blocked = entered ? null : t.status !== 'open' ? 'CLOSED' : entries.length >= t.size ? 'FULL' : level < t.minLevel ? 'LEVEL' : busy ? 'BUSY' : balance < t.entryCoins ? 'COINS' : gems < t.entryGems ? 'GEMS' : null;
    const prizeOf = new Map(prizes.map((p) => [p.place, p.coins]));
    const results = t.status === 'finished' ? finalPlaces(matches, t.size) : [];
    const resultRows = [];
    for (const r of results) {
      const w = (await who(r.userId))!;
      resultRows.push({ id: r.userId, nickname: w.nickname, place: r.place as 1 | 2 | 3, coins: prizeOf.get(r.place) ?? 0 });
    }
    return { id: t.id, titleFa: t.titleFa, status: t.status, size: t.size, entryCoins: t.entryCoins, entryGems: t.entryGems, minLevel: t.minLevel, startsAt: t.startsAt, joined: entries.length, iconKey: t.iconKey, entered, descriptionFa: t.descriptionFa, sponsor: await this.sponsorFor(t.sponsorId), prizes, players, bracket, rounds: roundCount(t.size), roundGapMinutes: t.roundGapMinutes, graceMinutes: t.graceMinutes, roundTimes: t.roundGapMinutes > 0 ? Array.from({ length: roundCount(t.size) }, (_, i) => roundOpensAt(t.startsAt, t.roundGapMinutes, i + 1)) : [], blocked, results: resultRows.sort((x, y) => x.place - y.place) };
  }

  async join(userId: string, id: string): Promise<Result<{ balance: number }>> {
    const t = await this.store.get(id);
    if (!t || t.status === 'draft') return { ok: false, error: 'NOT_FOUND' };
    if (t.status !== 'open') return { ok: false, error: 'CLOSED' };
    if ((await this.deps.levelOf(userId)) < t.minLevel) return { ok: false, error: 'LEVEL' };
    if (!t.allowConcurrent && (await this.store.busyElsewhere(userId, id))) return { ok: false, error: 'BUSY' };
    const out = await this.store.join(id, userId, t.entryCoins, t.entryGems, this.now());
    if (out === 'ok') return { ok: true, balance: await this.store.balance(userId) };
    return { ok: false, error: out === 'full' ? 'FULL' : out === 'already' ? 'ALREADY_IN' : out === 'insufficient' ? ((await this.store.balance(userId)) < t.entryCoins ? 'COINS' : 'GEMS') : 'CLOSED' };
  }

  async leave(userId: string, id: string): Promise<Result<{ balance: number }>> {
    const out = await this.store.leave(id, userId);
    if (out === 'ok') return { ok: true, balance: await this.store.balance(userId) };
    return { ok: false, error: out === 'not_in' ? 'NOT_IN' : 'CLOSED' };
  }

  // ---- running ----------------------------------------------------------------------------------------------------

  /** Called every few seconds: starts due tournaments, resolves byes, starts ready matches, recovers matches lost in a restart. */
  async tick(): Promise<void> {
    const now = this.now();
    for (const t of await this.store.list(['open'], 100)) if (t.startsAt <= now) await this.begin(t);
    for (const t of await this.store.list(['running'], 100)) {
      await this.resolve(t);
      for (const m of await this.store.matches(t.id)) {
        if (m.status === 'playing' && m.a && m.b && !this.deps.inMatch(m.a) && !this.deps.inMatch(m.b)) await this.store.updateMatch(m.id, { status: 'ready' }); // the live match was lost (restart)
      }
      for (const m of await this.store.matches(t.id)) {
        if (m.status !== 'ready' || !m.a || !m.b) continue;
        if (t.roundGapMinutes > 0) await this.runScheduled(t, m);
        else if (await this.deps.startMatch(m.a, m.b)) {
          await this.store.updateMatch(m.id, { status: 'playing' });
          this.deps.notify?.(m.a, `بازی تورنومنت «${t.titleFa}» شروع شد!`);
          this.deps.notify?.(m.b, `بازی تورنومنت «${t.titleFa}» شروع شد!`);
        }
      }
    }
  }

  /** «۲۰ مهر، ۲۰:۰۰» in Tehran time, for the messages. */
  private when(ms: number): string {
    return new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));
  }

  /** Matches already announced as open (a restart may announce one again; harmless). */
  private readonly announced = new Set<string>();

  /** A scheduled match: waits for its time, then for both players to check in; the deadline gives it to whoever showed up. */
  private async runScheduled(t: TournamentRow, m: MatchRow): Promise<void> {
    const now = this.now();
    const opensAt = m.opensAt ?? roundOpensAt(t.startsAt, t.roundGapMinutes, m.round);
    if (m.opensAt === null) await this.store.updateMatch(m.id, { opensAt });
    if (now < opensAt) return;
    const deadline = matchDeadline(opensAt, t.graceMinutes);
    if (!this.announced.has(m.id)) {
      this.announced.add(m.id);
      for (const id of [m.a, m.b]) if (id) this.deps.notify?.(id, `نوبتِ بازی تورنومنت «${t.titleFa}» شد! تا ساعت ${this.when(deadline)} وقت داری وارد بازی بشی، وگرنه حریفت برنده می‌شه.`);
    }
    const outcome = forfeitOutcome(m.aIn, m.bIn);
    if (outcome === 'play') {
      if (await this.deps.startMatch(m.a!, m.b!)) await this.store.updateMatch(m.id, { status: 'playing' });
      return;
    }
    if (now <= deadline) return;
    let winner: string;
    if (outcome === 'a') winner = m.a!;
    else if (outcome === 'b') winner = m.b!;
    else {
      const [la, lb] = await Promise.all([this.deps.levelOf(m.a!), this.deps.levelOf(m.b!)]);
      winner = lb > la ? m.b! : m.a!;
    }
    const loser = winner === m.a ? m.b! : m.a!;
    await this.store.updateMatch(m.id, { status: 'done', winner });
    this.deps.notify?.(winner, outcome === 'seed' ? `هیچ‌کدام از شما برای بازی تورنومنت «${t.titleFa}» نیامدید؛ به‌خاطر سطح بالاتر، تو رفتی دور بعد.` : `حریفت به بازی تورنومنت «${t.titleFa}» نیامد؛ تو برنده شدی و رفتی دور بعد.`);
    this.deps.notify?.(loser, `به بازی تورنومنت «${t.titleFa}» نرسیدی و از جدول کنار رفتی.`);
    await this.advance(t, m, winner);
    await this.resolve(t);
  }

  /** The player says «I am here» for their open match; when both are in, the duel starts at once. */
  async checkIn(userId: string, id: string): Promise<Result<{ state: TournamentTurn['state'] }>> {
    const t = await this.store.get(id);
    if (!t || t.status !== 'running' || t.roundGapMinutes <= 0) return { ok: false, error: 'NOT_FOUND' };
    const m = (await this.store.matches(id)).find((x) => (x.status === 'ready' || x.status === 'playing') && (x.a === userId || x.b === userId));
    if (!m || !m.a || !m.b) return { ok: false, error: 'NOT_IN' };
    if (m.status === 'playing') return { ok: true, state: 'playing' };
    const now = this.now();
    const opensAt = m.opensAt ?? roundOpensAt(t.startsAt, t.roundGapMinutes, m.round);
    if (now < opensAt) return { ok: false, error: 'NOT_YET' };
    if (now > matchDeadline(opensAt, t.graceMinutes) && !(m.aIn && m.bIn)) return { ok: false, error: 'CLOSED' };
    await this.store.updateMatch(m.id, m.a === userId ? { aIn: true } : { bIn: true });
    await this.runScheduled(t, { ...m, ...(m.a === userId ? { aIn: true } : { bIn: true }) });
    const after = (await this.store.matches(id)).find((x) => x.id === m.id);
    return { ok: true, state: after?.status === 'playing' ? 'playing' : 'checked_in' };
  }

  /** The caller's next tournament match (Home keeps it pinned): an open tournament they joined counts as «round 1 at the start time». */
  async turnFor(userId: string): Promise<TournamentTurn | null> {
    const now = this.now();
    const rows = await this.store.list(['open', 'running'], 100);
    const mine = await this.store.entriesOf(userId, rows.map((r) => r.id));
    const turns: TournamentTurn[] = [];
    for (const t of rows) {
      if (!mine.has(t.id)) continue;
      if (t.status === 'open') {
        turns.push({ tournamentId: t.id, titleFa: t.titleFa, size: t.size, round: 1, opensAt: t.startsAt, deadline: matchDeadline(t.startsAt, t.graceMinutes), state: 'upcoming', opponent: null });
        continue;
      }
      if (t.roundGapMinutes <= 0) continue;
      const m = (await this.store.matches(t.id)).find((x) => x.status !== 'done' && x.status !== 'bye' && (x.a === userId || x.b === userId));
      if (!m) continue;
      const opensAt = m.opensAt ?? roundOpensAt(t.startsAt, t.roundGapMinutes, m.round);
      const rival = m.a === userId ? m.b : m.a;
      const state = m.status === 'waiting' ? 'upcoming' : turnState({ now, opensAt, playing: m.status === 'playing', checkedIn: m.a === userId ? m.aIn : m.bIn });
      turns.push({ tournamentId: t.id, titleFa: t.titleFa, size: t.size, round: m.round, opensAt, deadline: matchDeadline(opensAt, t.graceMinutes), state, opponent: rival ? ((await this.deps.profileOf(rival))?.nickname ?? null) : null });
    }
    return turns.sort((x, y) => (x.opensAt ?? 0) - (y.opensAt ?? 0))[0] ?? null;
  }

  private async begin(t: TournamentRow): Promise<void> {
    let entries = await this.store.entries(t.id);
    if (t.botFill && this.deps.fillBots && entries.length < t.size) {
      // Empty seats go to idle bot accounts (no entry fee); they play like anyone else.
      for (const botId of this.deps.fillBots(t.size - entries.length)) await this.store.join(t.id, botId, 0, 0, this.now());
      entries = await this.store.entries(t.id);
    }
    if (entries.length < t.minPlayers) {
      await this.store.cancel(t.id);
      for (const e of entries) this.deps.notify?.(e.userId, `تورنومنت «${t.titleFa}» به حد نصاب نرسید و لغو شد؛ ورودی‌ات برگشت.`);
      return;
    }
    // Seeds: higher level first, earlier sign-up breaks ties.
    const withLevel = await Promise.all(entries.map(async (e) => ({ ...e, level: await this.deps.levelOf(e.userId) })));
    const seeded = withLevel.sort((x, y) => y.level - x.level || x.joinedAt - y.joinedAt).map((e) => e.userId);
    const slots = buildBracket(seeded, t.size);
    await this.store.setMatches(t.id, slots.map((s) => ({ round: s.round, slot: s.slot, a: s.a, b: s.b, winner: null, status: s.round === 1 ? 'ready' : 'waiting', opensAt: t.roundGapMinutes > 0 && s.round === 1 ? Math.max(roundOpensAt(t.startsAt, t.roundGapMinutes, 1), this.now()) : null, aIn: false, bIn: false })));
    await this.store.update(t.id, { status: 'running', startedAt: this.now() });
    for (const id of seeded) this.deps.notify?.(id, t.roundGapMinutes > 0 ? `تورنومنت «${t.titleFa}» شروع شد. دور اول: ${this.when(roundOpensAt(t.startsAt, t.roundGapMinutes, 1))}؛ از صفحه‌ی اصلی بازی وارد بازی‌ات شو.` : `تورنومنت «${t.titleFa}» شروع شد؛ بازی‌ات به‌زودی شروع می‌شود.`);
    await this.resolve({ ...t, status: 'running' });
  }

  /** Settles byes and empty matches, readies matches whose two players are known, and finishes the tournament after the final. */
  private async resolve(t: TournamentRow): Promise<void> {
    for (let pass = 0; pass < 12; pass++) {
      const all = await this.store.matches(t.id);
      const at = (round: number, slot: number) => all.find((m) => m.round === round && m.slot === slot);
      const settled = (m: MatchRow | undefined) => !m || m.status === 'done' || m.status === 'bye';
      let changed = false;
      for (const m of all) {
        if (m.status !== 'ready' && m.status !== 'waiting') continue;
        const feedersDone = m.round === 1 || (settled(at(m.round - 1, m.slot * 2)) && settled(at(m.round - 1, m.slot * 2 + 1)));
        if (!feedersDone) continue;
        const present = [m.a, m.b].filter((x): x is string => x !== null);
        if (present.length === 2) {
          if (m.status === 'waiting') {
            await this.store.updateMatch(m.id, { status: 'ready', ...(t.roundGapMinutes > 0 ? { opensAt: Math.max(roundOpensAt(t.startsAt, t.roundGapMinutes, m.round), this.now()) } : {}) });
            changed = true;
          }
        } else {
          await this.store.updateMatch(m.id, { status: 'bye', winner: present[0] ?? null });
          if (present[0]) await this.advance(t, m, present[0]);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const all = await this.store.matches(t.id);
    const last = roundCount(t.size);
    const final = all.find((m) => m.round === last);
    if (final && (final.status === 'done' || final.status === 'bye') && final.winner) await this.finish(t, all);
  }

  private async advance(t: TournamentRow, m: MatchRow, winner: string): Promise<void> {
    const next = nextSlot(m.round, m.slot, t.size);
    if (!next) return;
    const target = (await this.store.matches(t.id)).find((x) => x.round === next.round && x.slot === next.slot);
    if (target) await this.store.updateMatch(target.id, next.side === 'a' ? { a: winner } : { b: winner });
    if (t.roundGapMinutes > 0) this.deps.notify?.(winner, `رفتی دور بعدِ تورنومنت «${t.titleFa}»؛ نوبتت ${this.when(roundOpensAt(t.startsAt, t.roundGapMinutes, next.round))}.`);
  }

  private async finish(t: TournamentRow, matches: MatchRow[]): Promise<void> {
    const fresh = await this.store.get(t.id);
    if (!fresh || fresh.status === 'finished') return;
    const prizes = new Map((await this.store.prizes(t.id)).map((p) => [p.place, p]));
    const places = finalPlaces(matches, t.size);
    const awards = places.filter((p) => !this.deps.isBot?.(p.userId)).map((p) => ({ userId: p.userId, coins: prizes.get(p.place)?.coins ?? 0, gems: prizes.get(p.place)?.gems ?? 0, spins: prizes.get(p.place)?.spins ?? 0 }));
    await this.store.payout(t.id, awards);
    await this.store.update(t.id, { status: 'finished', finishedAt: this.now() });
    for (const p of places) {
      if (p.place === 1) this.deps.notify?.(p.userId, `تبریک! قهرمان «${t.titleFa}» شدی 🏆`);
      else if (p.place <= 3) this.deps.notify?.(p.userId, `در «${t.titleFa}» مقام ${p.place} را گرفتی 🎖`);
    }
  }

  /** Hook for the live-match service: a duel ended; if it was a tournament match the winner moves on (a draw is replayed). */
  async onMatchEnded(players: readonly [string, string], winnerIndex: 0 | 1 | null): Promise<void> {
    try {
      const m = await this.store.findPlaying(players[0], players[1]);
      if (!m) return;
      if (winnerIndex === null) {
        await this.store.updateMatch(m.id, { status: 'ready' });
        return;
      }
      const winner = players[winnerIndex];
      await this.store.updateMatch(m.id, { status: 'done', winner });
      await this.advance(m.tournament, m, winner);
      await this.resolve(m.tournament);
    } catch {
      /* a tournament problem must not break the duel flow; the next tick recovers */
    }
  }
}
