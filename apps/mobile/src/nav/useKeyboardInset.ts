import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import type { View } from 'react-native';

/**
 * Android draws edge-to-edge, so the soft keyboard no longer resizes the window and covers whatever sits at the bottom
 * (the sign-in card, chat boxes, search fields). This returns how far the keyboard overlaps the bottom of `ref`'s view;
 * the app shell gives it as a bottom margin, which shrinks every screen and sheet inside it. It compares against the real
 * on-screen position, so a device that does resize the window itself gets 0. Always 0 on iOS and the web.
 */
export function useKeyboardInset(ref: React.RefObject<View | null>): number {
  const [inset, setInset] = useState(0);
  const applied = useRef(0);
  applied.current = inset;
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      ref.current?.measureInWindow((_x, y, _w, h) => {
        const bottomWithoutInset = y + h + applied.current;
        setInset(Math.max(0, Math.round(bottomWithoutInset - e.endCoordinates.screenY)));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [ref]);
  return inset;
}
