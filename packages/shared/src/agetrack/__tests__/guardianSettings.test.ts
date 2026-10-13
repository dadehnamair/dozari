import { describe, expect, it } from 'vitest';
import { DEFAULT_GUARDIAN_SETTINGS, guardianSettingsSchema, inQuietHours } from '../guardianSettings.js';

describe('guardian settings', () => {
  it('the open defaults are valid', () => {
    expect(guardianSettingsSchema.safeParse(DEFAULT_GUARDIAN_SETTINGS).success).toBe(true);
  });

  it('quiet hours are a pair, with a real window', () => {
    const ok = { ...DEFAULT_GUARDIAN_SETTINGS, quietFrom: 1320, quietTo: 420 };
    expect(guardianSettingsSchema.safeParse(ok).success).toBe(true);
    expect(guardianSettingsSchema.safeParse({ ...ok, quietTo: null }).success).toBe(false);
    expect(guardianSettingsSchema.safeParse({ ...ok, quietFrom: 600, quietTo: 600 }).success).toBe(false);
    expect(guardianSettingsSchema.safeParse({ ...ok, quietFrom: 1440 }).success).toBe(false);
  });

  it('the reminder must be one of the offered choices', () => {
    expect(guardianSettingsSchema.safeParse({ ...DEFAULT_GUARDIAN_SETTINGS, reminderMinutes: 30 }).success).toBe(true);
    expect(guardianSettingsSchema.safeParse({ ...DEFAULT_GUARDIAN_SETTINGS, reminderMinutes: 7 }).success).toBe(false);
  });

  it('finds the quiet window, also across midnight', () => {
    const day = { quietFrom: 13 * 60, quietTo: 15 * 60 };
    expect(inQuietHours(day, 14 * 60)).toBe(true);
    expect(inQuietHours(day, 15 * 60)).toBe(false); // the end is not included
    const night = { quietFrom: 22 * 60, quietTo: 7 * 60 };
    expect(inQuietHours(night, 23 * 60)).toBe(true);
    expect(inQuietHours(night, 3 * 60)).toBe(true);
    expect(inQuietHours(night, 12 * 60)).toBe(false);
    expect(inQuietHours({ quietFrom: null, quietTo: null }, 100)).toBe(false);
  });
});

describe('guardian code schemas read Persian digits', () => {
  it('turns Persian and Arabic digits into Latin ones', async () => {
    const { childLinkRequestSchema, guardianConfirmCodeSchema } = await import('../guardian.js');
    expect(childLinkRequestSchema.parse({ code: '۱۲۳۴۵۶', deviceId: 'device-123' }).code).toBe('123456');
    expect(guardianConfirmCodeSchema.parse({ code: '٤٥٦٧٨' }).code).toBe('45678');
    expect(childLinkRequestSchema.safeParse({ code: '۱۲۳', deviceId: 'device-123' }).success).toBe(false);
  });
});
