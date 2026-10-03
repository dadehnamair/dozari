const { withMainApplication } = require('expo/config-plugins');
const withGenderIcon = require('./plugins/withGenderIcon');

/**
 * The game is Persian/RTL on every phone, whatever the device language. `I18nManager.forceRTL` from JS only takes effect
 * after a restart, so the first launch would be left-to-right; setting it natively in `Application.onCreate` makes the
 * very first launch RTL.
 */
const withForcedRtl = (config) =>
  withMainApplication(config, (mod) => {
    const src = mod.modResults.contents;
    if (!src.includes('I18nUtil')) {
      mod.modResults.contents = src.replace(
        'super.onCreate()',
        'super.onCreate()\n    com.facebook.react.modules.i18nmanager.I18nUtil.instance.allowRTL(this, true)\n    com.facebook.react.modules.i18nmanager.I18nUtil.instance.forceRTL(this, true)\n    com.facebook.react.modules.i18nmanager.I18nUtil.instance.swapLeftAndRightInRTL(this, false)',
      );
    }
    return mod;
  });

// Extends app.json. Android blocks plain-HTTP traffic in release builds, so cleartext is enabled only when the
// build's EXPO_PUBLIC_API_URL is http:// (LAN/test builds). Production builds use https:// and keep it off.
module.exports = ({ config }) => {
  const cleartext = (process.env.EXPO_PUBLIC_API_URL ?? '').startsWith('http://');
  return withGenderIcon(withForcedRtl({
    ...config,
    plugins: [...(config.plugins ?? []), ['expo-build-properties', { android: { usesCleartextTraffic: cleartext } }]],
  }));
};
