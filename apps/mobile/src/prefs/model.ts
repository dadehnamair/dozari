/** Personal, per-device preferences (owner item 12). Stored locally; nothing here is sent to the server. */
export interface Prefs {
  sound: boolean;
  vibration: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_PREFS: Prefs = { sound: true, vibration: true, reduceMotion: false };

export const PREFS_KEY = 'dozari.prefs.v1';

/** Reads whatever was stored; unknown or malformed fields fall back to the defaults. */
export function parsePrefs(raw: string | null): Prefs {
  if (!raw) return { ...DEFAULT_PREFS };
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const pick = (k: keyof Prefs) => (typeof v[k] === 'boolean' ? (v[k] as boolean) : DEFAULT_PREFS[k]);
    return { sound: pick('sound'), vibration: pick('vibration'), reduceMotion: pick('reduceMotion') };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export const serializePrefs = (p: Prefs): string => JSON.stringify(p);
