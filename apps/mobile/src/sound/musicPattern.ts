export type Mood = 'calm' | 'tense';

/** `d` = deep frame-drum stroke (dom), `t` = light edge stroke (tak), '' = rest. */
export type DrumHit = 'd' | 't' | '';

/** Notes are Hz; 0 is a rest. One pattern step is an eighth note; a pattern loops. Pure data so it can be tested. */
export interface MusicPattern {
  bpm: number;
  /** Eighth notes per bar (6 = a lilting 6/8, 8 = 4/4). */
  stepsPerBar: number;
  /** One entry per eighth note: the plucked melody (setar / santur-like). */
  lead: readonly number[];
  /** Long soft drone notes (one entry per eighth note, mostly rests). */
  bass: readonly number[];
  /** Soft daf-like frame drum, one entry per eighth note. */
  drum: readonly DrumHit[];
  /** Peak gain of the lead / bass / drum, kept low so effects stay on top. */
  leadGain: number;
  bassGain: number;
  drumGain: number;
}

// Shur on D with the Persian half-flat second (koron, ~E♭ + a quarter tone): D, E-koron, F, G, A, B♭, C.
const D4 = 293.66, Ek4 = 320, F4 = 349.23, G4 = 392, A4 = 440, Bb4 = 466.16, C5 = 523.25, D5 = 587.33;
const D2 = 73.42, G2 = 98, A2 = 110;

/** Expands a per-bar list of 6-step phrases into one flat array. */
const bars = (rows: readonly (readonly number[])[]): number[] => rows.flat();
const drone = (roots: readonly number[]): number[] => roots.flatMap((r) => [r, 0, 0, 0, 0, 0]);
const repeat = <T,>(bar: readonly T[], n: number): T[] => Array.from({ length: n }, () => bar).flat();

export const MUSIC: Record<Mood, MusicPattern> = {
  // An old bazaar at a slow hour: a plucked melody in lilting 6/8 over a low drone and a barely-there frame drum. 16 bars.
  calm: {
    bpm: 108,
    stepsPerBar: 6,
    lead: bars([
      [D4, 0, 0, F4, 0, Ek4], [D4, 0, 0, 0, 0, 0], [F4, 0, G4, 0, A4, 0], [G4, 0, F4, 0, Ek4, 0],
      [F4, 0, A4, 0, Bb4, 0], [A4, 0, G4, 0, F4, 0], [Ek4, 0, F4, Ek4, D4, 0], [D4, 0, 0, 0, 0, 0],
      [A4, 0, 0, Bb4, 0, A4], [G4, 0, 0, 0, 0, 0], [A4, 0, Bb4, 0, C5, 0], [Bb4, 0, A4, 0, G4, 0],
      [F4, 0, G4, 0, A4, 0], [G4, 0, F4, Ek4, F4, 0], [Ek4, 0, D4, 0, Ek4, D4], [D4, 0, 0, 0, 0, 0],
    ]),
    bass: drone([D2, D2, D2, D2, G2, G2, A2, D2, D2, D2, G2, G2, A2, G2, A2, D2]),
    drum: repeat(['d', '', '', 't', '', 't'], 16),
    leadGain: 0.09,
    bassGain: 0.05,
    drumGain: 0.05,
  },
  // Duels: the same sound world, quicker and busier. 4 bars of 4/4.
  tense: {
    bpm: 128,
    stepsPerBar: 8,
    lead: [D4, D4, F4, D4, Ek4, D4, A4, 0, G4, G4, Bb4, G4, A4, G4, D5, 0, C5, C5, Bb4, A4, G4, A4, Bb4, 0, A4, G4, F4, Ek4, D4, 0, Ek4, 0],
    bass: [D2, 0, 0, 0, D2, 0, 0, 0, G2, 0, 0, 0, G2, 0, 0, 0, D2, 0, 0, 0, D2, 0, 0, 0, A2, 0, 0, 0, A2, 0, 0, 0],
    drum: repeat(['d', '', 't', '', 'd', '', 't', 't'], 4),
    leadGain: 0.08,
    bassGain: 0.055,
    drumGain: 0.07,
  },
};

/** Seconds per pattern step (an eighth note). */
export const stepSeconds = (p: MusicPattern): number => 30 / p.bpm;
