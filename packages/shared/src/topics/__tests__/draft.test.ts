import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../game/rng.js';
import { applyDraftPick, draftOpen, draftTurn, expireDraftPick, startDraft } from '../draft.js';
import type { DraftState } from '../draft.js';

const pool = ['food', 'tools', 'kitchen', 'toys', 'cars'];
const rng = () => mulberry32(5);
const ok = (r: DraftState | { error: string }): DraftState => {
  if ('error' in r) throw new Error(r.error);
  return r;
};

describe('topic draft', () => {
  it('needs three rounds and enough topics', () => {
    expect(() => startDraft(pool, 2, 0, rng())).toThrow(RangeError);
    expect(() => startDraft(['a', 'b'], 3, 0, rng())).toThrow(RangeError);
  });

  it('alternates the sides and lets the system close an odd count', () => {
    let s = startDraft(pool, 3, 1, rng());
    expect(draftTurn(s)).toEqual({ round: 0, chooser: 1 });
    s = ok(applyDraftPick(s, 1, 'food', rng()));
    expect(draftTurn(s)).toEqual({ round: 1, chooser: 0 });
    s = ok(applyDraftPick(s, 0, 'tools', rng()));
    expect(s.status).toBe('done'); // round 3 was the system's
    expect(s.picks.map((p) => p.by)).toEqual([1, 0, 'system']);
    expect(new Set(s.picks.map((p) => p.topic)).size).toBe(3);
  });

  it('an even count is picked by the sides alone', () => {
    let s = startDraft(pool, 4, 0, rng());
    for (const [side, topic] of [[0, 'food'], [1, 'tools'], [0, 'toys'], [1, 'cars']] as const) s = ok(applyDraftPick(s, side, topic, rng()));
    expect(s.status).toBe('done');
    expect(s.picks.map((p) => p.by)).toEqual([0, 1, 0, 1]);
  });

  it('closes a topic once used, refuses the wrong side and unknown topics', () => {
    let s = startDraft(pool, 3, 0, rng());
    expect(applyDraftPick(s, 1, 'food', rng())).toEqual({ error: 'NOT_YOUR_PICK' });
    expect(applyDraftPick(s, 0, 'nope', rng())).toEqual({ error: 'UNKNOWN_TOPIC' });
    s = ok(applyDraftPick(s, 0, 'food', rng()));
    expect(draftOpen(s)).not.toContain('food');
    expect(applyDraftPick(s, 1, 'food', rng())).toEqual({ error: 'UNKNOWN_TOPIC' });
  });

  it('random draws an open topic; a timeout does the same for the chooser', () => {
    let s = startDraft(pool, 3, 0, rng());
    s = ok(applyDraftPick(s, 0, 'random', rng()));
    expect(s.picks[0]!.by).toBe(0);
    s = expireDraftPick(s, rng());
    expect(s.status).toBe('done');
    expect(s.picks[1]!.by).toBe('timeout');
    expect(new Set(s.picks.map((p) => p.topic)).size).toBe(3);
    expect(applyDraftPick(s, 0, 'food', rng())).toEqual({ error: 'DRAFT_DONE' });
  });
});
