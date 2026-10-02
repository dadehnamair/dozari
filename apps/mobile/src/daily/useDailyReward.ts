import { useCallback, useEffect, useState } from 'react';
import type { DailyRewardStatus } from '@dozari/shared';
import { claimDailyReward, fetchDailyReward } from './api';
import { formatCountdown } from './countdown';

export interface DailyRewardState {
  status: DailyRewardStatus | null;
  /** «۰۵:۱۲:۰۹» while the next reward is not ready, else null. */
  countdown: string | null;
  claiming: boolean;
  /** Coins won by the last claim, until `dismissWon`. */
  won: number | null;
  failed: boolean;
  claim(): void;
  /** Reads the card and balance again (e.g. after a shop purchase). */
  reload(): void;
  dismissWon(): void;
}

/** Loads the daily reward card for the guest session, ticks the countdown, and claims. */
export function useDailyReward(): DailyRewardState {
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [claiming, setClaiming] = useState(false);
  const [won, setWon] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    fetchDailyReward().then(
      (s) => {
        setStatus(s);
        setFailed(false);
      },
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);

  const waiting = status !== null && !status.canClaim && status.nextClaimAt !== null;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [waiting]);
  useEffect(() => {
    if (waiting && status?.nextClaimAt != null && now >= status.nextClaimAt) load();
  }, [waiting, status, now, load]);

  const claim = useCallback(() => {
    if (claiming) return;
    setClaiming(true);
    claimDailyReward().then(
      (r) => {
        setClaiming(false);
        if (r === 'too_early') return load();
        setWon(r.coins);
        load();
      },
      () => {
        setClaiming(false);
        setFailed(true);
      },
    );
  }, [claiming, load]);

  return {
    status,
    countdown: waiting && status?.nextClaimAt != null ? formatCountdown(status.nextClaimAt, now) : null,
    claiming,
    won,
    failed,
    claim,
    reload: load,
    dismissWon: () => setWon(null),
  };
}
