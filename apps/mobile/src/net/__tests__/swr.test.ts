import { describe, expect, it } from 'vitest';
import type { KeyValueStore } from '../../auth/session';
import { createBigStore } from '../bigStore';
import { CACHE_MAX_AGE_MS, createSwr } from '../swr';

function memory(): KeyValueStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, get: async (k) => map.get(k) ?? null, set: async (k, v) => void map.set(k, v), remove: async (k) => void map.delete(k) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('bigStore', () => {
  it('round-trips a value much bigger than one piece, in pieces', async () => {
    const mem = memory();
    const big = createBigStore(mem);
    const value = 'ب'.repeat(4000) + 'x';
    await big.set('k', value);
    expect(await big.get('k')).toBe(value);
    expect([...mem.map.keys()].filter((k) => k.startsWith('k.')).length).toBeGreaterThan(2);
    expect([...mem.map.values()].every((v) => v.length <= 1500)).toBe(true);
  });

  it('drops leftover pieces when a value shrinks, and reads a broken value as null', async () => {
    const mem = memory();
    const big = createBigStore(mem);
    await big.set('k', 'a'.repeat(5000));
    await big.set('k', 'short');
    expect(await big.get('k')).toBe('short');
    expect([...mem.map.keys()].sort()).toEqual(['k.0', 'k.n']);
    mem.map.delete('k.0');
    expect(await big.get('k')).toBeNull();
    await big.remove('k');
    expect(mem.map.size).toBe(0);
  });
});

describe('swr', () => {
  const setup = (owner = 'me', now = { ms: 1000 }) => {
    const mem = memory();
    return { mem, now, swr: createSwr({ store: createBigStore(mem), owner: async () => owner, now: () => now.ms }) };
  };

  it('shows the live copy and keeps it for next time', async () => {
    const { swr, mem } = setup();
    const seen: [string, boolean][] = [];
    swr('shop', async () => 'live-1', (d, c) => seen.push([d, c]));
    await tick();
    expect(seen).toEqual([['live-1', false]]);
    expect(mem.map.size).toBeGreaterThan(0);
  });

  it('shows the cached copy first, then the live one', async () => {
    const { swr } = setup();
    swr('shop', async () => 'old', () => undefined);
    await tick();
    const seen: [string, boolean][] = [];
    swr('shop', async () => 'new', (d, c) => seen.push([d, c]));
    await tick();
    expect(seen).toEqual([['old', true], ['new', false]]);
  });

  it('stays quiet when the refresh fails but a cached copy is up; reports it when nothing is cached', async () => {
    const { swr } = setup();
    swr('shop', async () => 'old', () => undefined);
    await tick();
    const errors: unknown[] = [];
    swr('shop', async () => Promise.reject(new Error('offline')), () => undefined, (e) => errors.push(e));
    await tick();
    expect(errors).toEqual([]);
    swr('other', async () => Promise.reject(new Error('offline')), () => undefined, (e) => errors.push(e));
    await tick();
    expect(errors).toHaveLength(1);
  });

  it("never shows another account's copy, nor one past its age limit", async () => {
    const mem = memory();
    const now = { ms: 1000 };
    const mk = (owner: string) => createSwr({ store: createBigStore(mem), owner: async () => owner, now: () => now.ms });
    mk('alice')('board', async () => 'alice-board', () => undefined);
    await tick();
    const bob: [string, boolean][] = [];
    mk('bob')('board', async () => 'bob-board', (d, c) => bob.push([d, c]));
    await tick();
    expect(bob).toEqual([['bob-board', false]]);
    now.ms += CACHE_MAX_AGE_MS + 1;
    const late: [string, boolean][] = [];
    mk('bob')('board', async () => 'fresh', (d, c) => late.push([d, c]));
    await tick();
    expect(late).toEqual([['fresh', false]]);
  });

  it('delivers nothing after it is cancelled', async () => {
    const { swr } = setup();
    const seen: string[] = [];
    const cancel = swr('shop', async () => 'x', (d) => seen.push(d));
    cancel();
    await tick();
    expect(seen).toEqual([]);
  });
});
