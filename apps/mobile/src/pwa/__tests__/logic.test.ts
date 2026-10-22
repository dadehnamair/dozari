import { describe, expect, it } from 'vitest';
import { INSTALL_SNOOZE_MS, installBannerDue, installModeOf, isIosAgent, inviteLaunchOf, launchOf, tableLaunchOf } from '../logic';

describe('installModeOf', () => {
  const base = { web: true, standalone: false, hasPrompt: false, ios: false };
  it('uses the browser prompt when there is one', () => expect(installModeOf({ ...base, hasPrompt: true })).toBe('prompt'));
  it('shows the manual steps on iPhone', () => expect(installModeOf({ ...base, ios: true })).toBe('ios'));
  it('offers nothing once installed, on native, or without a way to install', () => {
    expect(installModeOf({ ...base, hasPrompt: true, standalone: true })).toBe('none');
    expect(installModeOf({ ...base, web: false, hasPrompt: true })).toBe('none');
    expect(installModeOf(base)).toBe('none');
  });
});

describe('isIosAgent', () => {
  it('knows iPhones and touch Macs (iPadOS)', () => {
    expect(isIosAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 5)).toBe(true);
    expect(isIosAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIosAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIosAgent('Mozilla/5.0 (Linux; Android 14)', 5)).toBe(false);
  });
});

describe('launchOf', () => {
  it('picks a known target and strips the PWA-only parameters', () => {
    expect(launchOf('?go=daily&source=pwa')).toEqual({ target: 'daily', rest: '' });
    expect(launchOf('?source=pwa&table=AB12')).toEqual({ target: null, rest: '?table=AB12' });
  });
  it('ignores unknown targets', () => expect(launchOf('?go=admin').target).toBeNull());
});

describe('tableLaunchOf', () => {
  it('reads a valid shared table code and strips the launch parameters', () => {
    expect(tableLaunchOf('?go=table&code=AB2CD')).toEqual({ code: 'AB2CD', rest: '' });
    expect(tableLaunchOf('?go=table&code=ab2cd&x=1')).toEqual({ code: 'AB2CD', rest: '?x=1' });
  });
  it('refuses a malformed code and leaves other links alone', () => {
    expect(tableLaunchOf('?go=table&code=AB1CD').code).toBeNull(); // 1 is not in the alphabet
    expect(tableLaunchOf('?go=table&code=ABC').code).toBeNull();
    expect(tableLaunchOf('?go=daily')).toEqual({ code: null, rest: '?go=daily' });
  });
});

describe('inviteLaunchOf', () => {
  it('reads a friend\'s public ID, uppercases it and strips the launch parameters', () => {
    expect(inviteLaunchOf('?go=invite&code=ab2cd3e')).toEqual({ handle: 'AB2CD3E', rest: '' });
    expect(inviteLaunchOf('?go=invite&code=AB2CD3E&x=1')).toEqual({ handle: 'AB2CD3E', rest: '?x=1' });
  });
  it('refuses a malformed ID and leaves other links alone', () => {
    expect(inviteLaunchOf('?go=invite&code=a/b').handle).toBeNull();
    expect(inviteLaunchOf('?go=table&code=AB2CD')).toEqual({ handle: null, rest: '?go=table&code=AB2CD' });
  });
});

describe('installBannerDue', () => {
  it('shows until dismissed, then again after the snooze', () => {
    expect(installBannerDue(null, 1)).toBe(true);
    expect(installBannerDue(1000, 1000 + INSTALL_SNOOZE_MS - 1)).toBe(false);
    expect(installBannerDue(1000, 1000 + INSTALL_SNOOZE_MS)).toBe(true);
  });
});
