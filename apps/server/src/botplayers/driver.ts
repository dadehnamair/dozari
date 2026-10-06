import { botThinkDelay, chooseBotMove, chooseBotPriceGuess } from '@dozari/shared';
import type { ChatMessage, MatchView, Rng } from '@dozari/shared';
import { createHash } from 'node:crypto';
import type { ChatService } from '../chat/service.js';
import type { DuelQueue } from '../realtime/queue.js';
import type { MatchService } from '../realtime/match-service.js';
import type { BotPlayerStore, BotRow } from './store.js';

export interface BotDriverSettings {
  enabled: boolean;
  fallbackSec: number;
  jitterSec: number;
  cityReplyPercent: number;
  /** Fewer active bots than this are topped up by `deps.topUp`; 0 or absent = never. */
  autofillMin?: number;
}

export interface BotDriverDeps {
  store: BotPlayerStore;
  matches: () => MatchService | undefined;
  queue: () => DuelQueue | undefined;
  teamQueue?: () => DuelQueue | undefined;
  chat?: () => ChatService | undefined;
  settings: () => Promise<BotDriverSettings>;
  /** Lists the canned taunts by category name, for choosing a fitting reply. */
  taunts?: () => Promise<{ nameFa: string; ids: string[] }[]>;
  /** Makes `missing` more bot accounts (the admin's generator with default tuning). */
  topUp?: (missing: number) => Promise<void>;
  rng: Rng;
  now?: () => number;
  schedule?: (ms: number, fn: () => void) => void;
}

const defaultSchedule = (ms: number, fn: () => void) => void setTimeout(fn, ms).unref();
const jitterOf = (userId: string, max: number): number => (max <= 0 ? 0 : createHash('sha256').update(userId).digest().readUInt16BE(0) % (max + 1));

/**
 * Plays bot accounts like people (docs/logic/bots.md): fills the queue after a human-like wait, plays turns through the same `submit` as a human
 * after a "thinking" pause, answers taunts. Everything a bot sees of a match comes from its own redacted `match:state` except the answer, which
 * `solutionFor` hands to this server-side driver only — the skill setting decides how often it uses it. No flag reaches any client.
 */
export class BotDriver {
  private roster = new Map<string, BotRow>();
  private readonly planned = new Set<string>();
  private readonly opponentOf = new Map<string, string>();
  private ticks = 0;
  private enabled = true;
  private readonly now: () => number;
  private readonly schedule: (ms: number, fn: () => void) => void;

  constructor(private readonly deps: BotDriverDeps) {
    this.now = deps.now ?? Date.now;
    this.schedule = deps.schedule ?? defaultSchedule;
  }

  async refresh(): Promise<void> {
    this.roster = new Map((await this.deps.store.active()).map((b) => [b.userId, b]));
  }

  /** Ids of the active bot accounts (for the opponent-search show). */
  rosterIds(): string[] {
    return [...this.roster.keys()];
  }

  /** True when a waiting human can be given a bot: bots are on and at least one account exists. */
  ready(): boolean {
    return this.enabled && this.roster.size > 0;
  }

  isBot(userId: string): boolean {
    return this.roster.has(userId);
  }

  private between(min: number, max: number): number {
    return Math.round(min + this.deps.rng() * Math.max(0, max - min));
  }

  /** Called for every event the server pushes to a user (the gateway's `onEmit`); only bot users act. */
  onEmit(userId: string, event: string, payload: unknown): void {
    const bot = this.roster.get(userId);
    if (!bot) return;
    if (event === 'match:found') {
      const opp = this.deps.matches()?.opponentOf(userId);
      if (opp) this.opponentOf.set(userId, opp.opponentId);
      if (this.deps.rng() * 100 < bot.tauntPercent / 2) this.schedule(this.between(3000, 8000), () => void this.taunt(bot, 'greet'));
    } else if (event === 'match:state') {
      this.planTurn(bot, payload as MatchView);
    } else if (event === 'match:ended') {
      if (this.deps.rng() * 100 < bot.tauntPercent / 2) this.schedule(this.between(2000, 5000), () => void this.taunt(bot, 'gg'));
    } else if (event === 'chat:message') {
      const m = payload as ChatMessage;
      if (m.room === 'match' && m.userId !== userId && m.kind === 'taunt' && this.deps.rng() * 100 < bot.tauntPercent) this.schedule(this.between(2000, 6000), () => void this.taunt(bot, 'reply'));
    }
  }

