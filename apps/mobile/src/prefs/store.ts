import { useEffect, useState } from 'react';
import { deviceStore } from '../auth/storage';
import { DEFAULT_PREFS, PREFS_KEY, parsePrefs, serializePrefs } from './model';
import type { Prefs } from './model';

let current: Prefs = { ...DEFAULT_PREFS };
let loaded = false;
const listeners = new Set<(p: Prefs) => void>();

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  current = parsePrefs(await deviceStore.get(PREFS_KEY));
  listeners.forEach((l) => l(current));
}

/** Synchronous read for the sound engine and haptics; defaults until the stored value has loaded. */
export const getPrefs = (): Prefs => current;

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  current = { ...current, [key]: value };
  listeners.forEach((l) => l(current));
  void deviceStore.set(PREFS_KEY, serializePrefs(current));
}

export function usePrefs(): Prefs {
  const [p, setP] = useState(current);
  useEffect(() => {
    listeners.add(setP);
    void load();
    setP(current);
    return () => void listeners.delete(setP);
  }, []);
  return p;
}
