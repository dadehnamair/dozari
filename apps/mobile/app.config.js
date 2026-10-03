// Extends app.json. Android blocks plain-HTTP traffic in release builds, so cleartext is enabled only when the
// build's EXPO_PUBLIC_API_URL is http:// (LAN/test builds). Production builds use https:// and keep it off.
module.exports = ({ config }) => {
  const cleartext = (process.env.EXPO_PUBLIC_API_URL ?? '').startsWith('http://');
  return {
    ...config,
    plugins: [...(config.plugins ?? []), ['expo-build-properties', { android: { usesCleartextTraffic: cleartext } }]],
  };
};
