import { describe, expect, it } from 'vitest';
import { FRESH_STATE, decodeState, encodeState, parseReviewRules, reviewUrl, shouldPromptReview } from '../logic';

const DAY = 86_400_000;
const rules = parseReviewRules({ 'review.enabled': 1, 'review.package_id': 'ir.dozari.app', 'review.url_bale': 'https://ble.ir/app/dozari' });
const base = { ...FRESH_STATE(0), gamesFinished: 5 };

describe('shouldPromptReview', () => {
  it('waits for the days, the games, and is off by default', () => {
    expect(shouldPromptReview(base, parseReviewRules({}), 'bazaar', 10 * DAY)).toBe(false); // disabled
    expect(shouldPromptReview(base, rules, 'bazaar', 2 * DAY)).toBe(false); // too early
    expect(shouldPromptReview({ ...base, gamesFinished: 2 }, rules, 'bazaar', 4 * DAY)).toBe(false); // too few games
    expect(shouldPromptReview(base, rules, 'bazaar', 4 * DAY)).toBe(true);
  });
  it('needs a store build, an enabled store and a known link', () => {
    expect(shouldPromptReview(base, rules, null, 4 * DAY)).toBe(false);
    expect(shouldPromptReview(base, parseReviewRules({ 'review.enabled': 1, 'review.bazaar': 0, 'review.package_id': 'x.y' }), 'bazaar', 4 * DAY)).toBe(false);
    expect(shouldPromptReview(base, parseReviewRules({ 'review.enabled': 1 }), 'myket', 4 * DAY)).toBe(false); // no package id, no link
    expect(shouldPromptReview(base, parseReviewRules({ 'review.enabled': 1, 'review.package_id': 'x.y' }), 'bale', 4 * DAY)).toBe(false); // Bale link is never guessed
    expect(shouldPromptReview(base, rules, 'bale', 4 * DAY)).toBe(true);
  });
  it('repeats only after the pause, at most N times, and never after done', () => {
    const asked = { ...base, lastPromptAt: 4 * DAY, prompts: 1 };
    expect(shouldPromptReview(asked, rules, 'bazaar', 10 * DAY)).toBe(false);
    expect(shouldPromptReview(asked, rules, 'bazaar', 35 * DAY)).toBe(true);
    expect(shouldPromptReview({ ...asked, prompts: 3 }, rules, 'bazaar', 99 * DAY)).toBe(false);
    expect(shouldPromptReview({ ...base, done: true }, rules, 'bazaar', 99 * DAY)).toBe(false);
  });
});

describe('review urls and stored state', () => {
  it('uses the admin link, else builds Myket and Bazaar links from the package id', () => {
    expect(reviewUrl(rules, 'bale')).toBe('https://ble.ir/app/dozari');
    expect(reviewUrl(rules, 'myket')).toBe('https://myket.ir/app/ir.dozari.app');
    expect(reviewUrl(rules, 'bazaar')).toBe('https://cafebazaar.ir/app/ir.dozari.app?l=fa');
    expect(reviewUrl(parseReviewRules({ 'review.url_myket': 'javascript:alert(1)', 'review.package_id': '' }), 'myket')).toBeNull();
  });
  it('round-trips the state and ignores broken text', () => {
    const s = { firstOpenAt: 5, gamesFinished: 7, lastPromptAt: 9, prompts: 2, done: true };
    expect(decodeState(encodeState(s), 1)).toEqual(s);
    expect(decodeState(encodeState({ ...s, lastPromptAt: null }), 1).lastPromptAt).toBeNull();
    expect(decodeState('junk', 42)).toEqual(FRESH_STATE(42));
    expect(decodeState(null, 42)).toEqual(FRESH_STATE(42));
    expect(decodeState('1,2,x,4,0', 42)).toEqual(FRESH_STATE(42));
  });
});