  private planTurn(bot: BotRow, v: MatchView): void {
    if (v.priceRound) return this.planPriceGuess(bot, v);
    if (v.status !== 'playing' || v.turn !== v.you) return;
    if (v.captain && v.captain[v.you] !== bot.userId) return; // a bot teammate who is not the captain waits
    const key = `${bot.userId}:${v.matchId}:${v.turnId}`;
    if (this.planned.has(key)) return;
    this.planned.add(key);
    if (this.planned.size > 5000) this.planned.clear();
    const delay = botThinkDelay(bot.thinkMinMs, bot.thinkMaxMs, v.turnEndsAt - this.now(), this.deps.rng);
    this.schedule(delay, () => this.move(bot));
  }

  /** The duel's price-guess round: after a human-like pause the bot guesses near the real price (more precisely the higher its skill). */
  private planPriceGuess(bot: BotRow, v: MatchView): void {
    const r = v.priceRound;
    if (!r || !r.current || r.youSubmitted) return;
    const key = `${bot.userId}:${v.matchId}:price:${r.roundIndex}`;
    if (this.planned.has(key)) return;
    this.planned.add(key);
    const delay = botThinkDelay(bot.thinkMinMs, bot.thinkMaxMs, r.endsAt - this.now(), this.deps.rng);
    this.schedule(delay, () => {
      const matches = this.deps.matches();
      const actual = matches?.priceAnswerFor(bot.userId);
      if (matches && actual !== null && actual !== undefined) matches.submitPrice(bot.userId, chooseBotPriceGuess({ actualRials: actual, skill: bot.skill, rng: this.deps.rng }));
    });
  }

  private move(bot: BotRow): void {
    const matches = this.deps.matches();
    if (!matches) return;
    for (let attempt = 0; attempt < 8; attempt++) {
      const sol = matches.solutionFor(bot.userId);
      if (!sol) return;
      const itemIds = chooseBotMove({ groups: sol.groups, remaining: sol.remaining, skill: bot.skill, rng: this.deps.rng });
      const out = matches.submit(bot.userId, itemIds);
      if (out.ok || out.error !== 'DUPLICATE_SELECTION') return; // a duplicate set is simply re-chosen
    }
  }

  private async taunt(bot: BotRow, kind: 'greet' | 'gg' | 'reply'): Promise<void> {
    const chat = this.deps.chat?.();
    const matches = this.deps.matches();
    if (!chat || !this.deps.taunts) return;
    const live = matches?.opponentOf(bot.userId);
    const opponentId = live?.opponentId ?? this.opponentOf.get(bot.userId);
    const matchId = live?.matchId;
    if (!opponentId || !matchId) return;
    const cats = await this.deps.taunts();
    const byName = (needle: string) => cats.find((c) => c.nameFa.includes(needle));
    const pool = kind === 'greet' ? byName('سلام') : kind === 'gg' ? byName('خداقوت') : cats.filter((c) => !c.nameFa.includes('سلام'))[Math.floor(this.deps.rng() * Math.max(1, cats.length - 1))];
    const ids = (pool ?? cats[0])?.ids ?? [];
    if (ids.length === 0) return;
    await chat.sendMatchTaunt(bot.userId, matchId, opponentId, ids[Math.floor(this.deps.rng() * ids.length)] as string);
  }

