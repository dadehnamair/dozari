import { TOURNAMENT_MAX_ENTRY_COINS, TOURNAMENT_MAX_PRIZE_COINS, TOURNAMENT_SIZES, buildBracket, finalPlaces, nextSlot, roundCount } from '@dozari/shared';
import type { TournamentDetail, TournamentError, TournamentListItem } from '@dozari/shared';
import type { MatchRow, NewTournament, TournamentRow, TournamentStore } from './store.js';

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
  minLevel: number;
  startsAt: number;
  botFill?: boolean;
  allowConcurrent?: boolean;
  /** `spins` (lucky-wheel spins) may be left out = 0. */
  prizes: { place: number; coins: number; spins?: number }[];
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: TournamentError | 'INVALID' };

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

  private validate(i: TournamentInput): boolean {
    return (
      (TOURNAMENT_SIZES as readonly number[]).includes(i.size) &&
      i.minPlayers >= 2 && i.minPlayers <= i.size &&
      i.entryCoins >= 0 && i.entryCoins <= TOURNAMENT_MAX_ENTRY_COINS &&
      i.minLevel >= 1 &&
      i.titleFa.trim().length >= 2 &&
      i.prizes.every((p) => [1, 2, 3].includes(p.place) && p.coins >= 0 && p.coins <= TOURNAMENT_MAX_PRIZE_COINS && (p.spins ?? 0) >= 0 && (p.spins ?? 0) <= 20) &&
      new Set(i.prizes.map((p) => p.place)).size === i.prizes.length
    );
  }

  async create(input: TournamentInput, publish: boolean): Promise<Result<{ id: string }>> {
    if (!this.validate(input)) return { ok: false, error: 'INVALID' };
    if (publish && input.startsAt <= this.now()) return { ok: false, error: 'INVALID' };
    const t: NewTournament = { titleFa: input.titleFa.trim(), descriptionFa: input.descriptionFa.trim(), iconKey: input.iconKey, status: publish ? 'open' : 'draft', size: input.size, minPlayers: input.minPlayers, entryCoins: input.entryCoins, minLevel: input.minLevel, botFill: input.botFill ?? false, allowConcurrent: input.allowConcurrent ?? false, startsAt: input.startsAt };
    const row = await this.store.create(t, input.prizes.map((p) => ({ ...p, spins: p.spins ?? 0 })));
    return { ok: true, id: row.id };
  }

  /** Edit a draft freely; an open one only until the first player joins (a title, description or prizes can always change). */
  async update(id: string, input: Partial<TournamentInput>): Promise<Result> {
    const t = await this.store.get(id);
    if (!t) return { ok: false, error: 'NOT_FOUND' };
    if (t.status !== 'draft' && t.status !== 'open') return { ok: false, error: 'BAD_STATE' };
    const entered = (await this.store.entries(id)).length > 0;
    const structural = ['size', 'minPlayers', 'entryCoins', 'minLevel'] as const;
    if (entered && structural.some((k) => input[k] !== undefined && input[k] !== t[k])) return { ok: false, error: 'BAD_STATE' };
    const merged: TournamentInput = { titleFa: t.titleFa, descriptionFa: t.descriptionFa, iconKey: t.iconKey, size: t.size, minPlayers: t.minPlayers, entryCoins: t.entryCoins, minLevel: t.minLevel, botFill: t.botFill, allowConcurrent: t.allowConcurrent, startsAt: t.startsAt, prizes: input.prizes ?? (await this.store.prizes(id)), ...input };
    if (!this.validate(merged)) return { ok: false, error: 'INVALID' };
    await this.store.update(id, { titleFa: merged.titleFa.trim(), descriptionFa: merged.descriptionFa.trim(), iconKey: merged.iconKey, size: merged.size, minPlayers: merged.minPlayers, entryCoins: merged.entryCoins, minLevel: merged.minLevel, botFill: merged.botFill ?? false, allowConcurrent: merged.allowConcurrent ?? false, startsAt: merged.startsAt });
    if (input.prizes) await this.store.setPrizes(id, input.prizes.map((p) => ({ ...p, spins: p.spins ?? 0 })));
    return { ok: true };
  }

  async publish(id: string): Promise<Result> {
    const t = await this.store.get(id);
    if (!t) return { ok: false, error: 'NOT_FOUND' };
    if (t.status !== 'draft' || t.startsAt <= this.now()) return { ok: false, error: 'BAD_STATE' };
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

  async adminList(): Promise<(TournamentRow & { joined: number; prizes: { place: number; coins: number; spins: number }[] })[]> {
    const rows = await this.store.list(['draft', 'open', 'running', 'finished', 'cancelled'], 100);
    return Promise.all(rows.map(async (t) => ({ ...t, joined: (await this.store.entries(t.id)).length, prizes: await this.store.prizes(t.id) })));
  }

  // ---- players -----------------------------------------------------------------------------------------------------

  async list(userId: string): Promise<TournamentListItem[]> {
    const rows = await this.store.list(['open', 'running', 'finished'], 40);
    const mine = await this.store.entriesOf(userId, rows.map((r) => r.id));
    return Promise.all(rows.map(async (t) => ({ id: t.id, titleFa: t.titleFa, status: t.status, size: t.size, entryCoins: t.entryCoins, minLevel: t.minLevel, startsAt: t.startsAt, joined: (await this.store.entries(t.id)).length, iconKey: t.iconKey, entered: mine.has(t.id) })));
  }

  async detail(userId: string, id: string): Promise<TournamentDetail | null> {
    const t = await this.store.get(id);
    if (!t || t.status === 'draft') return null;
    const [entries, prizes, matches, level, balance] = await Promise.all([this.store.entries(id), this.store.prizes(id), this.store.matches(id), this.deps.levelOf(userId), this.store.balance(userId)]);
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
      bracket.push({ round: m.round, slot: m.slot, a: a ? { id: a.id, nickname: a.nickname } : null, b: b ? { id: b.id, nickname: b.nickname } : null, winnerId: m.winner, status: m.status });
    }
    const entered = entries.some((e) => e.userId === userId);
    const busy = !entered && !t.allowConcurrent && t.status === 'open' && (await this.store.busyElsewhere(userId, id));
    const blocked = entered ? null : t.status !== 'open' ? 'CLOSED' : entries.length >= t.size ? 'FULL' : level < t.minLevel ? 'LEVEL' : busy ? 'BUSY' : balance < t.entryCoins ? 'COINS' : null;
    const prizeOf = new Map(prizes.map((p) => [p.place, p.coins]));
    const results = t.status === 'finished' ? finalPlaces(matches, t.size) : [];
    const resultRows = [];
    for (const r of results) {
      const w = (await who(r.userId))!;
      resultRows.push({ id: r.userId, nickname: w.nickname, place: r.place as 1 | 2 | 3, coins: prizeOf.get(r.place) ?? 0 });
    }
    return { id: t.id, titleFa: t.titleFa, status: t.status, size: t.size, entryCoins: t.entryCoins, minLevel: t.minLevel, startsAt: t.startsAt, joined: entries.length, iconKey: t.iconKey, entered, descriptionFa: t.descriptionFa, prizes, players, bracket, rounds: roundCount(t.size), blocked, results: resultRows.sort((x, y) => x.place - y.place) };
  }

  async join(userId: string, id: string): Promise<Result<{ balance: number }>> {
    const t = await this.store.get(id);
    if (!t || t.status === 'draft') return { ok: false, error: 'NOT_FOUND' };
    if (t.status !== 'open') return { ok: false, error: 'CLOSED' };
    if ((await this.deps.levelOf(userId)) < t.minLevel) return { ok: false, error: 'LEVEL' };
    if (!t.allowConcurrent && (await this.store.busyElsewhere(userId, id))) return { ok: false, error: 'BUSY' };
    const out = await this.store.join(id, userId, t.entryCoins, this.now());
    if (out === 'ok') return { ok: true, balance: await this.store.balance(userId) };
    return { ok: false, error: out === 'full' ? 'FULL' : out === 'already' ? 'ALREADY_IN' : out === 'insufficient' ? 'COINS' : 'CLOSED' };
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
        if (m.status === 'ready' && m.a && m.b && (await this.deps.startMatch(m.a, m.b))) {
          await this.store.updateMatch(m.id, { status: 'playing' });
          this.deps.notify?.(m.a, `بازی تورنومنت «${t.titleFa}» شروع شد!`);
          this.deps.notify?.(m.b, `بازی تورنومنت «${t.titleFa}» شروع شد!`);
        }
      }
    }
  }

  private async begin(t: TournamentRow): Promise<void> {
    let entries = await this.store.entries(t.id);
    if (t.botFill && this.deps.fillBots && entries.length < t.size) {
      // Empty seats go to idle bot accounts (no entry fee); they play like anyone else.
      for (const botId of this.deps.fillBots(t.size - entries.length)) await this.store.join(t.id, botId, 0, this.now());
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
    await this.store.setMatches(t.id, slots.map((s) => ({ round: s.round, slot: s.slot, a: s.a, b: s.b, winner: null, status: s.round === 1 ? 'ready' : 'waiting' })));
    await this.store.update(t.id, { status: 'running', startedAt: this.now() });
    for (const id of seeded) this.deps.notify?.(id, `تورنومنت «${t.titleFa}» شروع شد؛ بازی‌ات به‌زودی شروع می‌شود.`);
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
            await this.store.updateMatch(m.id, { status: 'ready' });
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
  }

  private async finish(t: TournamentRow, matches: MatchRow[]): Promise<void> {
    const fresh = await this.store.get(t.id);
    if (!fresh || fresh.status === 'finished') return;
    const prizes = new Map((await this.store.prizes(t.id)).map((p) => [p.place, p]));
    const places = finalPlaces(matches, t.size);
    const awards = places.filter((p) => !this.deps.isBot?.(p.userId)).map((p) => ({ userId: p.userId, coins: prizes.get(p.place)?.coins ?? 0, spins: prizes.get(p.place)?.spins ?? 0 }));
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
