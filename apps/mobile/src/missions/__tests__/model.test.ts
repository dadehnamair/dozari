import { describe, expect, it } from 'vitest';
import type { MissionKey, ProfileTask } from '@dozari/shared';
import { missionRows } from '../model.js';

const t = (key: MissionKey, done: boolean, claimed = false, coins = 10): ProfileTask => ({ key, done, claimed, coins });
const open = { link: () => 'https://example.com', feature: () => true };

describe('missionRows', () => {
  it('puts claimable missions first and finished ones last', () => {
    const rows = missionRows([t('city', false, true), t('gender', false), t('first_win', true)], open, new Set());
    expect(rows.map((r) => [r.task.key, r.state])).toEqual([['first_win', 'claim'], ['gender', 'go'], ['city', 'claimed']]);
  });
  it('lets an honour mission be claimed only after its link was opened', () => {
    expect(missionRows([t('follow_instagram', true)], open, new Set())[0]?.state).toBe('go');
    expect(missionRows([t('follow_instagram', true)], open, new Set<MissionKey>(['follow_instagram']))[0]?.state).toBe('claim');
  });
  it('hides a link mission without a link, a switched-off screen and a mission worth nothing', () => {
    const none = { link: (k: MissionKey) => (k === 'rate_app' ? null : 'x'), feature: (k: MissionKey) => k !== 'bale' };
    const keys = missionRows([t('rate_app', true), t('bale', false), t('city', false, false, 0), t('phone', false)], none, new Set()).map((r) => r.task.key);
    expect(keys).toEqual(['phone']);
  });
  it('keeps a finished mission visible even when its link is gone', () => {
    expect(missionRows([t('rate_app', true, true)], { link: () => null, feature: () => true }, new Set())[0]?.state).toBe('claimed');
  });
});