  /** A human posted in a city room: now and then a bot from that city answers with a short canned line (docs/logic/bots.md §Chat). */
  async onCityMessage(cityId: string, message: ChatMessage): Promise<void> {
    if (this.roster.has(message.userId)) return;
    const s = await this.deps.settings();
    if (!s.enabled || this.deps.rng() * 100 >= s.cityReplyPercent) return;
    const mates = [...this.roster.values()].filter((b) => b.cityId === cityId);
    const bot = mates[Math.floor(this.deps.rng() * mates.length)];
    const chat = this.deps.chat?.();
    if (!bot || !chat || !this.deps.taunts) return;
    this.schedule(this.between(5000, 25_000), () => {
      void (async () => {
        const ids = (await this.deps.taunts!()).flatMap((c) => c.ids);
        if (ids.length > 0) await chat.sendCity(bot.userId, { kind: 'taunt', tauntId: ids[Math.floor(this.deps.rng() * ids.length)] as string });
      })().catch(() => undefined);
    });
  }

  /** Idle active bots for a tournament that is not full (best skill last so seeds stay mixed). */
  fillSeats(n: number): string[] {
    const matches = this.deps.matches();
    const idle = [...this.roster.values()].filter((b) => !matches?.inMatch(b.userId));
    const out: string[] = [];
    while (out.length < n && idle.length > 0) out.push(idle.splice(Math.floor(this.deps.rng() * idle.length), 1)[0]!.userId);
    return out;
  }

  /** Every few seconds: a human who waited long enough in the queue gets a bot opponent (the "opponent found" moment is the human-like delay). */
  async tick(): Promise<void> {
    const refreshNow = this.ticks++ % 6 === 0;
    if (refreshNow) await this.refresh();
    const s = await this.deps.settings();
    this.enabled = s.enabled;
    if (refreshNow && s.enabled && this.deps.topUp && (s.autofillMin ?? 0) > this.roster.size) {
      await this.deps.topUp((s.autofillMin ?? 0) - this.roster.size).catch(() => undefined);
      await this.refresh();
    }
    const queue = this.deps.queue();
    const matches = this.deps.matches();
    if (!s.enabled || !queue || !matches || this.roster.size === 0) return;
    const now = this.now();
    for (const { userId, since, track, tier } of queue.waiting()) {
      if (now - since < (s.fallbackSec + jitterOf(userId, s.jitterSec)) * 1000) continue;
      const idle = [...this.roster.values()].filter((b) => !matches.inMatch(b.userId) && !queue.has(b.userId));
      const bot = idle[Math.floor(this.deps.rng() * idle.length)];
      if (!bot) return;
      queue.leave(userId);
      if (!(await matches.start(userId, bot.userId, { tier }))) queue.join(userId, since, track, tier); // could not start: back in line, original place in time
    }
    await this.fillTeams(s, now);
  }

  /** 2v2: once the longest waiter is due, everyone waiting plays and bots fill the empty seats (humans on opposite sides). */
  private async fillTeams(s: BotDriverSettings, now: number): Promise<void> {
    const queue = this.deps.teamQueue?.();
    const matches = this.deps.matches();
    if (!queue || !matches) return;
    const waiting = queue.waiting();
    const first = waiting[0];
    if (!first || now - first.since < (s.fallbackSec + jitterOf(first.userId, s.jitterSec)) * 1000) return;
    const humans = waiting.slice(0, 4);
    const idle = [...this.roster.values()].filter((b) => !matches.inMatch(b.userId) && !queue.has(b.userId));
    const bots: string[] = [];
    while (humans.length + bots.length < 4 && idle.length > 0) bots.push(idle.splice(Math.floor(this.deps.rng() * idle.length), 1)[0]!.userId);
    if (humans.length + bots.length < 4) return;
    const seats = [...humans.map((h) => h.userId), ...bots];
    for (const h of humans) queue.leave(h.userId);
    const ok = await matches.startTeam([[seats[0]!, seats[2]!], [seats[1]!, seats[3]!]]);
    if (!ok) for (const h of humans) queue.join(h.userId, h.since);
  }
}
