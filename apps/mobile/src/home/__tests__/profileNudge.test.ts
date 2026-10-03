import { describe, expect, it } from 'vitest';
import type { ProfileTask } from '@dozari/shared';
import { profileNudge } from '../profileNudge.js';

const t = (key: ProfileTask['key'], done: boolean, claimed = false, coins = 10): ProfileTask => ({ key, done, claimed, coins });
const all = () => true;

describe('profileNudge', () => {
  it('sends the player to the place where the first missing field is filled in', () => {
    expect(profileNudge([t('gender', false), t('city', false)], all)).toMatchObject({ task: { key: 'gender' }, action: 'profile' });
    expect(profileNudge([t('gender', true, true), t('phone', false)], all)).toMatchObject({ action: 'settings' });
    expect(profileNudge([t('bale', false)], all)).toMatchObject({ action: 'bale' });
  });
  it('offers the reward first when a finished step is waiting', () => {
    expect(profileNudge([t('gender', false), t('city', true)], all)).toMatchObject({ task: { key: 'city' }, action: 'claim' });
  });
  it('skips steps whose screen is switched off, and is null when none is left', () => {
    expect(profileNudge([t('bale', false), t('phone', false)], (k) => k !== 'bale')).toMatchObject({ task: { key: 'phone' } });
    expect(profileNudge([t('bale', false)], (k) => k !== 'bale')).toBeNull();
  });
});
