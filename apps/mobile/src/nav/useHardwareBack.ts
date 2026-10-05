import { useEffect, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { pushBack } from './backStack';

/**
 * The phone's own back button / gesture (Android) does the same as the on-screen back: the most recently mounted handler
 * wins, so a sheet opened over a page closes first, then the page, then the app exits from the home screen. A `null`
 * handler registers nothing. On the web (no `BackHandler`) the handler goes on `backStack`, which the Bale mini-app's back button
 * drives; no-op on iOS.
 */
export function useHardwareBack(handler: (() => void) | null | undefined): void {
  const ref = useRef(handler);
  ref.current = handler;
  const active = Boolean(handler);
  useEffect(() => {
    if (!active) return;
    if (Platform.OS === 'web') return pushBack(() => ref.current?.());
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      ref.current?.();
      return true;
    });
    return () => sub.remove();
  }, [active]);
}
