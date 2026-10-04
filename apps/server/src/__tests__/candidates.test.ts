import { describe, expect, it } from 'vitest';
import { pickCandidates } from '../realtime/candidates.js';

const profile = async (id: string) => ({ nickname: `n-${id}`, avatarKey: 'a', level: 3, coins: 0 });
const mk = (online: string[], bots: string[]) => ({ online: () => online, bots: () => bots, profile, rng: () => 0.3 });

describe('search candidates', () => {
  it('shows online humans first, never me, and tops up with bots when few are online', async () => {
    const out = await pickCandidates(mk(['me', 'h1', 'h2'], ['b1', 'b2', 'b3']), 'me', 4);
    const names = out.map((c) => c.nickname).sort();
    expect(names).toHaveLength(4);
    expect(names).toEqual(expect.arrayContaining(['n-h1', 'n-h2']));
    expect(names).not.toContain('n-me');
    expect(names.filter((n) => n.startsWith('n-b'))).toHaveLength(2);
  });

  it('is never empty while bots exist, and does not list a bot twice or as a human', async () => {
    const out = await pickCandidates(mk(['b1'], ['b1', 'b2']), 'me', 16);
    expect(out.map((c) => c.nickname).sort()).toEqual(['n-b1', 'n-b2']);
    expect(await pickCandidates(mk([], []), 'me')).toEqual([]);
  });

  it('carries only public fields and caps at the grid size', async () => {
    const humans = Array.from({ length: 30 }, (_, i) => `h${i}`);
    const out = await pickCandidates(mk(humans, []), 'me');
    expect(out).toHaveLength(16);
    expect(Object.keys(out[0]!).sort()).toEqual(['avatarKey', 'level', 'nickname']);
  });
});
