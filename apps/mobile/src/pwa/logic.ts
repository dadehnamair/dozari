/** Pure parts of the PWA layer (D102), kept apart from the browser APIs so they can be unit-tested. */
import { normalizeTableCode } from '@dozari/shared';

/** How the app can be installed here: the browser's own prompt (Chrome/Android), the manual iPhone steps, or not at all. */
export type InstallMode = 'none' | 'prompt' | 'ios';

export function installModeOf(env: { web: boolean; standalone: boolean; hasPrompt: boolean; ios: boolean }): InstallMode {
  if (!env.web || env.standalone) return 'none';
  if (env.hasPrompt) return 'prompt';
  return env.ios ? 'ios' : 'none';
}

/** iPhone / iPad, including iPadOS that reports itself as a Mac but has a touch screen. */
export const isIosAgent = (ua: string, maxTouchPoints: number): boolean => /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);

/** Screens a home-screen shortcut may open (manifest `shortcuts`, `?go=`). */
export const LAUNCH_TARGETS = ['solo', 'daily', 'duel'] as const;
export type LaunchTarget = (typeof LAUNCH_TARGETS)[number];

/** Reads `?go=` and returns the URL search without the PWA-only parameters (`go`, `source`), so a reload does not repeat it. */
export function launchOf(search: string): { target: LaunchTarget | null; rest: string } {
  const q = new URLSearchParams(search);
  const go = q.get('go');
  q.delete('go');
  q.delete('source');
  const rest = q.toString();
  return { target: (LAUNCH_TARGETS as readonly string[]).includes(go ?? '') ? (go as LaunchTarget) : null, rest: rest ? `?${rest}` : '' };
}

/**
 * A shared private table (`?go=table&code=ABCDE`, from a bot group's «ورود به میز» button, docs/logic/group-game.md §Table card): the table code and
 * the URL search without those two parameters. The code is checked (alphabet and length) before it is trusted to open anything.
 */
export function tableLaunchOf(search: string): { code: string | null; rest: string } {
  const q = new URLSearchParams(search);
  if (q.get('go') !== 'table') return { code: null, rest: search };
  const raw = q.get('code') ?? '';
  q.delete('go');
  q.delete('code');
  q.delete('source');
  const rest = q.toString();
  return { code: normalizeTableCode(raw), rest: rest ? `?${rest}` : '' };
}

/**
 * A friend's personal invite link opened from a bot (`?go=invite&code=ABC2345`, from `https://ble.ir/<bot>?startapp=i_<ID>`): the public ID and the URL search
 * without those parameters. Only the shape is checked here; the server decides whether the ID exists.
 */
export function inviteLaunchOf(search: string): { handle: string | null; rest: string } {
  const q = new URLSearchParams(search);
  if (q.get('go') !== 'invite') return { handle: null, rest: search };
  const raw = q.get('code') ?? '';
  q.delete('go');
  q.delete('code');
  q.delete('source');
  const rest = q.toString();
  return { handle: /^[A-Za-z0-9]{4,12}$/.test(raw) ? raw.toUpperCase() : null, rest: rest ? `?${rest}` : '' };
}

/** A dismissed install banner comes back after this long. */
export const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export const installBannerDue = (dismissedAt: number | null, now: number): boolean => dismissedAt === null || now - dismissedAt >= INSTALL_SNOOZE_MS;
