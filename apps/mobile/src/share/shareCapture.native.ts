import type { RefObject } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { fa } from '../i18n/fa';

/** Phones: the card view becomes a 1080x1350 PNG and goes through the system share sheet. */
export async function captureAndShare(ref: RefObject<View | null>, _message: string): Promise<void> {
  const uri = await captureRef(ref, { format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1350 });
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing is not available');
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: fa.share.title });
}
