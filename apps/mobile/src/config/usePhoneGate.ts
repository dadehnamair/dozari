import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { deviceStore } from '../auth/storage';
import { miniAppHost } from '../miniapp/host';
import { appAddress, deviceKind, downloadLink, gateVerdict } from './deviceGate';
import type { GateVerdict } from './deviceGate';

const KEY = 'dozari.gateContinue';

interface Browser {
  location?: { origin: string; search: string };
  matchMedia?: (q: string) => { matches: boolean };
  navigator?: { userAgent: string; maxTouchPoints?: number; standalone?: boolean };
}
const g = globalThis as unknown as Browser;

/**
 * The phone-only gate (D171) for the web build: `verdict` says what to show instead of the app, `ready` is false until the saved
 * «ادامه با مرورگر» choice is read (so a tester never sees the card flash). Native builds always pass, and so does a mini-app:
 * the player is already inside the game there, so the card would only be in the way.
 */
export function usePhoneGate(settings: Record<string, unknown>): { ready: boolean; verdict: GateVerdict; address: string; download: string | null; continueBrowser: () => void } {
  const web = Platform.OS === 'web';
  const [escaped, setEscaped] = useState(false);
  const [ready, setReady] = useState(!web);
  useEffect(() => {
    if (!web) return;
    const viaLink = new URLSearchParams(g.location?.search ?? '').get('browser') === '1';
    const inMiniApp = miniAppHost() !== null;
    void deviceStore.get(KEY).then((v) => (setEscaped(viaLink || inMiniApp || v === '1'), setReady(true)));
  }, [web]);
  const continueBrowser = useCallback(() => {
    setEscaped(true);
    void deviceStore.set(KEY, '1');
  }, []);
  const nav = g.navigator;
  const standalone = g.matchMedia?.('(display-mode: standalone)').matches === true || nav?.standalone === true;
  const verdict = gateVerdict({ web, standalone, switchOn: Number(settings['gate.phone_only']) === 1, escaped, kind: deviceKind({ userAgent: nav?.userAgent ?? '', maxTouchPoints: nav?.maxTouchPoints ?? 0 }) });
  return { ready, verdict, address: appAddress(settings['link.app_url'], g.location?.origin ?? ''), download: downloadLink(settings['link.android_app']), continueBrowser };
}
