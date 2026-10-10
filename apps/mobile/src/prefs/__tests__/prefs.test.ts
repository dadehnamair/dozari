import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs, serializePrefs } from '../model';
import { SFX_NOTES } from '../../sound/engineNotes';

describe('prefs', () => {
  it('defaults when nothing or garbage is stored', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{nope')).toEqual(DEFAULT_PREFS);
  });
  it('keeps valid booleans and ignores the rest', () => {
    expect(parsePrefs('{"sound":false,"vibration":"x","reduceMotion":true}')).toEqual({ ...DEFAULT_PREFS, sound: false, reduceMotion: true });
    expect(parsePrefs(serializePrefs({ sound: false, music: false, musicVolume: 1, vibration: false, reduceMotion: true }))).toEqual({ sound: false, music: false, musicVolume: 1, vibration: false, reduceMotion: true });
  });
  it('music volume defaults below full and rejects out-of-range values', () => {
    expect(DEFAULT_PREFS.musicVolume).toBeLessThan(1);
    expect(parsePrefs('{"musicVolume":0.7}').musicVolume).toBe(0.7);
    expect(parsePrefs('{"musicVolume":3}').musicVolume).toBe(DEFAULT_PREFS.musicVolume);
    expect(parsePrefs('{"musicVolume":"loud"}').musicVolume).toBe(DEFAULT_PREFS.musicVolume);
  });
  it('every sound effect has sane notes', () => {
    for (const notes of Object.values(SFX_NOTES)) {
      expect(notes.length).toBeGreaterThan(0);
      for (const [f, s, d] of notes) {
        expect(f).toBeGreaterThan(100);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(d).toBeGreaterThan(0);
      }
    }
  });
});
