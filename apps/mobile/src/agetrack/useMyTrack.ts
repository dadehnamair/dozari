import { useEffect, useState } from 'react';
import type { ChildLimits, TrackRulesDto } from '@dozari/shared';
import { fetchAgeTrack } from './api';

/** How often a child's app re-reads its track and the guardian's limits (a switch the guardian just changed shows up within this). */
const REFRESH_MS = 60_000;

/**
 * The player's track rules and the guardian's limits for this child. Both are `null` while loading, when the feature is off, or when a lookup fails,
 * and `null` limits mean "no limits": a failed lookup never hides anything. Re-read every minute.
 */
export function useMyTrack(enabled: boolean): { rules: TrackRulesDto | null; limits: ChildLimits | null } {
  const [state, setState] = useState<{ rules: TrackRulesDto | null; limits: ChildLimits | null }>({ rules: null, limits: null });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      fetchAgeTrack().then(
        (mine) => alive && setState({ rules: mine.enabled ? mine.rules : null, limits: mine.enabled ? (mine.limits ?? null) : null }),
        () => undefined,
      );
    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enabled]);
  return state;
}
