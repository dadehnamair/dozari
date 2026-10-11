import { describe, expect, it } from 'vitest';
import { PuzzleHistory, pickUnseen } from '../solo/history.js';

const pool = ['p1', 'p2', 'p3'];
const source = (exclude: readonly string[]) => Promise.resolve((pool.filter((id) => !exclude.includes(id)).map((id) => ({ id }))[0]) ?? null);

describe('PuzzleHistory', () => {
  it('never serves a puzzle either player has had, and starts over only when the pool is spent', async () => {
    const h = new PuzzleHistory();
    const got: string[] = [];
    for (let i = 0; i < 3; i++) got.push((await pickUnseen(h, ['a', 'b'], [], source))!.id);
    expect(new Set(got).size).toBe(3);
    // a sees p1..p3 now; a fourth pick finds the pool dry and forgets rather than serving nothing
    expect(await pickUnseen(h, ['a', 'b'], [], source)).not.toBeNull();
  });
  it('one player\'s history keeps a puzzle from a table with someone new', async () => {
    const h = new PuzzleHistory();
    await pickUnseen(h, ['a', 'b'], [], source);
    const next = await pickUnseen(h, ['a', 'c'], [], source);
    expect(next!.id).not.toBe('p1');
  });
  it('honours ids already picked for this match', async () => {
    const h = new PuzzleHistory();
    expect((await pickUnseen(h, ['a'], ['p1', 'p2'], source))!.id).toBe('p3');
  });
  it('forgets after the ttl', () => {
    let t = 0;
    const h = new PuzzleHistory(10, 1000, () => t);
    h.mark(['a'], 'p1');
    t = 2000;
    expect(h.seen(['a'])).toEqual([]);
  });
});
