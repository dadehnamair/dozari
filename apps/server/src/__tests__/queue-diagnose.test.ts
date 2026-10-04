import { describe, expect, it } from 'vitest';
import { createQueueDiagnosis } from '../realtime/diagnose.js';

describe('queue diagnosis', () => {
  it('reports a missing puzzle at once, and a missing bot only after the grace period', async () => {
    let clock = 0;
    let puzzle = false;
    let bots = false;
    const diagnose = createQueueDiagnosis({ hasPuzzle: async () => puzzle, botsReady: () => bots, graceSec: 20, now: () => clock, cacheMs: 1000 });
    expect(await diagnose(0)).toBe('no_puzzles');
    puzzle = true;
    clock += 2000;
    expect(await diagnose(5)).toBeNull();
    expect(await diagnose(25)).toBe('no_bots');
    bots = true;
    expect(await diagnose(25)).toBeNull();
  });

  it('looks puzzles up once per cache window', async () => {
    let calls = 0;
    let clock = 0;
    const diagnose = createQueueDiagnosis({ hasPuzzle: async () => (calls++, true), botsReady: () => true, graceSec: 20, now: () => clock, cacheMs: 5000 });
    await diagnose(0);
    await diagnose(1);
    clock += 6000;
    await diagnose(7);
    expect(calls).toBe(2);
  });
});
