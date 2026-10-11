import type { AdPlacement } from '@dozari/shared';
import { completeAd, startAd } from './api';
import type { CompleteOutcome } from './api';
import type { AdProvider } from './provider';

export type AdRun =
  | { ok: true; rewardKind: string; rewardAmount: number; balance: number; gems: number }
  | { ok: false; reason: 'no_provider' | 'not_ready' | 'disabled' | 'capped' | 'cooldown' | 'dismissed' | 'failed' | 'network' };

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

interface Deps {
  start: typeof startAd;
  complete: (viewId: string, proof?: string) => Promise<CompleteOutcome>;
  wait: (ms: number) => Promise<void>;
}

/**
 * One rewarded view: ask the server for a view, show the ad, then claim the reward. The reward is whatever the server pays;
 * a claim that comes a moment too early (the server counts from the start) is retried a couple of times.
 */
export async function runRewardedAd(placement: AdPlacement, provider: AdProvider | null, deps: Deps = { start: startAd, complete: completeAd, wait: sleep }): Promise<AdRun> {
  if (!provider) return { ok: false, reason: 'no_provider' };
  if (!provider.isReady()) return { ok: false, reason: 'not_ready' };
  const started = await deps.start(placement);
  if (!started.ok) return { ok: false, reason: started.error };
  const shown = await provider.show(placement);
  if (shown.result === 'dismissed') return { ok: false, reason: 'dismissed' };
  if (shown.result !== 'completed') return { ok: false, reason: 'failed' };
  for (let attempt = 0; attempt < 3; attempt++) {
    const done = await deps.complete(started.viewId, shown.proof);
    if (done.ok) return done;
    if (done.error === 'network') return { ok: false, reason: 'network' };
    if (done.error !== 'too_early') return { ok: false, reason: 'failed' };
    await deps.wait(Math.min(5, started.minWatchSeconds) * 1000);
  }
  return { ok: false, reason: 'failed' };
}
