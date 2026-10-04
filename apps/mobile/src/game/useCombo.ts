import { useCallback, useEffect, useRef, useState } from 'react';
import { COMBO_WINDOW_SECONDS, comboAfter, comboLeft, comboStreak, NO_COMBO } from '@dozari/shared';
import type { ComboState, SubmitOutcome } from '@dozari/shared';

const WINDOW_MS = COMBO_WINDOW_SECONDS * 1000;
const TICK_MS = 250;

/** The solo combo and its timer ring: `record` after every answer from the server, `reset` for a new game. */
export function useCombo() {
  const state = useRef<ComboState>(NO_COMBO);
  const [view, setView] = useState({ streak: 0, left: 0 });
  const sync = useCallback(() => {
    const now = Date.now();
    setView((cur) => {
      const next = { streak: comboStreak(state.current, now), left: comboLeft(state.current, now, WINDOW_MS) };
      return cur.streak === next.streak && cur.left === next.left ? cur : next;
    });
  }, []);
  const record = useCallback((outcome: SubmitOutcome) => {
    state.current = comboAfter(state.current, outcome, Date.now(), WINDOW_MS);
    sync();
    return comboStreak(state.current, Date.now());
  }, [sync]);
  const reset = useCallback(() => {
    state.current = NO_COMBO;
    sync();
  }, [sync]);
  const alive = view.streak > 0;
  useEffect(() => {
    if (!alive) return undefined;
    const t = setInterval(sync, TICK_MS);
    return () => clearInterval(t);
  }, [alive, sync]);
  return { ...view, record, reset };
}
