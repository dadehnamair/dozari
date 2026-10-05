import { randomInt } from 'node:crypto';
import { PRICE_GUESS_MIN_POINTS, PRICE_GUESS_STAIRCASE, PRICE_ONLY_ROUNDS, mulberry32, selectPriceOnlyRounds, staircasePoints } from '@dozari/shared';
import type { CatalogProduct, PriceOnlyResult, PriceOnlyRound, PriceOnlyView, Rng } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';

/** I/O boundary: products with enough approved prices to be asked about. */
export interface PriceOnlySource {
  /** Up to `limit` random products that have usable prices, with the texts a card shows. */
  products(limit: number): Promise<{ catalog: CatalogProduct[]; items: Record<string, { nameFa: string; unitFa: string | null; iconKey: string | null }> }>;
}

export interface PriceOnlyRules {
  rounds: number;
  tiers: readonly { maxErrorPct: number; points: number }[];
  minPoints: number;
}

export interface PriceOnlyOptions {
  now?: () => number;
  newSeed?: () => number;
  ttlMs?: number;
  /** Live tunables (admin settings in production). */
  rules?: () => Promise<PriceOnlyRules>;
  /** Called once when a signed-in player answers the last round. */
  onFinished?: (userId: string, points: number) => void;
}

interface Session {
  userId?: string;
  rounds: PriceOnlyRound[];
  items: Record<string, { nameFa: string; unitFa: string | null; iconKey: string | null }>;
  results: PriceOnlyResult[];
  rules: PriceOnlyRules;
  touchedAt: number;
  recorded?: boolean;
}

const DEFAULT_RULES: PriceOnlyRules = { rounds: PRICE_ONLY_ROUNDS, tiers: PRICE_GUESS_STAIRCASE, minPoints: PRICE_GUESS_MIN_POINTS };
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
/** Candidates fetched per round so a product that turns out unusable does not shrink the game. */
const OVERFETCH = 3;

/** Price-only games (docs/logic/price-guess-round.md §Price-only mode): in memory like solo; the real prices leave the server only in the answer to that round. */
export class PriceOnlyService {
  private readonly sessions = new Map<string, Session>();
  private readonly now: () => number;
  private readonly newSeed: () => number;
  private readonly ttlMs: number;
  private readonly loadRules: () => Promise<PriceOnlyRules>;
  private readonly onFinished?: (userId: string, points: number) => void;

  constructor(
    private readonly source: PriceOnlySource,
    opts: PriceOnlyOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.newSeed = opts.newSeed ?? (() => randomInt(0, 2 ** 31));
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.loadRules = opts.rules ?? (async () => DEFAULT_RULES);
    this.onFinished = opts.onFinished;
  }

  /** Starts a game, or null when the catalog has nothing to ask. */
  async start(userId?: string): Promise<PriceOnlyView | null> {
    this.sweep();
    const rules = await this.loadRules();
    const rng: Rng = mulberry32(this.newSeed());
    const { catalog, items } = await this.source.products(rules.rounds * OVERFETCH);
    const rounds = selectPriceOnlyRounds(catalog, rules.rounds, rng);
    if (rounds.length === 0) return null;
    const id = uuidv7();
    const s: Session = { userId, rounds, items, results: [], rules, touchedAt: this.now() };
    this.sessions.set(id, s);
    return this.toView(id, s);
  }

  view(sessionId: string): PriceOnlyView | null {
    const s = this.live(sessionId);
    return s ? this.toView(sessionId, s) : null;
  }

  /** Scores round `index`. Answering a round twice returns the first result unchanged. */
  guess(sessionId: string, index: number, guessRials: bigint): { result: PriceOnlyResult; view: PriceOnlyView } | 'unknown_round' | null {
    const s = this.live(sessionId);
    if (!s) return null;
    const round = s.rounds[index];
    if (!round) return 'unknown_round';
    let result = s.results.find((r) => r.index === index);
    if (!result) {
      result = {
        index,
        guessRials: guessRials.toString(),
        actualRials: round.actualRials.toString(),
        points: staircasePoints(guessRials, round.actualRials, s.rules.tiers, s.rules.minPoints),
      };
      s.results.push(result);
      if (s.results.length === s.rounds.length && s.userId && !s.recorded) {
        s.recorded = true;
        try {
          this.onFinished?.(s.userId, s.results.reduce((sum, r) => sum + r.points, 0));
        } catch {
          /* a stats hiccup must not break the answer */
        }
      }
    }
    return { result, view: this.toView(sessionId, s) };
  }

  private toView(sessionId: string, s: Session): PriceOnlyView {
    const top = Math.max(...s.rules.tiers.map((t) => t.points), s.rules.minPoints);
    return {
      sessionId,
      rounds: s.rounds.map((r, index) => ({
        index,
        productId: r.productId,
        nameFa: s.items[r.productId]?.nameFa ?? r.productId,
        unitFa: s.items[r.productId]?.unitFa ?? null,
        iconKey: s.items[r.productId]?.iconKey ?? null,
        year: r.year,
      })),
      // Only answered rounds carry their real price.
      results: [...s.results].sort((a, b) => a.index - b.index),
      done: s.results.length === s.rounds.length,
      maxPoints: top * s.rounds.length,
    };
  }

  private live(sessionId: string): Session | null {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    if (this.now() - s.touchedAt > this.ttlMs) {
      this.sessions.delete(sessionId);
      return null;
    }
    s.touchedAt = this.now();
    return s;
  }

  private sweep(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, s] of this.sessions) if (s.touchedAt < cutoff) this.sessions.delete(id);
  }
}
