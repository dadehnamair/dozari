import { beforeEach, describe, expect, it } from 'vitest';
import { isServerDown, onServerDown, reportServer, resetServerHealth } from '../health';

describe('server health', () => {
  beforeEach(resetServerHealth);
  it('needs two failures in a row to go down and one success to recover', () => {
    const seen: boolean[] = [];
    onServerDown((d) => seen.push(d));
    reportServer(false);
    expect(isServerDown()).toBe(false);
    reportServer(false);
    expect(isServerDown()).toBe(true);
    reportServer(false);
    reportServer(true);
    expect(isServerDown()).toBe(false);
    expect(seen).toEqual([true, false]);
  });
  it('a lone failure between successes never shows the banner', () => {
    reportServer(false);
    reportServer(true);
    reportServer(false);
    expect(isServerDown()).toBe(false);
  });
});
