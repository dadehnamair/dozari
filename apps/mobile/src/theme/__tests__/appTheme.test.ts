import { describe, expect, it } from 'vitest';
import { THEME_CHROME, themeOf, toneIn } from '../appTheme';

describe('themeOf', () => {
  it('only the adult track gets the adult look', () => {
    expect(themeOf('adult')).toBe('adult');
    expect(themeOf('kid')).toBe('play');
    expect(themeOf('teen')).toBe('play');
    expect(themeOf(null)).toBe('play');
  });
});

describe('toneIn', () => {
  const candy = { light: '#1', base: '#2', dark: '#3' };
  it('leaves candy colours alone in the play look', () => {
    expect(toneIn('play', '#FFC93C', candy)).toEqual({ ...candy, text: '#fff' });
  });
  it('maps candy colours to metals in the adult look', () => {
    expect(toneIn('adult', '#ffc93c', candy).base).toBe('#E8B64A');
    expect(toneIn('adult', '#FF7A3D', candy).base).toBe('#C2693A');
    expect(toneIn('adult', '#3FC1F0', candy).base).toBe('#C9CED6');
    expect(toneIn('adult', '#A66BF0', candy).base).toBe('#8A5A16');
  });
});

describe('THEME_CHROME', () => {
  it('has a manifest, icon and colour per look', () => {
    for (const t of ['play', 'adult'] as const) {
      expect(THEME_CHROME[t].manifest).toMatch(/\.webmanifest$/);
      expect(THEME_CHROME[t].themeColor).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
