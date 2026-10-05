import { useEffect } from 'react';
import { getPrefs, usePrefs } from '../prefs/store';
import { context } from './engine';
import type { AudioCtx } from './engine';
import { MUSIC, stepSeconds } from './musicPattern';
import { setNativeMusic } from './nativeMusic';
import type { DrumHit, Mood } from './musicPattern';

/**
 * Soft background music, synthesised with WebAudio like the effects on the web; on a phone the same pattern is rendered offline
 * to a looping WAV (nativeMusic.ts). Never throws.
 * Timbre: plucked strings (a few decaying harmonics with a tiny pitch settle, like a setar / santur), a slow drone, and a soft
 * frame drum from filtered noise, all through a gentle low-pass and a short echo so it sounds like a room, not a beeper.
 */

/** The owner's songs are the app music (D189). The synthesised pattern remains for a build that cannot load them. */
const SONGS_ON = true;
const LOOKAHEAD_S = 0.2;
const TICK_MS = 60;

let mood: Mood | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextAt = 0;

interface Chain {
  c: AudioCtx;
  out: { connect(n: unknown): unknown };
  noise: unknown;
}
let chain: Chain | null = null;

/** Built once per audio context: master → low-pass, plus a feedback echo for a bit of room. */
function getChain(c: AudioCtx): Chain {
  if (chain && chain.c === c) return chain;
  const master = c.createGain();
  master.gain.value = 1;
  const soften = c.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 3200;
  master.connect(soften).connect(c.destination);
  const send = c.createGain();
  send.gain.value = 0.35;
  const delay = c.createDelay(1);
  delay.delayTime.value = 0.34;
  const feedback = c.createGain();
  feedback.gain.value = 0.32;
  send.connect(delay);
  delay.connect(feedback).connect(delay);
  delay.connect(master);
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.25), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  // `out` feeds both the dry master and the echo send.
  const bus = c.createGain();
  bus.gain.value = 1;
  bus.connect(master);
  bus.connect(send);
  chain = { c, out: bus, noise: buf };
  return chain;
}

/** One plucked string: a fast attack, harmonics that fade at different speeds, and a tiny pitch settle on the attack. */
function pluck(ch: Chain, freq: number, at: number, dur: number, gain: number) {
  const { c } = ch;
  for (const [mult, rel, decay] of [[1, 1, 1], [2, 0.42, 0.6], [3, 0.18, 0.4], [4, 0.07, 0.25]] as const) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * mult * 1.012, at);
    osc.frequency.exponentialRampToValueAtTime(freq * mult, at + 0.06);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain * rel, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur * decay);
    osc.connect(g).connect(ch.out as never);
    osc.start(at);
    osc.stop(at + dur * decay + 0.05);
  }
}

/** A long, soft drone note with a slow swell. */
function pad(ch: Chain, freq: number, at: number, dur: number, gain: number) {
  const { c } = ch;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(ch.out as never);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** A frame-drum stroke: filtered noise, deep (`d`) or bright and short (`t`). */
function drum(ch: Chain, hit: Exclude<DrumHit, ''>, at: number, gain: number) {
  const { c } = ch;
  const src = c.createBufferSource();
  src.buffer = ch.noise;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = hit === 'd' ? 170 : 2300;
  band.Q.value = hit === 'd' ? 1.1 : 2.2;
  const g = c.createGain();
  const len = hit === 'd' ? 0.16 : 0.06;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain * (hit === 'd' ? 2.2 : 0.8), at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + len);
  src.connect(band).connect(g).connect(ch.out as never);
  src.start(at);
  src.stop(at + len + 0.02);
}

function tick() {
  const c = context();
  const p = mood ? MUSIC[mood] : null;
  if (!c || !p || !getPrefs().music || !getPrefs().sound) return;
  try {
    if (c.state === 'suspended') void c.resume(); // browsers allow this only after a tap; we simply retry
    if (c.state === 'suspended') return;
    const ch = getChain(c);
    const s = stepSeconds(p);
    if (nextAt < c.currentTime) nextAt = c.currentTime + 0.05;
    while (nextAt < c.currentTime + LOOKAHEAD_S) {
      const lead = p.lead[step % p.lead.length] ?? 0;
      const bass = p.bass[step % p.bass.length] ?? 0;
      const hit = p.drum[step % p.drum.length] ?? '';
      if (lead) pluck(ch, lead, nextAt, s * 5, p.leadGain);
      if (bass) pad(ch, bass, nextAt, s * p.stepsPerBar * 1.6, p.bassGain);
      if (hit) drum(ch, hit, nextAt, p.drumGain);
      step++;
      nextAt += s;
    }
  } catch {
    /* music is a nicety */
  }
}

/** Sets the mood (null = silence). Switching mood restarts the loop so the tempo changes at once. */
export function setMusicMood(next: Mood | null): void {
  // Both phones and the web play the songs; the WebAudio synth below stays only as the fallback when the songs are switched off in code.
  if (SONGS_ON) return setNativeMusic(next);
  if (next === mood) return;
  mood = next;
  step = 0;
  nextAt = 0;
  if (mood && !timer) timer = setInterval(tick, TICK_MS);
  if (!mood && timer) {
    clearInterval(timer);
    timer = null;
  }
}

/** Plays the given mood while mounted and while the player keeps music on. */
export function useMusic(next: Mood | null): void {
  const { music, sound } = usePrefs();
  const on = music && sound ? next : null;
  useEffect(() => {
    setMusicMood(on);
    return () => setMusicMood(null);
  }, [on]);
}
