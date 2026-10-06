import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import type { AgeTrack } from '@dozari/shared';
import { deviceStore } from '../auth/storage';
import { THEME_CHROME, themeOf } from './appTheme';
import type { ThemeId } from './appTheme';

const KEY = 'dozari.theme.v1';
let current: ThemeId = 'play';
let loaded = false;
const listeners = new Set<(t: ThemeId) => void>();

/** Points the browser's manifest, icons and address-bar colour at the look (installed PWAs pick it up on their next install/update check). */
function paintWebChrome(theme: ThemeId): void {
  const doc = (globalThis as { document?: { head: { querySelector(s: string): { setAttribute(k: string, v: string): void } | null } } }).document;
  if (Platform.OS !== 'web' || !doc) return;
  const c = THEME_CHROME[theme];
  const set = (selector: string, attr: string, value: string) => doc.head.querySelector(selector)?.setAttribute(attr, value);
  set('link[rel="manifest"]', 'href', c.manifest);
  set('link[rel="icon"]', 'href', c.icon);
  set('link[rel="apple-touch-icon"]', 'href', c.appleIcon);
  set('meta[name="theme-color"]', 'content', c.themeColor);
}

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  const saved = await deviceStore.get(KEY);
  if (saved === 'adult' || saved === 'play') apply(saved, false);
}

function apply(theme: ThemeId, persist: boolean): void {
  if (theme === current && !persist) return;
  const changed = theme !== current;
  current = theme;
  paintWebChrome(theme);
  if (changed) listeners.forEach((l) => l(theme));
  if (persist) void deviceStore.set(KEY, theme);
}

export const getTheme = (): ThemeId => current;

/** Called wherever the player's track becomes known (login, home load, track screen). Remembered on the device so the next start opens in the right look. */
export function applyTrackTheme(track: AgeTrack | null | undefined): ThemeId {
  const theme = themeOf(track);
  apply(theme, true);
  return theme;
}

export function useTheme(): ThemeId {
  const [t, setT] = useState(current);
  useEffect(() => {
    listeners.add(setT);
    void load().then(() => setT(current));
    return () => void listeners.delete(setT);
  }, []);
  return t;
}
