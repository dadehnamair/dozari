import { NUDGE_MAX_LEVEL, NUDGE_MAX_PER_GAME, hintBlock, hintPrice } from '@dozari/shared';
import type { HintKind, HintPayload, HintRules, SoloHintResult, SoloHints } from '@dozari/shared';
import type { ShopStore } from '../economy/shop-store.js';
import type { SoloService } from './service.js';

export type HintFailure = 'not_found' | 'not_yours' | 'game_over' | 'level' | 'limit' | 'nothing_left' | 'insufficient';

/** Paid hints of a solo game: checks the rules, charges (token first, else coins) and tells the game what was revealed. */
export class HintService {
  constructor(
    private readonly solo: SoloService,
    private readonly shop: ShopStore,
    private readonly rules: () => Promise<HintRules>,
    private readonly levelOf: (userId: string) => Promise<number>,
  ) {}

  private own(sessionId: string, userId: string) {
    const st = this.solo.hintState(sessionId);
    if (!st) return 'not_found' as const;
    if (st.userId !== userId) return 'not_yours' as const;
    return st;
  }

  async options(sessionId: string, userId: string): Promise<SoloHints | HintFailure> {
    const st = this.own(sessionId, userId);
    if (typeof st === 'string') return st;
    const [rules, level, wallet] = await Promise.all([this.rules(), this.levelOf(userId), this.shop.wallet(userId)]);
    const used = st.given.length;
    return {
      options: (['group_title', 'one_card', 'pair'] as const).map((kind) => ({ kind, price: hintPrice(kind, used, rules) })),
      used,
      max: rules.maxPerGame,
      minLevel: rules.minLevel,
      level,
      balance: wallet.balance,
      tokens: wallet.tokens,
      blocked: hintBlock(level, used, rules),
      given: [...st.given],
    };
  }

  /** Free hint for level-1 players only: two cards of one unsolved group, at most `NUDGE_MAX_PER_GAME` per game. Costs nothing. */
  async nudge(sessionId: string, userId: string): Promise<{ hint: HintPayload } | HintFailure> {
    const st = this.own(sessionId, userId);
    if (typeof st === 'string') return st;
    if (!st.playing) return 'game_over';
    if ((await this.levelOf(userId)) > NUDGE_MAX_LEVEL) return 'level';
    if (st.given.length >= NUDGE_MAX_PER_GAME) return 'limit';
    const hint = this.solo.previewHint(sessionId, 'pair');
    if (!hint) return 'nothing_left';
    this.solo.recordHint(sessionId, hint);
    return { hint };
  }

  async take(sessionId: string, userId: string, kind: HintKind): Promise<SoloHintResult | HintFailure> {
    const st = this.own(sessionId, userId);
    if (typeof st === 'string') return st;
    if (!st.playing) return 'game_over';
    const [rules, level] = await Promise.all([this.rules(), this.levelOf(userId)]);
    const used = st.given.length;
    const block = hintBlock(level, used, rules);
    if (block) return block === 'LEVEL' ? 'level' : 'limit';
    const hint = this.solo.previewHint(sessionId, kind);
    if (!hint) return 'nothing_left';
    const paid = await this.shop.spendOnHint(userId, hintPrice(kind, used, rules), `${sessionId}:${used + 1}`);
    if (!paid.ok) return 'insufficient';
    this.solo.recordHint(sessionId, hint);
    return { hint, paidWith: paid.paidWith, balance: paid.balance, tokens: paid.tokens };
  }
}
