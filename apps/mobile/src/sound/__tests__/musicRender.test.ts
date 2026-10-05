import { describe, expect, it } from 'vitest';
import { MUSIC_RATE, base64, loopSeconds, renderMusic, wavDataUri } from '../musicRender';
import { MUSIC } from '../musicPattern';

describe('renderMusic', () => {
  it('renders each mood to a loop of the pattern length', () => {
    for (const mood of ['calm', 'tense'] as const) {
      const pcm = renderMusic(mood);
      expect(pcm.length).toBe(Math.round(loopSeconds(MUSIC[mood]) * MUSIC_RATE));
    }
  });

  it('is audible but never clips, and is deterministic', () => {
    const a = renderMusic('tense');
    const peak = a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(peak).toBeGreaterThan(1000);
    expect(peak).toBeLessThanOrEqual(32767);
    expect(renderMusic('tense')).toEqual(a);
  });
});

describe('wavDataUri', () => {
  it('writes a mono 16-bit RIFF header', () => {
    const uri = wavDataUri(new Int16Array([0, 1000, -1000, 5]));
    expect(uri.startsWith('data:audio/wav;base64,UklGR')).toBe(true); // "RIFF"
    const bytes = Uint8Array.from(Buffer.from(uri.split(',')[1]!, 'base64'));
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(bytes.length).toBe(44 + 8);
  });
  it('base64 matches the reference encoder for every padding length', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 10]) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 37) & 255);
      expect(base64(b)).toBe(Buffer.from(b).toString('base64'));
    }
  });
});
