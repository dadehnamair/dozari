const fs = require('fs');
const path = require('path');
const { withDangerousMod, withGradleProperties } = require('expo/config-plugins');

/**
 * Smaller release APK (the markets download the whole file):
 * - only the ABIs real phones use (arm64-v8a, armeabi-v7a); x86/x86_64 are emulators and double the native libraries;
 * - R8 code shrinking + resource shrinking on release builds;
 * - native libraries stored compressed in the APK (smaller download; the install takes a little more space).
 */
const PROPS = {
  reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',
  'android.enableMinifyInReleaseBuilds': 'true',
  'android.enableShrinkResourcesInReleaseBuilds': 'true',
  'expo.useLegacyPackaging': 'true',
};

const KEEP = `
# Local Expo module that switches the launcher icon (modules/app-icon): found by name at start-up.
-keep class ir.dozari.appicon.** { *; }
`;

module.exports = (config) =>
  withDangerousMod(
    withGradleProperties(config, (mod) => {
      for (const [key, value] of Object.entries(PROPS)) {
        mod.modResults = mod.modResults.filter((i) => !(i.type === 'property' && i.key === key));
        mod.modResults.push({ type: 'property', key, value });
      }
      return mod;
    }),
    [
      'android',
      (mod) => {
        const file = path.join(mod.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro');
        const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
        if (!current.includes('ir.dozari.appicon')) fs.writeFileSync(file, current + KEEP);
        return mod;
      },
    ],
  );
