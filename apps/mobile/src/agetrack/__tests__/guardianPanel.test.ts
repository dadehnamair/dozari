import { describe, expect, it } from 'vitest';
import { DEFAULT_GUARDIAN_SETTINGS, guardianSettingsSchema } from '@dozari/shared';
import { minutesToHour, sameSettings, withQuietHours } from '../guardianPanel';

describe('guardian panel helpers', () => {
  it('sets quiet hours the server accepts, and clears them', () => {
    const set = withQuietHours(DEFAULT_GUARDIAN_SETTINGS, 22, 7);
    expect(set).toMatchObject({ quietFrom: 1320, quietTo: 420 });
    expect(guardianSettingsSchema.safeParse(set).success).toBe(true);
    expect(withQuietHours(set, null, null)).toMatchObject({ quietFrom: null, quietTo: null });
    expect(withQuietHours(set, 5, 5)).toMatchObject({ quietFrom: null, quietTo: null }); // a zero-length window is no window
    expect(minutesToHour(1320)).toBe(22);
  });

  it('tells a changed setting from an unchanged one', () => {
    expect(sameSettings(DEFAULT_GUARDIAN_SETTINGS, { ...DEFAULT_GUARDIAN_SETTINGS })).toBe(true);
    expect(sameSettings(DEFAULT_GUARDIAN_SETTINGS, { ...DEFAULT_GUARDIAN_SETTINGS, chatMode: 'off' })).toBe(false);
  });
});
