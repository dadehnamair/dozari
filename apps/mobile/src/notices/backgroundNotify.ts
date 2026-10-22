import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { session } from '../auth';
import { BASE_URL, callJson } from '../net/http';

interface Native {
  schedule: (baseUrl: string, token: string) => void;
  /** Firebase token of this install; null when the build has no Firebase identifiers or the phone cannot reach Google. */
  fcmToken?: () => Promise<string | null>;
  /** Links this install to the player in the IRNoti push service; false when the build has no IRNoti app key. */
  irnotiIdentify?: (externalId: string) => boolean;
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
    if (!token) { console.warn('[DozariIrnoti] no session token'); return; }
    mod.schedule(BASE_URL, token);
    // Instant push where Google is reachable; the scheduled check above stays as the fallback.
    // Preferred route: the IRNoti SDK registers the device itself, we only tell it which player this is (the server decides the id).
    const irnoti = (await callJson('/push/irnoti', 'GET', undefined, token).catch((e) => { console.warn('[DozariIrnoti] GET /push/irnoti failed', String(e)); return null; })) as { externalId?: string } | null;
    if (!irnoti?.externalId) console.warn('[DozariIrnoti] no externalId from server');
    else if (!mod.irnotiIdentify) console.warn('[DozariIrnoti] native irnotiIdentify missing');
    if (irnoti?.externalId && mod.irnotiIdentify?.(irnoti.externalId)) return;
    // Builds or servers without IRNoti: hand our own FCM token to the server (direct FCM).
    const fcm = await mod.fcmToken?.().catch(() => null);
    if (fcm) await callJson('/push/fcm', 'POST', { token: fcm }, token);
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
