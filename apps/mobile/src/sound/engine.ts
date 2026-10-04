import { Platform } from 'react-native';
import { getPrefs } from '../prefs/store';
import { SFX_NOTES } from './engineNotes';
import type { Sfx } from './engineNotes';

/** Game sound effects, synthesised (no audio files to ship, nothing from Google). Web uses WebAudio; native has no engine yet and stays silent. */

export type { Sfx };

/** The slice of WebAudio used here (the RN tsconfig has no DOM lib). */
interface Param {
  value: number;
  setValueAtTime(v: number, t: number): void;
  exponentialRampToValueAtTime(v: number, t: number): void;
}
interface Node {
  connect(n: Node): Node;
}
interface Ctx {
  state: string;
  currentTime: number;
  sampleRate: number;
  destination: Node;
  resume(): Promise<void>;
  createOscillator(): Node & { type: string; frequency: Param; start(t: number): void; stop(t: number): void };
  createGain(): Node & { gain: Param };
  createBiquadFilter(): Node & { type: string; frequency: Param; Q: Param };
  createDelay(maxSeconds?: number): Node & { delayTime: Param };
  createBuffer(channels: number, length: number, sampleRate: number): { getChannelData(channel: number): Float32Array };
  createBufferSource(): Node & { buffer: unknown; start(t: number): void; stop(t: number): void };
}
type AudioCtor = new () => Ctx;
let ctx: Ctx | null = null;

export type { Ctx as AudioCtx };
export function context(): Ctx | null {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  const C = g.AudioContext ?? g.webkitAudioContext;
  if (!C) return null;
  try {
    ctx ??= new C();
    return ctx;
  } catch {
    return null;
  }
}

/** Plays an effect unless the player turned sound off. Never throws. */
export function playSfx(name: Sfx): void {
  if (!getPrefs().sound) return;
  const c = context();
  if (!c) return;
  try {
    if (c.state === 'suspended') void c.resume();
    const t0 = c.currentTime;
    for (const [freq, start, dur] of SFX_NOTES[name]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain).connect(c.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  } catch {
    /* audio is a nicety */
  }
}

/** A short buzz on phones that support it, when the player allows vibration. */
export function buzz(ms = 30): void {
  if (!getPrefs().vibration) return;
  try {
    (globalThis.navigator as { vibrate?: (n: number) => boolean } | undefined)?.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
