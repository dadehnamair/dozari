import type { Rng } from '@dozari/shared';
import type { SettingsService } from '../settings/service.js';
import type { PuzzleAdmin } from './admin.js';

export interface PoolConfig {
  enabled: boolean;
  target: number;
}

export interface TopUpResult {
  /** Drafts already waiting for a human. */
  have: number;
  created: number;
}

/** Most puzzles made in one run: a big gap fills over a few ticks instead of one long write burst. */
export const POOL_MAX_PER_RUN = 20;

/**
 * Keeps the drafts waiting for review at `target`: the pool is only ever drafts, a human titles and approves them
 * (docs/logic/puzzle-generation.md: no puzzle goes live without an explicit approval). Nothing is made when the
 * catalog cannot yet yield valid puzzles (`created` 0).
 */
export async function topUpPuzzlePool(admin: PuzzleAdmin, cfg: PoolConfig, rng: Rng): Promise<TopUpResult> {
  const have = (await admin.counts()).draft;
  if (!cfg.enabled || have >= cfg.target) return { have, created: 0 };
  const made = await admin.generate(Math.min(cfg.target - have, POOL_MAX_PER_RUN), rng);
  return { have, created: made.created };
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
      };
      const out = await topUpPuzzlePool(opts.admin, cfg, opts.rng);
      if (out.created > 0) opts.log(`puzzles: pool had ${out.have}, made ${out.created} draft(s) for review`);
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
