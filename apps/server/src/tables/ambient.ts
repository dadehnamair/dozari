import { TABLE_ICONS, TABLE_PRICE_ROUNDS_MAX, TABLE_ROUNDS_MAX, seatsOfFormat } from '@dozari/shared';
import type { PublicTable, Rng, TableFormat } from '@dozari/shared';
import type { TableService } from './service.js';

export interface AmbientSettings {
  /** Master switch (the bots switch): off = no lobby tables at all. */
  enabled: boolean;
  /** Bot-made tables kept open for people to sit at. */
  open: number;
  /** Display-only «playing» rows. */
  playing: number;
}

export interface AmbientDeps {
  tables: TableService;
  /** The active bot accounts (name and face are what the lobby shows). */
  roster: () => { userId: string; nickname: string; avatarKey: string }[];
  inMatch: (userId: string) => boolean;
  settings: () => Promise<AmbientSettings>;
  rng: Rng;
  now?: () => number;
}

interface PlayingRow {
  id: string;
  name: string;
  icon: string;
  format: TableFormat;
  rounds: number;
  priceRounds: number;
  players: { userId: string; nickname: string; avatarKey: string; side: 0 | 1 }[];
  until: number;
}

/** Names a group of friends would give a table; the lobby picks at random so it never looks stamped out. */
export const AMBIENT_TABLE_NAMES: readonly string[] = [
  'سفره‌ی نوستالژی', 'میز بچه‌های دهه‌ی ۷۰', 'دوزاری‌بازها', 'چای دبش', 'میز رفقا', 'قهوه‌خانه‌ی شبانه', 'پاتوق بچه‌محل', 'حریف‌طلب', 'یه دست بازی',
  'میز خانوم‌ها', 'آقایون', 'سنگک داغ', 'نوستالژی‌بازها', 'بازی دوستانه', 'کاست و رادیو', 'میز استادها', 'تازه‌کارها بیان', 'سفره‌ی بی‌ادعا',
  'شب‌نشینی', 'هم‌محله‌ای‌ها', 'یه چای و یه بازی', 'قدیمی‌ترها', 'میز آخر شب', 'گل‌گفتن و گل‌شنفتن', 'ماشین‌پیکان', 'بستنی‌چی‌ها', 'پفک نمکی', 'حلقه‌ی دوستان',
];

/**
 * Keeps the lobby of «سفره‌خانه» busy (docs/logic/bots.md §Lobby tables): a few open tables made by bot accounts, in 1v1 and 2v2, that a person can sit
 * at — the bots then fill the rest and the match starts after a human-like wait — plus a few display-only «playing» rows. Everything lives in memory:
 * no table, match or account rows are written until a person actually sits down, and then it is an ordinary friendly match.
 */
export class AmbientLobby {
  private playing: PlayingRow[] = [];
  /** When a bot host answers each pending request (user + table → time), a human-like pause after the ask. */
  private readonly answerAt = new Map<string, number>();
  private seq = 0;
  private readonly now: () => number;

  constructor(private readonly deps: AmbientDeps) {
    this.now = deps.now ?? Date.now;
  }

  private between(min: number, max: number): number {
    return Math.round(min + this.deps.rng() * Math.max(0, max - min));
  }

  private pick<T>(xs: readonly T[]): T {
    return xs[Math.floor(this.deps.rng() * xs.length)] as T;
  }

  /** Display-only rows for the lobby list: full tables in play, bots only (view only, like any playing table; their codes match nothing). */
  playingRows(): PublicTable[] {
    return this.playing.map((r) => ({ code: r.id, name: r.name, icon: r.icon, format: r.format, rounds: r.rounds, priceRounds: r.priceRounds, entryFee: 0, seats: seatsOfFormat(r.format), taken: r.players.length, hostNickname: r.players[0]!.nickname, hostAvatarKey: r.players[0]!.avatarKey, yourRequest: 'none' as const, status: 'playing' as const }));
  }

