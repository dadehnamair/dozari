import { randomInt } from 'node:crypto';
import { SOLO_MAX_MISTAKES, mulberry32, shuffleBoard, startSolo, submitGuess } from '@dozari/shared';
import type { GroupLevel, Rng, SoloChart, SoloState, SubmitOutcome } from '@dozari/shared';
import { uuidv7 } from 'uuidv7';
import type { PuzzleSource, ServedPuzzle, SoloView } from './types.js';

interface Session {
  puzzle: ServedPuzzle;
  state: SoloState;
  rng: Rng;
  touchedAt: number;
}

export interface GuessResult {
  outcome: SubmitOutcome;
  solvedLevel?: GroupLevel;
  view: SoloView;
}

export interface SoloServiceOptions {
  /** Idle sessions older than this are dropped (solo is practice: nothing is persisted yet). */
  ttlMs?: number;
  now?: () => number;
  newSeed?: () => number;
}

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

/** In-memory solo sessions around the shared reducer. All redaction happens in `toView`. */
export class SoloService {
  private readonly sessions = new Map<string, Session>();
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly newSeed: () => number;

  constructor(
    private readonly source: PuzzleSource,
    opts: SoloServiceOptions = {},
  ) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    this.now = opts.now ?? Date.now;
    this.newSeed = opts.newSeed ?? (() => randomInt(0, 2 ** 31));
  }

  /** Starts a session, or null when there is no puzzle to play. */
  async start(): Promise<SoloView | null> {
    this.sweep();
    const puzzle = await this.source.pickRandom();
    if (!puzzle) return null;
    const rng = mulberry32(this.newSeed());
    const state = startSolo(puzzle, rng);
    const sessionId = uuidv7();
    const session: Session = { puzzle, state, rng, touchedAt: this.now() };
    this.sessions.set(sessionId, session);
    return this.toView(sessionId, session);
  }

  view(sessionId: string): SoloView | null {
    const s = this.live(sessionId);
    return s ? this.toView(sessionId, s) : null;
  }

  guess(sessionId: string, productIds: readonly string[]): GuessResult | null {
    const s = this.live(sessionId);
    if (!s) return null;
    const r = submitGuess(s.state, s.puzzle, productIds);
    s.state = r.state;
    return { outcome: r.outcome, solvedLevel: r.solvedLevel, view: this.toView(sessionId, s) };
  }

  /** Price history of all four groups; only once the game is over, else null (it would reveal the groups). */
  async chart(sessionId: string): Promise<SoloChart | 'in_progress' | null> {
    const s = this.live(sessionId);
    if (!s) return null;
    if (s.state.status === 'playing') return 'in_progress';
    const ids = s.puzzle.groups.flatMap((g) => g.productIds);
    const prices = await this.source.pricesFor(ids);
    return {
      groups: [...s.puzzle.groups]
        .sort((a, b) => a.level - b.level)
        .map((g) => ({
          level: g.level,
          titleFa: g.titleFa,
          ruleYear: g.ruleYear,
          items: g.productIds.map((id) => ({
            productId: id,
            nameFa: s.puzzle.items[id]?.nameFa ?? id,
            points: (prices[id] ?? []).map((p) => ({ year: p.year, month: p.month, priceRials: p.priceRials.toString() })),
          })),
        })),
    };
  }

  shuffle(sessionId: string): SoloView | null {
    const s = this.live(sessionId);
    if (!s) return null;
    s.state = shuffleBoard(s.state, s.rng);
    return this.toView(sessionId, s);
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

  private toView(sessionId: string, s: Session): SoloView {
    const groupByLevel = new Map(s.puzzle.groups.map((g) => [g.level, g]));
    return {
      sessionId,
      puzzleId: s.puzzle.id,
      cards: s.state.remaining.map((id) => {
        const item = s.puzzle.items[id];
        return { id, nameFa: item?.nameFa ?? id, unitFa: item?.unitFa ?? null };
      }),
      solved: s.state.solved.map((g) => {
        const full = groupByLevel.get(g.level);
        return {
          level: g.level,
          titleFa: full?.titleFa ?? '',
          explanationFa: full?.explanationFa ?? '',
          productIds: [...g.productIds],
          revealed: g.revealed,
        };
      }),
      mistakes: s.state.mistakes,
      maxMistakes: SOLO_MAX_MISTAKES,
      status: s.state.status,
    };
  }
}
