import { describe, expect, it, vi } from 'vitest';
import { canGoBack, pushBack, runBack, subscribeBack } from '../backStack';

describe('backStack', () => {
  it('runs the most recent handler first, then the one under it, and says false when empty', () => {
    const calls: string[] = [];
    const offPage = pushBack(() => calls.push('page'));
    const offSheet = pushBack(() => calls.push('sheet'));
    expect(runBack()).toBe(true);
    offSheet();
    expect(runBack()).toBe(true);
    offPage();
    expect(runBack()).toBe(false);
    expect(calls).toEqual(['sheet', 'page']);
  });

  it('tells subscribers when something can (not) go back', () => {
    const seen: boolean[] = [];
    const off = subscribeBack(() => seen.push(canGoBack()));
    const remove = pushBack(() => undefined);
    remove();
    off();
    expect(seen).toEqual([true, false]);
  });

  it('removes the right handler even when the same function is registered twice', () => {
    const fn = vi.fn();
    const a = pushBack(fn);
    const b = pushBack(fn);
    a();
    expect(canGoBack()).toBe(true);
    b();
    expect(canGoBack()).toBe(false);
  });
});