  private idleBots(exclude: ReadonlySet<string>) {
    return this.deps.roster().filter((b) => !exclude.has(b.userId) && !this.deps.inMatch(b.userId) && !this.deps.tables.isSeated(b.userId));
  }

  private takeBots(n: number, exclude: Set<string>) {
    const idle = this.idleBots(exclude);
    const out = [];
    while (out.length < n && idle.length > 0) {
      const b = idle.splice(Math.floor(this.deps.rng() * idle.length), 1)[0]!;
      exclude.add(b.userId);
      out.push(b);
    }
    return out;
  }

  /** Every few seconds: fill tables a person sat at, close finished ones, keep the open and playing counts at their settings. */
  async tick(): Promise<void> {
    const s = await this.deps.settings();
    const tables = this.deps.tables;
    tables.sweepAmbient();
    const now = this.now();
    this.playing = this.playing.filter((r) => r.until > now);
    if (!s.enabled) {
      this.playing = [];
      return;
    }
    const used = new Set(this.playing.flatMap((r) => r.players.map((p) => p.userId)));
    // A person asked a bot host for a seat: after a short pause the bot lets them in (the fill-and-start pause begins then).
    const pending = tables.ambientRequests();
    for (const key of [...this.answerAt.keys()]) if (!pending.some((p) => `${p.code}:${p.userId}` === key)) this.answerAt.delete(key);
    for (const r of pending) {
      const key = `${r.code}:${r.userId}`;
      if (!this.answerAt.has(key)) this.answerAt.set(key, r.at + this.between(2000, 6000));
      if ((this.answerAt.get(key) as number) <= now) {
        this.answerAt.delete(key);
        await tables.answer(r.hostId, r.userId, true);
      }
    }
    for (const due of tables.ambientDue()) {
      const bots = this.takeBots(due.need, new Set(used));
      if (bots.length < due.need) continue; // not enough idle bots yet: the person keeps waiting a little, the next tick tries again
      await tables.fillAndStart(due.code, bots.map((b) => b.userId));
    }
    // Open tables: at most two new ones per tick, so they do not all appear (or vanish) at once.
    for (let made = 0; made < 2 && tables.ambientOpenCount() < s.open; made++) {
      const format: TableFormat = this.rng3() ? '2v2' : '1v1';
      const wanted = format === '2v2' ? this.between(1, 3) : 1;
      const bots = this.takeBots(wanted, new Set(used));
      if (bots.length < wanted) break;
      const [host, ...rest] = bots;
      const code = await tables.createAmbient(host!.userId, { name: this.pick(AMBIENT_TABLE_NAMES), icon: this.pick(TABLE_ICONS), format, rounds: this.between(1, TABLE_ROUNDS_MAX), priceRounds: this.between(0, TABLE_PRICE_ROUNDS_MAX), extraBots: rest.map((b) => b.userId), ttlMs: this.between(60, 300) * 1000 });
      if (!code) break;
    }
    // Display-only playing rows.
    while (this.playing.length < s.playing) {
      const format: TableFormat = this.rng3() ? '2v2' : '1v1';
      const seats = seatsOfFormat(format);
      const taken = new Set([...used, ...this.playing.flatMap((r) => r.players.map((p) => p.userId))]);
      const bots = this.takeBots(seats, taken);
      if (bots.length < seats) break;
      this.playing.push({ id: `p${++this.seq}`, name: this.pick(AMBIENT_TABLE_NAMES), icon: this.pick(TABLE_ICONS), format, rounds: this.between(1, TABLE_ROUNDS_MAX), priceRounds: format === '2v2' ? 0 : this.between(0, TABLE_PRICE_ROUNDS_MAX), players: bots.map((b, i) => ({ ...b, side: (i % 2) as 0 | 1 })), until: now + this.between(120, 420) * 1000 });
    }
  }

  /** Roughly four tables in ten are 2v2. */
  private rng3(): boolean {
    return this.deps.rng() < 0.4;
  }
}
