import { AD_PLACEMENTS, AD_PLACEMENT_DEFAULTS } from '@dozari/shared';
import type { AdPlacement, AdPlacementConfig } from '@dozari/shared';
import { adPlacements, adViews, and, desc, eq, sql, userBalances, userGems, userInventory, wheelSpins } from '@dozari/db';
import type { Db } from '@dozari/db';
import { uuidv7 } from 'uuidv7';
import { applyGemEntry } from '../economy/gems.js';
import { applyLedgerEntry } from '../economy/ledger.js';
import type { AdPaid, AdPlacementRow, AdsStore } from './service.js';

const toRow = (placement: AdPlacement, r: AdPlacementConfig): AdPlacementRow => ({ placement, enabled: r.enabled, rewardKind: r.rewardKind, rewardAmount: r.rewardAmount, dailyCap: r.dailyCap, cooldownSeconds: r.cooldownSeconds, minWatchSeconds: r.minWatchSeconds });

export function createDbAdsStore(db: Db): AdsStore {
  return {
    async placements() {
      const rows = await db.select().from(adPlacements);
      const missing = AD_PLACEMENTS.filter((p) => !rows.some((r) => r.placement === p));
      // Create the rows that do not exist yet, so the admin panel edits real rows (all start switched off).
      for (const p of missing) await db.insert(adPlacements).ignore().values({ placement: p, ...AD_PLACEMENT_DEFAULTS[p] });
      const all = missing.length > 0 ? await db.select().from(adPlacements) : rows;
      return AD_PLACEMENTS.flatMap((p) => {
        const r = all.find((x) => x.placement === p);
        return r ? [toRow(p, r)] : [];
      });
    },
    async updatePlacement(placement, patch) {
      if (!(AD_PLACEMENTS as readonly string[]).includes(placement)) return 'not_found';
      await db.insert(adPlacements).ignore().values({ placement, ...AD_PLACEMENT_DEFAULTS[placement] });
      await db.update(adPlacements).set(patch).where(eq(adPlacements.placement, placement));
      return 'ok';
    },
    async usage(userId, placement, day) {
      const [n] = await db
        .select({ n: sql<number>`COUNT(*)` })
        .from(adViews)
        .where(and(eq(adViews.userId, userId), eq(adViews.placement, placement), eq(adViews.day, day), eq(adViews.status, 'rewarded')));
      const [last] = await db.select({ at: adViews.startedAt }).from(adViews).where(and(eq(adViews.userId, userId), eq(adViews.placement, placement))).orderBy(desc(adViews.startedAt)).limit(1);
      return { rewardedToday: Number(n?.n ?? 0), lastStartedAt: last ? last.at.getTime() : null };
    },
    async start(userId, placement, day, cfg, at) {
      const id = uuidv7();
      await db.insert(adViews).values({ id, userId, placement, day, status: 'started', rewardKind: cfg.rewardKind, rewardAmount: cfg.rewardAmount, minWatchSeconds: cfg.minWatchSeconds, startedAt: new Date(at) });
      return id;
    },
    claim: (userId, viewId, proof, at, maxAgeMs) =>
      db.transaction(async (tx) => {
        const [v] = await tx.select().from(adViews).where(and(eq(adViews.id, viewId), eq(adViews.userId, userId))).for('update');
        if (!v) return { ok: false as const, error: 'not_found' as const };
        if (v.status !== 'started') return { ok: false as const, error: 'already' as const };
        const age = at - v.startedAt.getTime();
        if (age < v.minWatchSeconds * 1000) return { ok: false as const, error: 'too_early' as const };
        if (age > maxAgeMs) return { ok: false as const, error: 'expired' as const };
        await tx.update(adViews).set({ status: 'rewarded', rewardedAt: new Date(at), proof }).where(eq(adViews.id, viewId));
        const key = `ad_reward:${viewId}`;
        if (v.rewardKind === 'coins') await applyLedgerEntry(tx, { userId, delta: v.rewardAmount, reason: 'ad_reward', refType: 'ad', refId: viewId, idempotencyKey: key });
        else if (v.rewardKind === 'gems') await applyGemEntry(tx, { userId, delta: v.rewardAmount, reason: 'ad_reward', refType: 'ad', refId: viewId, idempotencyKey: key });
        else if (v.rewardKind === 'hint_token') await tx.insert(userInventory).values({ userId, effect: 'hint_token', qty: v.rewardAmount }).onDuplicateKeyUpdate({ set: { qty: sql`${userInventory.qty} + ${v.rewardAmount}` } });
        else for (let i = 0; i < v.rewardAmount; i++) await tx.insert(wheelSpins).ignore().values({ id: uuidv7(), userId, source: 'ad', ref: `${viewId}#${i}` });
        const [bal] = await tx.select({ b: userBalances.balance }).from(userBalances).where(eq(userBalances.userId, userId));
        const [gem] = await tx.select({ b: userGems.balance }).from(userGems).where(eq(userGems.userId, userId));
        const paid: AdPaid = { rewardKind: v.rewardKind, rewardAmount: v.rewardAmount, balance: bal?.b ?? 0, gems: gem?.b ?? 0 };
        return { ok: true as const, paid };
      }),
  };
}

