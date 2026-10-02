import { useEffect } from 'react';
import { getPrefs, usePrefs } from '../prefs/store';
import { context } from './engine';
import { MUSIC, stepSeconds } from './musicPattern';
import type { Mood, MusicPattern } from './musicPattern';

/** Soft background music, synthesised with WebAudio like the effects (web only; native stays silent for now). Never throws. */

const LOOKAHEAD_S = 0.2;
const TICK_MS = 60;

let mood: Mood | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let step = 0;
let nextAt = 0;

function note(c: NonNullable<ReturnType<typeof context>>, freq: number, at: number, dur: number, gain: number, wave: MusicPattern['wave']) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = wave;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

function tick() {
  const c = context();
  const p = mood ? MUSIC[mood] : null;
  if (!c || !p || !getPrefs().music || !getPrefs().sound) return;
  try {
    if (c.state === 'suspended') void c.resume(); // browsers allow this only after a tap; we simply retry
    if (c.state === 'suspended') return;
    const s = stepSeconds(p);
    if (nextAt < c.currentTime) nextAt = c.currentTime + 0.05;
    while (nextAt < c.currentTime + LOOKAHEAD_S) {
      const lead = p.lead[step % p.lead.length] ?? 0;
      const bass = p.bass[step % p.bass.length] ?? 0;
      if (lead) note(c, lead, nextAt, s * 1.8, p.leadGain, p.wave);
      if (bass) note(c, bass, nextAt, s * 3.2, p.bassGain, 'sine');
      step++;
      nextAt += s;
    }
  } catch {
    /* music is a nicety */
  }
}

/** Sets the mood (null = silence). Switching mood restarts the loop so the tempo changes at once. */
export function setMusicMood(next: Mood | null): void {
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
