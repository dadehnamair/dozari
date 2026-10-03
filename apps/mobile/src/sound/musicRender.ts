import { MUSIC, stepSeconds } from './musicPattern';
import type { DrumHit, Mood, MusicPattern } from './musicPattern';

/**
 * Offline renderer of the background music for native (no WebAudio there): the same voices as the web player in music.ts,
 * a plucked string, a slow drone and a frame drum, summed into one loop with a short echo and a soft low-pass.
 * Pure and deterministic (the drum noise is a fixed LCG), so it is unit-tested; the loop is seamless because every voice
 * wraps around the end of the buffer.
 */

export const MUSIC_RATE = 16000;
const TAU = Math.PI * 2;
const FLOOR = 0.0001;

/** Exponential ramp value between two levels (WebAudio's exponentialRampToValueAtTime shape). */
const expo = (a: number, b: number, p: number): number => a * Math.pow(b / a, Math.min(Math.max(p, 0), 1));

/** Seconds of one full pass of the pattern. */
export function loopSeconds(p: MusicPattern): number {
  return p.lead.length * stepSeconds(p);
}

/** Adds one voice into `buf`, wrapping past the end. `gainAt(t)` is the envelope, `sample(t, i)` the oscillator. */
function voice(buf: Float32Array, start: number, seconds: number, gainAt: (t: number) => number, osc: (t: number, i: number) => number) {
  const n = Math.floor(seconds * MUSIC_RATE);
  const first = Math.floor(start * MUSIC_RATE);
  for (let i = 0; i < n; i++) {
    const t = i / MUSIC_RATE;
    const at = (first + i) % buf.length;
    buf[at] = (buf[at] ?? 0) + gainAt(t) * osc(t, i);
  }
}

/** A plucked string: four decaying harmonics with a tiny pitch settle on the attack. */
function pluck(buf: Float32Array, freq: number, at: number, dur: number, gain: number) {
  for (const [mult, rel, decay] of [[1, 1, 1], [2, 0.42, 0.6], [3, 0.18, 0.4], [4, 0.07, 0.25]] as const) {
    const len = dur * decay;
    const peak = gain * rel;
    let phase = 0;
    voice(
      buf,
      at,
      len,
      (t) => (t < 0.008 ? expo(FLOOR, peak, t / 0.008) : expo(peak, FLOOR, (t - 0.008) / (len - 0.008))),
      (t) => {
        phase += (TAU * freq * mult * (t < 0.06 ? Math.pow(1.012, 1 - t / 0.06) : 1)) / MUSIC_RATE;
        return Math.sin(phase);
      },
    );
  }
}

/** A long, soft drone note with a slow swell. */
function pad(buf: Float32Array, freq: number, at: number, dur: number, gain: number) {
  voice(
    buf,
    at,
    dur,
    (t) => (t < dur * 0.35 ? expo(FLOOR, gain, t / (dur * 0.35)) : expo(gain, FLOOR, (t - dur * 0.35) / (dur * 0.65))),
    (t) => Math.sin(TAU * freq * t),
  );
}

/** RBJ band-pass (constant 0 dB peak), as WebAudio's `bandpass`. */
function bandpass(input: Float32Array, freq: number, q: number): Float32Array {
  const w0 = (TAU * freq) / MUSIC_RATE;
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  const b0 = alpha / a0, b2 = -alpha / a0, a1 = (-2 * Math.cos(w0)) / a0, a2 = (1 - alpha) / a0;
  const out = new Float32Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i] ?? 0;
    const y = b0 * x + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    out[i] = y;
  }
  return out;
}

/** A frame-drum stroke: filtered noise, deep (`d`) or bright and short (`t`). */
function drum(buf: Float32Array, hit: Exclude<DrumHit, ''>, at: number, gain: number, noise: Float32Array) {
  const len = hit === 'd' ? 0.16 : 0.06;
  const n = Math.floor(len * MUSIC_RATE);
  const band = bandpass(noise.subarray(0, n), hit === 'd' ? 170 : 2300, hit === 'd' ? 1.1 : 2.2);
  const peak = gain * (hit === 'd' ? 2.2 : 0.8);
  voice(buf, at, len, (t) => (t < 0.004 ? expo(FLOOR, peak, t / 0.004) : expo(peak, FLOOR, (t - 0.004) / (len - 0.004))), (_t, i) => band[i] ?? 0);
}

/** Deterministic white noise in [-1, 1). */
function whiteNoise(n: number): Float32Array {
  const out = new Float32Array(n);
  let s = 12345;
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    out[i] = (s / 0x100000000) * 2 - 1;
  }
  return out;
}

/** Echo (0.34 s, feedback 0.32, send 0.35) and a 3.2 kHz low-pass over a circular buffer, repeated so the tail wraps. */
function room(dry: Float32Array): Float32Array {
  const delay = Math.floor(0.34 * MUSIC_RATE);
  const total = dry.length;
  const wet = new Float32Array(total);
  const out = new Float32Array(total);
  // Low-pass biquad (RBJ, Q = 0.7071).
  const w0 = (TAU * 3200) / MUSIC_RATE;
  const alpha = Math.sin(w0) / (2 * 0.7071);
  const a0 = 1 + alpha;
  const b0 = (1 - Math.cos(w0)) / 2 / a0, b1 = (1 - Math.cos(w0)) / a0, a1 = (-2 * Math.cos(w0)) / a0, a2 = (1 - alpha) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < total; i++) {
      const echo = wet[(i - delay + total * 2) % total] ?? 0;
      const x = (dry[i] ?? 0) + echo;
      wet[i] = 0.35 * (dry[i] ?? 0) + 0.32 * echo;
      const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      out[i] = y;
    }
  }
  return out;
}

/** Renders one mood into a mono 16-bit loop. */
export function renderMusic(mood: Mood): Int16Array {
  const p = MUSIC[mood];
  const s = stepSeconds(p);
  const dry = new Float32Array(Math.round(loopSeconds(p) * MUSIC_RATE));
  const noise = whiteNoise(Math.floor(0.25 * MUSIC_RATE));
  for (let step = 0; step < p.lead.length; step++) {
    const at = step * s;
    const lead = p.lead[step] ?? 0;
    const bass = p.bass[step] ?? 0;
    const hit = p.drum[step % p.drum.length] ?? '';
    if (lead) pluck(dry, lead, at, s * 5, p.leadGain);
    if (bass) pad(dry, bass, at, s * p.stepsPerBar * 1.6, p.bassGain);
    if (hit) drum(dry, hit, at, p.drumGain, noise);
  }
  const mixed = room(dry);
  const pcm = new Int16Array(mixed.length);
  for (let i = 0; i < mixed.length; i++) pcm[i] = Math.round(Math.max(-1, Math.min(1, Math.tanh((mixed[i] ?? 0) * 3) / Math.tanh(3))) * 32767 * 0.9);
  return pcm;
}

/** The loop as a `data:` URI of a RIFF/WAVE file (mono, 16-bit), ready for a native player. */
export function wavDataUri(pcm: Int16Array): string {
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, text: string) => [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, MUSIC_RATE, true);
  view.setUint32(28, MUSIC_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((v, i) => view.setInt16(44 + i * 2, v, true));
  return `data:audio/wav;base64,${base64(bytes)}`;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0, b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0;
    out += B64[a >> 2]! + B64[((a & 3) << 4) | (b >> 4)]! + (i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)]! : '=') + (i + 2 < bytes.length ? B64[c & 63]! : '=');
  }
  return out;
}
