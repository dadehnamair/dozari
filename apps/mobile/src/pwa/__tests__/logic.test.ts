import { describe, expect, it } from 'vitest';
import { INSTALL_SNOOZE_MS, installBannerDue, installModeOf, isIosAgent, launchOf } from '../logic';

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

describe('installBannerDue', () => {
  it('shows until dismissed, then again after the snooze', () => {
    expect(installBannerDue(null, 1)).toBe(true);
    expect(installBannerDue(1000, 1000 + INSTALL_SNOOZE_MS - 1)).toBe(false);
    expect(installBannerDue(1000, 1000 + INSTALL_SNOOZE_MS)).toBe(true);
  });
});
