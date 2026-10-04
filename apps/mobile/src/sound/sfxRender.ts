import { SFX_NOTES } from './engineNotes';
import type { Sfx } from './engineNotes';

/**
 * Offline renderer of one sound effect for native (no WebAudio there): the same triangle notes and attack/decay envelope as the web
 * player in engine.ts, as 16-bit PCM. Pure and deterministic, so it is unit-tested; `nativeSfx.ts` plays the result.
 */
export const SFX_RATE = 16000;
const PEAK = 0.18;
const FLOOR = 0.0001;
const ATTACK = 0.01;

const expo = (a: number, b: number, p: number): number => a * Math.pow(b / a, Math.min(Math.max(p, 0), 1));
/** Triangle wave in -1..1 for a phase in cycles. */
const triangle = (cycles: number): number => 4 * Math.abs(cycles - Math.floor(cycles + 0.5)) - 1;

export function renderSfx(name: Sfx): Int16Array {
  const notes = SFX_NOTES[name];
  const total = notes.reduce((m, [, start, dur]) => Math.max(m, start + dur), 0) + 0.04;
  const buf = new Float32Array(Math.ceil(total * SFX_RATE));
  for (const [freq, start, dur] of notes) {
    const first = Math.floor(start * SFX_RATE);
    const n = Math.floor(dur * SFX_RATE);
    for (let i = 0; i < n; i++) {
      const t = i / SFX_RATE;
      const gain = t < ATTACK ? expo(FLOOR, PEAK, t / ATTACK) : expo(PEAK, FLOOR, (t - ATTACK) / Math.max(dur - ATTACK, 0.001));
      buf[first + i] = (buf[first + i] ?? 0) + gain * triangle(freq * t);
    }
  }
  const out = new Int16Array(buf.length);
  buf.forEach((v, i) => (out[i] = Math.round(Math.max(-1, Math.min(1, v * 2.2)) * 32767)));
  return out;
}
