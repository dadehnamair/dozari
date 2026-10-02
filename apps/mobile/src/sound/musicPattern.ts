export type Mood = 'calm' | 'tense';

/** Notes are Hz; 0 is a rest. One pattern step is an eighth note; a pattern loops. Pure data so it can be tested. */
export interface MusicPattern {
  bpm: number;
  /** One entry per eighth note. */
  lead: readonly number[];
  bass: readonly number[];
  /** Peak gain of the lead / bass, kept low so effects stay on top. */
  leadGain: number;
  bassGain: number;
  wave: 'sine' | 'triangle' | 'square';
}

// A Shur-like mode on D (D, E♭-ish, F, G, A, B♭, C): the E♭ gives the Persian flavour.
const D4 = 293.66, Eb4 = 311.13, F4 = 349.23, G4 = 392, A4 = 440, Bb4 = 466.16, C5 = 523.25, D5 = 587.33;
const D2 = 73.42, G2 = 98, A2 = 110;

export const MUSIC: Record<Mood, MusicPattern> = {
  calm: {
    bpm: 76,
    lead: [D4, 0, F4, 0, Eb4, D4, 0, 0, G4, 0, F4, 0, A4, 0, 0, 0, Bb4, 0, A4, 0, G4, F4, 0, 0, Eb4, 0, D4, 0, 0, 0, 0, 0],
    bass: [D2, 0, 0, 0, D2, 0, 0, 0, G2, 0, 0, 0, A2, 0, 0, 0, D2, 0, 0, 0, D2, 0, 0, 0, G2, 0, 0, 0, A2, 0, 0, 0],
    leadGain: 0.05,
    bassGain: 0.06,
    wave: 'sine',
  },
  tense: {
    bpm: 128,
    lead: [D4, D4, F4, D4, Eb4, D4, A4, 0, G4, G4, Bb4, G4, A4, G4, D5, 0, C5, C5, Bb4, A4, G4, A4, Bb4, 0, A4, G4, F4, Eb4, D4, 0, Eb4, 0],
    bass: [D2, 0, D2, 0, D2, 0, D2, D2, G2, 0, G2, 0, G2, 0, G2, G2, D2, 0, D2, 0, D2, 0, D2, D2, A2, 0, A2, 0, A2, 0, A2, A2],
    leadGain: 0.045,
    bassGain: 0.07,
    wave: 'triangle',
  },
};

/** Seconds per pattern step (an eighth note). */
export const stepSeconds = (p: MusicPattern): number => 30 / p.bpm;
