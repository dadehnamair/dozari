import { describe, expect, it } from 'vitest';
import { nextProfileTask } from '../profileTasks.js';
import type { ProfileTask } from '../profileTasks.js';

const t = (key: ProfileTask['key'], done: boolean, claimed: boolean, coins = 10): ProfileTask => ({ key, done, claimed, coins });

describe('nextProfileTask', () => {
  it('points at a finished step whose reward is waiting before an unfinished one', () => {
    expect(nextProfileTask([t('gender', false, false), t('city', true, false)])?.key).toBe('city');
  });
  it('otherwise takes the first unfinished step', () => {
    expect(nextProfileTask([t('gender', true, true), t('city', false, false), t('phone', false, false)])?.key).toBe('city');
  });
  it('skips claimed steps and steps worth nothing', () => {
    expect(nextProfileTask([t('gender', true, true), t('city', false, false, 0), t('phone', false, false)])?.key).toBe('phone');
  });
  it('is null when nothing is left', () => {
    expect(nextProfileTask([t('gender', true, true)])).toBeNull();
    expect(nextProfileTask([])).toBeNull();
  });
  it('never nudges the other missions', () => {
    expect(nextProfileTask([t('first_win', true, false), t('rate_app', false, false)])).toBeNull();
  });
});
