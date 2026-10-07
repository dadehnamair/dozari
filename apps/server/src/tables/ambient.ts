import { TABLE_ICONS, TABLE_PRICE_ROUNDS_MAX, TABLE_ROUNDS_MAX } from '@dozari/shared';
import type { Rng, TableFormat } from '@dozari/shared';
import type { TableService } from './service.js';

export interface AmbientSettings {
  /** Master switch (the bots switch): off = no lobby tables at all. */
  enabled: boolean;
  /** Bot-made tables kept open for people to sit at. */
  open: number;
  /** Bots-only tables kept playing for people to watch. */
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

/** Names a group of friends would give a table; the lobby picks at random so it never looks stamped out. */
export const AMBIENT_TABLE_NAMES: readonly string[] = [
  'سفره‌ی نوستالژی', 'میز بچه‌های دهه‌ی ۷۰', 'دوزاری‌بازها', 'چای دبش', 'میز رفقا', 'قهوه‌خانه‌ی شبانه', 'پاتوق بچه‌محل', 'حریف‌طلب', 'یه دست بازی',
  'میز خانوم‌ها', 'آقایون', 'سنگک داغ', 'نوستالژی‌بازها', 'بازی دوستانه', 'کاست و رادیو', 'میز استادها', 'تازه‌کارها بیان', 'سفره‌ی بی‌ادعا',
  'شب‌نشینی', 'هم‌محله‌ای‌ها', 'یه چای و یه بازی', 'قدیمی‌ترها', 'میز آخر شب', 'گل‌گفتن و گل‌شنفتن', 'ماشین‌پیکان', 'بستنی‌چی‌ها', 'پفک نمکی', 'حلقه‌ی دوستان',
];

/**
 * Keeps the lobby of «سفره‌خانه» busy (docs/logic/bots.md §Lobby tables): a few open tables made by bot accounts, in 1v1 and 2v2, that a person can ask
 * to sit at — the bots then fill the rest and the match starts after a human-like wait — and a few tables where bots really play each other, which
 * anybody can watch. Tables live in memory; the only rows written are those of a real (friendly) match, which a person's or a bot's game always makes.
 */
export class AmbientLobby {
  /** When a bot host answers each pending request (user + table → time), a human-like pause after the ask. */
  private readonly answerAt = new Map<string, number>();
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

  private takeBots(n: number) {
    const idle = this.deps.roster().filter((b) => !this.deps.inMatch(b.userId) && !this.deps.tables.isSeated(b.userId));
    const out = [];
    while (out.length < n && idle.length > 0) out.push(idle.splice(Math.floor(this.deps.rng() * idle.length), 1)[0]!);
    return out;
  }

  /** Roughly four tables in ten are 2v2. */
  private pickFormat(): TableFormat {
    return this.deps.rng() < 0.4 ? '2v2' : '1v1';
  }

  /** Every few seconds: answer people, fill tables they sat at, close finished ones, keep the open and playing counts at their settings. */
  async tick(): Promise<void> {
    const s = await this.deps.settings();
    const tables = this.deps.tables;
    tables.sweepAmbient();
    if (!s.enabled) return;
    const now = this.now();
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
      const bots = this.takeBots(due.need);
      if (bots.length < due.need) continue; // not enough idle bots yet: the person keeps waiting a little, the next tick tries again
      await tables.fillAndStart(due.code, bots.map((b) => b.userId));
    }
    // Open tables: at most two new ones per tick, so they do not all appear (or vanish) at once.
    for (let made = 0; made < 2 && tables.ambientOpenCount() < s.open; made++) {
      const format = this.pickFormat();
      const wanted = format === '2v2' ? this.between(1, 3) : 1;
      const bots = this.takeBots(wanted);
      if (bots.length < wanted) break;
      const [host, ...rest] = bots;
      const code = await tables.createAmbient(host!.userId, { name: this.pick(AMBIENT_TABLE_NAMES), icon: this.pick(TABLE_ICONS), format, rounds: this.between(1, TABLE_ROUNDS_MAX), priceRounds: this.between(0, TABLE_PRICE_ROUNDS_MAX), extraBots: rest.map((b) => b.userId), ttlMs: this.between(60, 300) * 1000 });
      if (!code) break;
    }
    // Now and then a bot drops by the stands of a running table (real ones too) for a while, so the watcher count moves like a lobby's would.
    const roster = new Set(this.deps.roster().map((b) => b.userId));
    for (const code of tables.playingCodes()) {
      const botWatchers = tables.watcherIds(code).filter((id) => roster.has(id)).length;
      if (botWatchers >= 3 || this.deps.rng() >= 0.25) continue;
      const bot = this.takeBots(1)[0];
      if (bot) tables.botWatch(code, bot.userId, this.between(15, 60) * 1000);
    }
    // Bots-only tables that really play: one new match per tick at most, so they do not all end together.
    if (tables.ambientPlayingCount() < s.playing) {
      const format = this.pickFormat();
      const seats = format === '2v2' ? 4 : 2;
      const bots = this.takeBots(seats);
      if (bots.length === seats) {
        const [host, ...rest] = bots;
        const code = await tables.createAmbient(host!.userId, { name: this.pick(AMBIENT_TABLE_NAMES), icon: this.pick(TABLE_ICONS), format, rounds: this.between(1, TABLE_ROUNDS_MAX), priceRounds: this.between(0, TABLE_PRICE_ROUNDS_MAX), extraBots: rest.map((b) => b.userId), ttlMs: 60_000, full: true });
        if (code && !(await tables.fillAndStart(code, []))) tables.sweepAmbient();
      }
    }
  }
}
