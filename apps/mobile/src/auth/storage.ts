import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { KeyValueStore } from './session';

/** The OS keychain on phones, localStorage on the web. Never throws. */
export const deviceStore: KeyValueStore =
  Platform.OS === 'web'
    ? {
        async get(key) {
          try {
            return globalThis.localStorage?.getItem(key) ?? null;
          } catch {
            return null;
          }
        },
        async set(key, value) {
          try {
            globalThis.localStorage?.setItem(key, value);
          } catch {
            /* private mode */
          }
        },
        async remove(key) {
          try {
            globalThis.localStorage?.removeItem(key);
          } catch {
            /* private mode */
          }
        },
      }
    : {
        async get(key) {
          try {
            return await SecureStore.getItemAsync(key);
          } catch {
            return null;
          }
        },
        async set(key, value) {
          try {
            await SecureStore.setItemAsync(key, value);
          } catch {
            /* keychain unavailable */
          }
        },
        async remove(key) {
          try {
            await SecureStore.deleteItemAsync(key);
          } catch {
            /* keychain unavailable */
          }
        },
      };
