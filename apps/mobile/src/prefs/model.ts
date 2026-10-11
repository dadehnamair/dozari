/** Personal, per-device preferences (owner item 12). Stored locally; nothing here is sent to the server. */
export interface Prefs {
  sound: boolean;
  /** Background music; separate from the effects so a player can keep one. */
  music: boolean;
  /** How loud the background music plays, 0 to 1 of the songs' full level (the player picks one of `MUSIC_VOLUMES`). */
  musicVolume: number;
  vibration: boolean;
  reduceMotion: boolean;
}

/** The steps the settings offer, quiet to full. The default is the second: the songs at full level were too loud under the game. */
export const MUSIC_VOLUMES = [0.2, 0.4, 0.7, 1] as const;

export const DEFAULT_PREFS: Prefs = { sound: true, music: true, musicVolume: MUSIC_VOLUMES[1], vibration: true, reduceMotion: false };

export const PREFS_KEY = 'dozari.prefs.v1';

/** Reads whatever was stored; unknown or malformed fields fall back to the defaults. */
export function parsePrefs(raw: string | null): Prefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const pick = (k: Exclude<keyof Prefs, 'musicVolume'>) => (typeof v[k] === 'boolean' ? (v[k] as boolean) : DEFAULT_PREFS[k]);
    const vol = typeof v.musicVolume === 'number' && v.musicVolume >= 0 && v.musicVolume <= 1 ? v.musicVolume : DEFAULT_PREFS.musicVolume;
    return { sound: pick('sound'), music: pick('music'), musicVolume: vol, vibration: pick('vibration'), reduceMotion: pick('reduceMotion') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export const serializePrefs = (p: Prefs): string => JSON.stringify(p);
