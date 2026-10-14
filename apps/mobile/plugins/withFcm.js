const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

/**
 * Hands the Firebase project's public identifiers to the app as manifest meta-data (read by `modules/background-notify`, which
 * starts Firebase by hand: no google-services.json and no Gradle plugin needed). Values come from the build environment:
 * FCM_PROJECT_ID, FCM_APP_ID, FCM_API_KEY, FCM_SENDER_ID (Firebase console → Project settings → Your apps → Android).
 * If any is missing nothing is added and the app simply has no FCM (the background check still works).
 */
const KEYS = { 'ir.dozari.fcm.project_id': 'FCM_PROJECT_ID', 'ir.dozari.fcm.app_id': 'FCM_APP_ID', 'ir.dozari.fcm.api_key': 'FCM_API_KEY', 'ir.dozari.fcm.sender_id': 'FCM_SENDER_ID' };

module.exports = (config) =>
  withAndroidManifest(config, (mod) => {
    const values = Object.entries(KEYS).map(([name, env]) => [name, process.env[env]]);
    if (values.some(([, v]) => !v)) return mod;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    for (const [name, value] of values) AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, name, value);
    return mod;
  });
