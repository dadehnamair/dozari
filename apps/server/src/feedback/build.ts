import type { Db } from '@dozari/db';
import { applyLedgerEntry } from '../economy/ledger.js';
import type { ProductAdmin } from '../admin/products.js';
import type { PlayerService } from '../player/service.js';
import type { SettingsService } from '../settings/service.js';
import type { SocialStore } from '../social/store.js';
import { FeedbackService } from './service.js';
import { createDbCatalogLookup, createDbFeedbackStore } from './store.js';

const RULE_KEYS = ['ugc.daily_limit', 'ugc.voter_min_games', 'ugc.approve_score', 'ugc.reject_score', 'ugc.reward_coins', 'report.daily_limit'] as const;

export interface FeedbackBuild {
  db: Db;
  settings: SettingsService;
  productAdmin: ProductAdmin;
  player?: PlayerService;
  socialStore?: SocialStore;
}

/** Wires the reports / suggestions / votes service (docs/logic/ugc.md) to the database, settings, ledger and catalog admin. */
export function buildFeedbackService({ db, settings, productAdmin, player, socialStore }: FeedbackBuild): FeedbackService {
  return new FeedbackService({
    store: createDbFeedbackStore(db),
    rules: async () => {
      const [dailyLimit, voterMinGames, approveScore, rejectScore, rewardCoins, reportDailyLimit] = await Promise.all(RULE_KEYS.map((k) => settings.num(k)));
      return { dailyLimit: dailyLimit!, voterMinGames: voterMinGames!, approveScore: approveScore!, rejectScore: rejectScore!, rewardCoins: rewardCoins!, reportDailyLimit: reportDailyLimit! };
    },
    games: async (id) => (player ? (await player.levelOf(id)).stats.games : 0),
    userExists: async (id) => !!(await socialStore?.publicRow(id)),
    products: createDbCatalogLookup(db),
    reward: (userId, id, coins) => db.transaction(async (tx) => void (await applyLedgerEntry(tx, { userId, delta: coins, reason: 'ugc_reward', refType: 'ugc', refId: id, idempotencyKey: `ugc_reward:${id}` }))),
    catalog: {
      createProduct: (p) => productAdmin.create({ slug: p.slug, nameFa: p.nameFa, category: p.category, unitFa: p.unitFa }),
      addPrice: (p) => productAdmin.addPrice({ productId: p.productId, year: p.year, month: null, priceRials: p.priceRials, sourceType: p.sourceType, sourceNote: p.sourceNote, confidence: p.confidence }),
    },
  });
}
