import { describe, expect, it } from 'vitest';
import { SETTING_DEFS, effectiveSettings, formatSetting, parseSetting, settingDef } from '../registry.js';

describe('settings registry', () => {
  it('has unique keys and in-range defaults', () => {
    expect(new Set(SETTING_DEFS.map((d) => d.key)).size).toBe(SETTING_DEFS.length);
    for (const d of SETTING_DEFS) {
      if (d.kind === 'text') {
        expect([...(d.default as string)].length <= d.max, d.key).toBe(true);
        continue;
      }
      const values = Array.isArray(d.default) ? d.default : [d.default as number];
      for (const v of values) expect(v >= d.min && v <= d.max, d.key).toBe(true);
      if (d.kind === 'intList') expect(values.length, d.key).toBe(d.length);
    }
  });

  it('parses ints, lists and refuses out-of-range or malformed text', () => {
    const turn = settingDef('game.turn_seconds')!;
    expect(parseSetting(turn, '30')).toBe(30);
    expect(parseSetting(turn, '5')).toBeNull();
    expect(parseSetting(turn, '30.5')).toBeNull();
    expect(parseSetting(turn, '1,2')).toBeNull();
    const pts = settingDef('score.group_points')!;
    expect(parseSetting(pts, '1, 2 ,3,4')).toEqual([1, 2, 3, 4]);
    expect(parseSetting(pts, '1,2,3')).toBeNull();
    expect(formatSetting([1, 2, 3, 4])).toBe('1,2,3,4');
  });

  it('keeps short text settings, trimmed, within their length limit', () => {
    const msg = settingDef('app.maintenance_message')!;
    expect(parseSetting(msg, '  تعمیر تا ساعت ۸  ')).toBe('تعمیر تا ساعت ۸');
    expect(parseSetting(msg, 'x'.repeat(301))).toBeNull();
    expect(parseSetting(msg, 'a\nb')).toBeNull();
    expect(parseSetting(settingDef('app.update_url')!, '')).toBe('');
    expect(effectiveSettings({ 'app.update_url': 'https://cafebazaar.ir/app/x' })['app.update_url']).toBe('https://cafebazaar.ir/app/x');
  });

  it('applies overrides and ignores broken ones', () => {
    const eff = effectiveSettings({ 'game.turn_seconds': '60', 'game.solo_max_mistakes': 'abc', 'score.group_points': '2,3,4,5' });
    expect(eff['game.turn_seconds']).toBe(60);
    expect(eff['game.solo_max_mistakes']).toBe(4);
    expect(eff['score.group_points']).toEqual([2, 3, 4, 5]);
    expect(eff['bot.enabled']).toBe(1);
  });
});