/** In-memory twin for tests. */
export function createMemoryAdsStore(): AdsStore & { balances: Map<string, number>; gemBalances: Map<string, number>; tokens: Map<string, number>; spins: Map<string, number> } {
  const table = new Map<AdPlacement, AdPlacementConfig>(AD_PLACEMENTS.map((p) => [p, { ...AD_PLACEMENT_DEFAULTS[p] }]));
  const views: { id: string; userId: string; placement: AdPlacement; day: string; status: 'started' | 'rewarded'; cfg: AdPlacementConfig; at: number }[] = [];
  const balances = new Map<string, number>();
  const gemBalances = new Map<string, number>();
  const tokens = new Map<string, number>();
  const spins = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, n: number) => m.set(k, (m.get(k) ?? 0) + n);
  return {
    balances,
    gemBalances,
    tokens,
    spins,
    async placements() {
      return AD_PLACEMENTS.map((p) => toRow(p, table.get(p)!));
    },
    async updatePlacement(placement, patch) {
      const cur = table.get(placement);
      if (!cur) return 'not_found';
      table.set(placement, { ...cur, ...patch });
      return 'ok';
    },
    async usage(userId, placement, day) {
      const mine = views.filter((v) => v.userId === userId && v.placement === placement);
      return { rewardedToday: mine.filter((v) => v.day === day && v.status === 'rewarded').length, lastStartedAt: mine.length ? Math.max(...mine.map((v) => v.at)) : null };
    },
    async start(userId, placement, day, cfg, at) {
      const id = `view-${views.length + 1}`;
      views.push({ id, userId, placement, day, status: 'started', cfg: { ...cfg }, at });
      return id;
    },
    async claim(userId, viewId, _proof, at, maxAgeMs) {
      const v = views.find((x) => x.id === viewId && x.userId === userId);
      if (!v) return { ok: false, error: 'not_found' };
      if (v.status !== 'started') return { ok: false, error: 'already' };
      const age = at - v.at;
      if (age < v.cfg.minWatchSeconds * 1000) return { ok: false, error: 'too_early' };
      if (age > maxAgeMs) return { ok: false, error: 'expired' };
      v.status = 'rewarded';
      const { rewardKind, rewardAmount } = v.cfg;
      if (rewardKind === 'coins') add(balances, userId, rewardAmount);
      else if (rewardKind === 'gems') add(gemBalances, userId, rewardAmount);
      else if (rewardKind === 'hint_token') add(tokens, userId, rewardAmount);
      else add(spins, userId, rewardAmount);
      return { ok: true, paid: { rewardKind, rewardAmount, balance: balances.get(userId) ?? 0, gems: gemBalances.get(userId) ?? 0 } };
    },
  };
}
