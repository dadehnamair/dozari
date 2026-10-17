import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { bazaarPackageOf } from './logic';

interface StoreReviewModule {
  openBazaarReview(packageName: string): boolean;
}

/**
 * Opens CafeBazaar's own rating and comment form through the native module (an ACTION_EDIT intent addressed to Bazaar, which
 * `Linking.openURL` cannot send). False when it is not Android, not a Bazaar link, the build has no module or Bazaar refused:
 * the caller then opens the link the ordinary way. Never throws.
 */
export function openBazaarReviewForm(url: string): boolean {
  const pkg = bazaarPackageOf(url);
  if (Platform.OS !== 'android' || !pkg) return false;
  try {
    return requireOptionalNativeModule<StoreReviewModule>('DozariStoreReview')?.openBazaarReview(pkg) === true;
  } catch {
    return false;
  }
}
