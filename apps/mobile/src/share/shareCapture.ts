import type { RefObject } from 'react';
import { Share } from 'react-native';
import type { View } from 'react-native';

/** Web (and anything without the native modules): no image capture, so the same words and the invite code go through the share sheet / clipboard. */
export async function captureAndShare(_ref: RefObject<View | null>, message: string): Promise<void> {
  await Share.share({ message });
}
