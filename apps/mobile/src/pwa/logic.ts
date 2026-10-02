/** Pure parts of the PWA layer (D102), kept apart from the browser APIs so they can be unit-tested. */

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

/** A dismissed install banner comes back after this long. */
export const INSTALL_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export const installBannerDue = (dismissedAt: number | null, now: number): boolean => dismissedAt === null || now - dismissedAt >= INSTALL_SNOOZE_MS;
