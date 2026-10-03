const { withAndroidManifest, withMainApplication } = require('expo/config-plugins');
const withGenderIcon = require('./plugins/withGenderIcon');

/**
 * The layout is the web design's on every platform (src/theme/direction.ts): left-to-right layout direction, the Persian
 * order written out explicitly. A phone set to Persian would otherwise switch the whole layout to native RTL and flip it, so
 * RTL is switched off in `Application.onCreate` and in the manifest.
 */
const withNoNativeRtl = (config) =>
  withAndroidManifest(
    withMainApplication(config, (mod) => {
      const src = mod.modResults.contents;
      if (!src.includes('I18nUtil')) {
        mod.modResults.contents = src.replace(
          'super.onCreate()',
          'super.onCreate()\n    com.facebook.react.modules.i18nmanager.I18nUtil.instance.allowRTL(this, false)\n    com.facebook.react.modules.i18nmanager.I18nUtil.instance.forceRTL(this, false)',
        );
      }
      return mod;
    }),
    (mod) => {
      mod.modResults.manifest.application[0].$['android:supportsRtl'] = 'false';
      return mod;
    },
  );

// Extends app.json. Android blocks plain-HTTP traffic in release builds, so cleartext is enabled only when the
// build's EXPO_PUBLIC_API_URL is http:// (LAN/test builds). Production builds use https:// and keep it off.
module.exports = ({ config }) => {
  const cleartext = (process.env.EXPO_PUBLIC_API_URL ?? '').startsWith('http://');
  return withGenderIcon(withNoNativeRtl({
    ...config,
    plugins: [...(config.plugins ?? []), ['expo-build-properties', { android: { usesCleartextTraffic: cleartext } }]],
  }));
};
