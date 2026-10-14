const { withAndroidManifest, withProjectBuildGradle, AndroidConfig } = require('expo/config-plugins');

/**
 * Wires the IRNoti Android SDK (modules/background-notify). Build environment:
 * - IRNOTI_PUSH_APP_KEY: the push app's public key `pk_live_…` from the IRNoti panel (public by design; the Firebase service account and API keys never go in the app);
 * - IRNOTI_API_BASE: optional, the device API base (SDK default https://api.irnoti.ir/v1/sdk).
 * Without the key nothing is added and the app keeps the direct-FCM / background-check behaviour. The SDK is published on JitPack.
 */
const JITPACK = "maven { url 'https://www.jitpack.io' }";

module.exports = (config) =>
  withAndroidManifest(
    withProjectBuildGradle(config, (mod) => {
      if (!mod.modResults.contents.includes('jitpack.io')) {
        mod.modResults.contents = mod.modResults.contents.replace(/allprojects\s*\{\s*repositories\s*\{/, (m) => `${m}\n    ${JITPACK}`);
      }
      return mod;
    }),
    (mod) => {
      const key = process.env.IRNOTI_PUSH_APP_KEY;
      if (!key) return mod;
      const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'ir.dozari.irnoti.app_key', key);
      if (process.env.IRNOTI_API_BASE) AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, 'ir.dozari.irnoti.api_base', process.env.IRNOTI_API_BASE);
      return mod;
    },
  );
