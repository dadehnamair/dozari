import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { session } from '../auth';
import { BASE_URL } from '../net/http';

interface Native {
  schedule: (baseUrl: string, token: string) => void;
  cancel: () => void;
}

/** The local Expo module `modules/background-notify` (Android only). Absent on web, iOS and older builds. */
function native(): Native | null {
  if (Platform.OS !== 'android') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m = (globalThis as any).expo?.modules?.DozariBackgroundNotify as Native | undefined;
  return m ?? (NativeModules.DozariBackgroundNotify as Native | undefined) ?? null;
}

/**
 * Starts the Android background check (a WorkManager job about every 15–30 minutes, no permanent notification).
 * Asks for the notification permission on Android 13+. Safe to call on every Home open: the job keeps its timer and only
 * the fresh login token is handed over. Failures are silent; the in-app lists and Bale still work.
 */
export async function startBackgroundNotify(): Promise<void> {
  const mod = native();
  if (!mod) return;
  try {
    if (Number(Platform.Version) >= 33) await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never);
    const token = await session.token();
    if (token) mod.schedule(BASE_URL, token);
  } catch {
    /* silent */
  }
}

/** Stops the check and forgets the token (logout, account deletion). */
export function stopBackgroundNotify(): void {
  try {
    native()?.cancel();
  } catch {
    /* silent */
  }
}
