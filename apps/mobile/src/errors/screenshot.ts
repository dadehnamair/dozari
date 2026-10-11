import { CLIENT_ERROR_SHOT_MAX } from '@dozari/shared';

/** Native only (see `screenshot.native.ts`): the view that covers the whole app. */
export function setShotRoot(_ref: unknown): void {}

/**
 * A small JPEG of what the player sees right now, as a data URL; null when the browser cannot draw it in time or it is too big.
 * It never throws and never takes longer than a few seconds: a report must go out even when the screenshot cannot.
 */
export async function captureScreen(): Promise<string | null> {
  const doc = (globalThis as { document?: { body?: HTMLElement } }).document;
  if (!doc?.body) return null;
  try {
    const { toJpeg } = await import('html-to-image');
    const shot = toJpeg(doc.body, { quality: 0.5, pixelRatio: 0.6, skipFonts: true, cacheBust: false });
    const out = await Promise.race([shot, new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
    return out && out.length <= CLIENT_ERROR_SHOT_MAX ? out : null;
  } catch {
    return null;
  }
}
