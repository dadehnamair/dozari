import { describe, expect, it } from 'vitest';
import { SFX_NOTES } from '../engineNotes';
import type { Sfx } from '../engineNotes';
import { SFX_RATE, renderSfx } from '../sfxRender';

describe('renderSfx', () => {
  it('renders every effect audible, never clipping, and deterministically', () => {
    for (const name of Object.keys(SFX_NOTES) as Sfx[]) {
      const pcm = renderSfx(name);
      const peak = pcm.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
      expect(peak, name).toBeGreaterThan(500);
      expect(peak, name).toBeLessThanOrEqual(32767);
      expect(renderSfx(name)).toEqual(pcm);
    }
  });

  it('lasts as long as its last note', () => {
    const last = SFX_NOTES.win.reduce((m, [, s, d]) => Math.max(m, s + d), 0);
    expect(renderSfx('win').length).toBeGreaterThanOrEqual(Math.floor(last * SFX_RATE));
  });

  it('gives each click kind its own sound', () => {
    const kinds: Sfx[] = ['press', 'back', 'select', 'deselect', 'confirm'];
    const sig = kinds.map((k) => JSON.stringify(SFX_NOTES[k]));
    expect(new Set(sig).size).toBe(kinds.length);
  });
});
