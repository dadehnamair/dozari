import type { Rng } from '@dozari/shared';
import type { SettingsService } from '../settings/service.js';
import type { PuzzleAdmin } from './admin.js';

export interface PoolConfig {
  enabled: boolean;
  target: number;
  autoApprove: boolean;
}

export interface TopUpResult {
  /** Puzzles that were already waiting (drafts, or live ones when auto-approve is on). */
  have: number;
  created: number;
  approved: number;
}

/** Most puzzles made in one run: a big gap fills over a few ticks instead of one long write burst. */
export const POOL_MAX_PER_RUN = 20;

/**
 * Keeps the puzzle pool at `target`: with auto-approve off the pool is the drafts waiting for a human to title and approve
 * (docs/logic/puzzle-generation.md: never auto-publish an un-reviewed title); with it on the pool is the live puzzles and
 * the new ones go live at once with the plain-Persian rule as their title. Nothing is made when the catalog cannot yet
 * yield valid puzzles (`created` 0).
 */
export async function topUpPuzzlePool(admin: PuzzleAdmin, cfg: PoolConfig, rng: Rng): Promise<TopUpResult> {
  const counts = await admin.counts();
  const have = cfg.autoApprove ? counts.approved : counts.draft;
  if (!cfg.enabled || have >= cfg.target) return { have, created: 0, approved: 0 };
  const made = await admin.generate(Math.min(cfg.target - have, POOL_MAX_PER_RUN), rng, { plainTitles: cfg.autoApprove });
  let approved = 0;
  if (cfg.autoApprove) for (const id of made.ids) if ((await admin.setStatus(id, 'approved')) === 'ok') approved += 1;
  return { have, created: made.created, approved };
}

export interface PoolSchedulerHandle {
  stop(): void;
}

/** In-process schedule: every `puzzles.autofill_check_minutes` (admin setting) top the pool up; a failing tick is logged and the loop goes on. */
export function startPuzzlePoolScheduler(opts: { admin: PuzzleAdmin; settings: SettingsService; rng: Rng; log: (msg: string, err?: unknown) => void; setTimer?: typeof setTimeout }): PoolSchedulerHandle {
  const setTimer = opts.setTimer ?? setTimeout;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = async () => {
    let minutes = 60;
    try {
      minutes = await opts.settings.num('puzzles.autofill_check_minutes');
      const cfg: PoolConfig = {
        enabled: (await opts.settings.num('puzzles.autofill_enabled')) === 1,
        target: await opts.settings.num('puzzles.autofill_target'),
        autoApprove: (await opts.settings.num('puzzles.autofill_auto_approve')) === 1,
      };
      const out = await topUpPuzzlePool(opts.admin, cfg, opts.rng);
      if (out.created > 0) opts.log(`puzzles: pool had ${out.have}, made ${out.created}${cfg.autoApprove ? `, published ${out.approved}` : ' draft(s) for review'}`);
    } catch (err) {
      opts.log('puzzles: pool top-up failed', err);
    }
    if (!stopped) timer = setTimer(() => void tick(), minutes * 60_000);
  };
  // First look shortly after boot, so a freshly deployed server does not wait a full interval.
  timer = setTimer(() => void tick(), 45_000);
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
