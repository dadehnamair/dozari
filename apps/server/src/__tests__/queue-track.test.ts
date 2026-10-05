import { describe, expect, it } from 'vitest';
import { DuelQueue } from '../realtime/queue.js';

describe('DuelQueue age tracks', () => {
  it('never pairs players of different tracks', () => {
    const q = new DuelQueue();
    q.join('kid1', 1, 'kid');
    q.join('adult1', 2, 'adult');
    expect(q.takePair()).toBeNull();
    q.join('kid2', 3, 'kid');
    expect(q.takePair()).toEqual(['kid1', 'kid2']);
    expect(q.has('adult1')).toBe(true);
  });

  it('pairs the longest waiters inside a track', () => {
    const q = new DuelQueue();
    q.join('a1', 1);
    q.join('t1', 2, 'teen');
    q.join('a2', 3);
    q.join('a3', 4);
    expect(q.takePair()).toEqual(['a1', 'a2']);
  });

  it('fills a 2v2 group from one track only', () => {
    const q = new DuelQueue();
    for (const [id, t] of [['k1', 'kid'], ['a1', 'adult'], ['k2', 'kid'], ['a2', 'adult'], ['k3', 'kid']] as const) q.join(id, 1, t);
    expect(q.takeGroup(4)).toBeNull();
    q.join('k4', 2, 'kid');
    expect(q.takeGroup(4)).toEqual(['k1', 'k2', 'k3', 'k4']);
  });
});
