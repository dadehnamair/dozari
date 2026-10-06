import { beforeEach, describe, expect, it, vi } from 'vitest';

const call = vi.fn();
vi.mock('../../auth', () => ({ session: { authed: (fn: (t: string) => Promise<unknown>) => fn('token') } }));
vi.mock('../../net/http', () => ({ callJson: (...args: unknown[]) => call(...args) }));

import { ageTrackNeeded } from '../api';

const rules = { priceGuess: true, coinWager: true, wordLesson: false, freeTextChat: 'invite_code', socialSameTrackOnly: false, socialNeedsGuardian: false, purchases: true, ugc: true, tournaments: true, transfers: true, inviteShare: true, publicProfile: 'full', publicCity: true, dailyPuzzle: true, priceOnly: true, lookup: true, puzzleTracks: ['adult'], tauntTrack: 'adult' };

describe('ageTrackNeeded', () => {
  beforeEach(() => call.mockReset());

  it('does not even ask the server while the feature switch is off', async () => {
    expect(await ageTrackNeeded({ 'feature.age_tracks': 0 })).toBe(false);
    expect(await ageTrackNeeded({})).toBe(false);
    expect(call).not.toHaveBeenCalled();
  });

  it('shows the screen once: when enabled and never chosen', async () => {
    call.mockResolvedValueOnce({ enabled: true, track: 'adult', chosen: false, rules });
    expect(await ageTrackNeeded({ 'feature.age_tracks': 1 })).toBe(true);
    call.mockResolvedValueOnce({ enabled: true, track: 'kid', chosen: true, rules });
    expect(await ageTrackNeeded({ 'feature.age_tracks': 1 })).toBe(false);
  });

  it('never blocks the game when the server fails', async () => {
    call.mockRejectedValueOnce(new Error('offline'));
    expect(await ageTrackNeeded({ 'feature.age_tracks': 1 })).toBe(false);
  });
});
