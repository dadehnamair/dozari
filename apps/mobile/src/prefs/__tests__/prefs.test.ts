import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs, serializePrefs } from '../model';
import { SFX_NOTES } from '../../sound/engineNotes';

describe('prefs', () => {
  it('defaults when nothing or garbage is stored', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs('{nope')).toEqual(DEFAULT_PREFS);
  });
  it('keeps valid booleans and ignores the rest', () => {
    expect(parsePrefs('{"sound":false,"vibration":"x","reduceMotion":true}')).toEqual({ sound: false, music: true, vibration: true, reduceMotion: true });
    expect(parsePrefs(serializePrefs({ sound: false, music: false, vibration: false, reduceMotion: true }))).toEqual({ sound: false, music: false, vibration: false, reduceMotion: true });
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
