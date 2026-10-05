import { useEffect, useState } from 'react';
import type { TrackRulesDto } from '@dozari/shared';
import { fetchAgeTrack } from './api';

let cached: TrackRulesDto | null | undefined;

/** The player's track rules, from the server once per app run. `null` while loading, when the feature is off or when the lookup fails (everyone then plays the adult game). */
export function useTrackRules(enabled: boolean, refreshKey?: unknown): TrackRulesDto | null {
  const [rules, setRules] = useState<TrackRulesDto | null>(enabled && cached ? cached : null);
  useEffect(() => {
    if (!enabled) return;
    if (cached) return setRules(cached);
    let alive = true;
    fetchAgeTrack().then(
      (mine) => {
        cached = mine.enabled ? mine.rules : null;
        if (alive) setRules(cached);
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [enabled, refreshKey]);
  return rules;
}

/** After the player picks a track the cached rules are stale. */
export function forgetTrackRules(): void {
  cached = undefined;
}
