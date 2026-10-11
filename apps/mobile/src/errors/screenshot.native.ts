import { captureRef } from 'react-native-view-shot';
import { CLIENT_ERROR_SHOT_MAX } from '@dozari/shared';

let root: unknown = null;

/** A ref to the view that covers the whole app (the shell in `App.tsx`). */
export function setShotRoot(ref: unknown): void {
  root = ref;
}

/** A small JPEG of the screen as a data URL; null when it cannot be taken or is too big. Never throws. */
export async function captureScreen(): Promise<string | null> {
  const view = (root as { current: unknown } | null)?.current;
  if (!view) return null;
  try {
    const shot = captureRef(view as never, { format: 'jpg', quality: 0.4, result: 'data-uri', width: 360 });
    const out = await Promise.race([shot, new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
    if (!out) return null;
    const data = out.replace(/^data:image\/jpg;/, 'data:image/jpeg;');
    return data.startsWith('data:image/') && data.length <= CLIENT_ERROR_SHOT_MAX ? data : null;
  } catch {
    return null;
  }
}
