import { describe, expect, it, vi } from 'vitest';
import { runRewardedAd } from '../runAd';
import type { AdProvider } from '../provider';

vi.mock('../api', () => ({ startAd: vi.fn(), completeAd: vi.fn() }));

const provider = (result: 'completed' | 'dismissed' | 'error' = 'completed', ready = true): AdProvider => ({ name: 't', isReady: () => ready, show: async () => ({ result }) });
const deps = (complete: ReturnType<typeof vi.fn>, start: ReturnType<typeof vi.fn> = vi.fn(async () => ({ ok: true as const, viewId: 'v1', minWatchSeconds: 10 }))) => ({ start, complete, wait: async () => undefined }) as never;

describe('runRewardedAd', () => {
  it('shows nothing and asks nothing without a ready provider', async () => {
    const start = vi.fn();
    expect(await runRewardedAd('coins_short', null, deps(vi.fn(), start))).toEqual({ ok: false, reason: 'no_provider' });
    expect(await runRewardedAd('coins_short', provider('completed', false), deps(vi.fn(), start))).toEqual({ ok: false, reason: 'not_ready' });
    expect(start).not.toHaveBeenCalled();
  });
  it('claims the reward after the ad completes', async () => {
    const complete = vi.fn(async () => ({ ok: true as const, rewardKind: 'coins', rewardAmount: 30, balance: 50, gems: 0 }));
    expect(await runRewardedAd('coins_short', provider(), deps(complete))).toMatchObject({ ok: true, rewardAmount: 30, balance: 50 });
    expect(complete).toHaveBeenCalledWith('v1', undefined);
  });
  it('does not claim when the ad is dismissed or fails', async () => {
    const complete = vi.fn();
    expect(await runRewardedAd('coins_short', provider('dismissed'), deps(complete))).toEqual({ ok: false, reason: 'dismissed' });
    expect(await runRewardedAd('coins_short', provider('error'), deps(complete))).toEqual({ ok: false, reason: 'failed' });
    expect(complete).not.toHaveBeenCalled();
  });
  it('retries a claim that comes too early, then gives up', async () => {
    const early = vi.fn(async () => ({ ok: false as const, error: 'too_early' as const }));
    expect(await runRewardedAd('coins_short', provider(), deps(early))).toEqual({ ok: false, reason: 'failed' });
    expect(early).toHaveBeenCalledTimes(3);
  });
  it('passes on a server refusal to start', async () => {
    const start = vi.fn(async () => ({ ok: false as const, error: 'capped' as const }));
    expect(await runRewardedAd('coins_short', provider(), deps(vi.fn(), start))).toEqual({ ok: false, reason: 'capped' });
  });
});
