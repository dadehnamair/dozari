import { backDepth, runBack, subscribeBack } from './backStack';

/** The part of `window` this needs; a plain object stands in for it in tests. */
export interface HistoryWindow {
  history: { pushState(state: unknown, title: string, url?: string): void; go(delta: number): void };
  addEventListener(type: 'popstate', fn: (e: { state?: unknown }) => void): void;
  removeEventListener(type: 'popstate', fn: (e: { state?: unknown }) => void): void;
}

const levelOf = (state: unknown): number => {
  const n = (state as { dzBack?: unknown } | null | undefined)?.dzBack;
  return typeof n === 'number' ? n : 0;
};

/**
 * Makes the browser's (and an installed PWA's) back and forward buttons drive the same stack as the phone's back button:
 * every open page or sheet owns one history entry, so Back closes the top one instead of leaving the app, and closing one
 * with the on-screen button takes its entry away again. Forward does nothing (a closed sheet is not reopened). With nothing
 * open, Back leaves the app as the browser normally does. Returns the function that removes it.
 */
export function installWebHistory(win: HistoryWindow): () => void {
  /** History entries pushed by us, i.e. the level the current entry stands for. */
  let level = 0;
  /** Popstates caused by our own `go()`, to be ignored. */
  let skip = 0;

  const sync = () => {
    const depth = backDepth();
    while (level < depth) win.history.pushState({ dzBack: ++level }, '');
    if (level > depth) {
      const undo = level - depth;
      level = depth;
      skip++;
      win.history.go(-undo);
    }
  };

  const onPop = (e: { state?: unknown }) => {
    if (skip > 0) {
      skip--;
      return;
    }
    const to = levelOf(e.state);
    if (to > level) {
      // Forward onto an entry whose sheet is gone: step straight back.
      const undo = to - level;
      skip++;
      win.history.go(-undo);
      return;
    }
    level = to;
    // Back: close what that entry stood for. A handler that keeps its sheet open gets its entry pushed again by `sync`.
    if (backDepth() > level) runBack();
    sync();
  };

  win.addEventListener('popstate', onPop);
  const off = subscribeBack(sync);
  sync();
  return () => {
    off();
    win.removeEventListener('popstate', onPop);
  };
}
