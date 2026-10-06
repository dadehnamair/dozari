import { describe, expect, it } from 'vitest';
import { pushBack } from '../backStack';
import { installWebHistory } from '../webHistory';
import type { HistoryWindow } from '../webHistory';

/** A tiny browser: a list of entries, an index, and popstate fired after `go()` like a real one (asynchronously ignored here: synchronous is enough). */
function fakeBrowser() {
  const entries: unknown[] = [null];
  let at = 0;
  let pop: ((e: { state?: unknown }) => void) | null = null;
  const win: HistoryWindow = {
    history: {
      pushState: (s) => {
        entries.splice(at + 1);
        entries.push(s);
        at++;
      },
      go: (d) => {
        at += d;
        pop?.({ state: entries[at] });
      },
    },
    addEventListener: (_t, fn) => (pop = fn),
    removeEventListener: () => (pop = null),
  };
  const press = (d: number) => win.history.go(d);
  return { win, press, at: () => at };
}

describe('webHistory', () => {
  it('Back closes the open sheet instead of leaving, one entry per open page or sheet', () => {
    const b = fakeBrowser();
    const off = installWebHistory(b.win);
    const closed: string[] = [];
    let offPage = () => undefined as void;
    let offSheet = () => undefined as void;
    offPage = pushBack(() => (closed.push('page'), offPage()));
    offSheet = pushBack(() => (closed.push('sheet'), offSheet()));
    expect(b.at()).toBe(2);
    b.press(-1);
    expect(closed).toEqual(['sheet']);
    expect(b.at()).toBe(1);
    b.press(-1);
    expect(closed).toEqual(['sheet', 'page']);
    expect(b.at()).toBe(0);
    off();
  });

  it('closing with the on-screen button takes its history entry away', () => {
    const b = fakeBrowser();
    const off = installWebHistory(b.win);
    const close = pushBack(() => undefined);
    expect(b.at()).toBe(1);
    close();
    expect(b.at()).toBe(0);
    off();
  });

  it('Forward onto a closed sheet does nothing', () => {
    const b = fakeBrowser();
    const off = installWebHistory(b.win);
    let close = () => undefined as void;
    close = pushBack(() => close());
    b.press(-1);
    expect(b.at()).toBe(0);
    b.press(1);
    expect(b.at()).toBe(0);
    off();
  });

  it('a sheet that stays open on Back gets its entry back', () => {
    const b = fakeBrowser();
    const off = installWebHistory(b.win);
    const stay = pushBack(() => undefined);
    b.press(-1);
    expect(b.at()).toBe(1);
    stay();
    off();
  });
});
