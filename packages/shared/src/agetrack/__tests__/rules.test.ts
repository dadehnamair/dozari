import { describe, expect, it } from 'vitest';
import { AGE_TRACKS } from '../../config/ageTracks.js';
import { canMeet, canSelfSwitchTrack, isAgeTrack, parseAgeTrack, trackRuleForPath, trackRules } from '../rules.js';

describe('trackRules', () => {
  it('keeps the hard walls for kid and teen', () => {
    for (const t of ['kid', 'teen'] as const) {
      const r = trackRules(t);
      expect(r.coinWager).toBe(false);
      expect(r.purchases).toBe(false);
      expect(r.ugc).toBe(false);
      expect(r.publicCity).toBe(false);
      expect(r.socialSameTrackOnly).toBe(true);
      expect(r.socialNeedsGuardian).toBe(true);
      expect(r.coinWager).toBe(false);
      expect(r.tournaments).toBe(false);
      expect(r.transfers).toBe(false);
      expect(r.inviteShare).toBe(false);
      expect(r.freeTextChat).toBe('guardian_switch');
    }
  });
  it('leaves the adult game whole', () => {
    const r = trackRules('adult');
    expect(r).toMatchObject({ priceGuess: true, coinWager: true, wordLesson: false, freeTextChat: 'invite_code', purchases: true });
  });
  it('only the kid track has the word lesson and no price round', () => {
    expect(trackRules('kid')).toMatchObject({ wordLesson: true, priceGuess: false, dailyPuzzle: false, priceOnly: false, lookup: false });
    expect(trackRules('adult')).toMatchObject({ dailyPuzzle: true, priceOnly: true, lookup: true });
    expect(trackRules('teen').wordLesson).toBe(false);
  });
  it('serves each track from its own puzzle pool', () => {
    for (const t of AGE_TRACKS) expect(trackRules(t).puzzleTracks).toContain(t);
    expect(trackRules('kid').puzzleTracks).not.toContain('adult');
  });
});

describe('track helpers', () => {
  it('parses unknown values as adult', () => {
    expect(parseAgeTrack('kid')).toBe('kid');
    expect(parseAgeTrack('baby')).toBe('adult');
    expect(parseAgeTrack(undefined)).toBe('adult');
    expect(isAgeTrack(3)).toBe(false);
  });
  it('lets a player move to the same or a younger track, never older', () => {
    expect(canSelfSwitchTrack('adult', 'kid')).toBe(true);
    expect(canSelfSwitchTrack('teen', 'teen')).toBe(true);
    expect(canSelfSwitchTrack('kid', 'teen')).toBe(false);
    expect(canSelfSwitchTrack('teen', 'adult')).toBe(false);
  });
  it('lets only the same track meet', () => {
    expect(canMeet('kid', 'kid')).toBe(true);
    expect(canMeet('kid', 'teen')).toBe(false);
    expect(canMeet('teen', 'adult')).toBe(false);
  });
});

describe('trackRuleForPath', () => {
  it('names the rule a path needs, and nothing for open paths', () => {
    expect(trackRuleForPath('/coin-packages')).toBe('purchases');
    expect(trackRuleForPath('/coin-packages/abc/redeem')).toBe('purchases');
    expect(trackRuleForPath('/shop-pay/x')).toBe('purchases');
    expect(trackRuleForPath('/ugc/submissions')).toBe('ugc');
    expect(trackRuleForPath('/tournaments/1/join')).toBe('tournaments');
    expect(trackRuleForPath('/daily-puzzle')).toBe('dailyPuzzle');
    expect(trackRuleForPath('/lookup/search')).toBe('lookup');
    expect(trackRuleForPath('/transfers')).toBe('transfers');
    expect(trackRuleForPath('/loans/abc/repay')).toBe('transfers');
    expect(trackRuleForPath('/friends/abc/gift')).toBe('transfers');
    expect(trackRuleForPath('/friends/abc/loan')).toBe('transfers');
    expect(trackRuleForPath('/friends/abc/request')).toBeNull(); // friend requests are not walled by this rule
    expect(trackRuleForPath('/shop')).toBeNull(); // the coin shop (gems and hints) stays open: only real money is walled
    expect(trackRuleForPath('/solo/start')).toBeNull();
    expect(trackRuleForPath('/coin-packagesX')).toBeNull();
  });

  it('a kid cannot reach what the path rules wall off, an adult can reach all of it', () => {
    const paths = ['/coin-packages', '/shop-pay', '/ugc/feed', '/tournaments', '/daily-puzzle', '/lookup/1'];
    for (const path of paths) {
      const rule = trackRuleForPath(path)!;
      expect(trackRules('adult')[rule]).toBe(true);
      if (rule !== 'priceOnly') expect(trackRules('kid')[rule]).toBe(false);
    }
  });
});

describe('publicProfile depth', () => {
  it('shows a kid the least, a teen the record, an adult everything', () => {
    expect(trackRules('kid').publicProfile).toBe('basic');
    expect(trackRules('teen').publicProfile).toBe('stats');
    expect(trackRules('adult').publicProfile).toBe('full');
  });
});
