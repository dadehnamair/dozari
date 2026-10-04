const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

/**
 * Two launcher icons, switched at runtime by the player's gender (modules/app-icon): the original hero and the female hero.
 * MainActivity loses its own LAUNCHER entry; two activity-aliases take it, the female one disabled until the app enables it.
 * The female art (assets/icon-female.png, adaptive-icon-female.png: 1024 px, exported by scripts/export-brand.mjs) is shipped
 * downscaled: adaptive-icon-female-432.png (xxxhdpi foreground), adaptive-background-female-216.png (rose backdrop) and icon-female-192.png (Android 7 fallback).
 */
const ALIASES = [
  { name: '.MainActivityDefault', enabled: true, icon: '@mipmap/ic_launcher', round: '@mipmap/ic_launcher_round' },
  { name: '.MainActivityFemale', enabled: false, icon: '@mipmap/ic_launcher_female', round: '@mipmap/ic_launcher_female_round' },
];

const withAliases = (config) =>
  withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    const main = app.activity.find((a) => a.$['android:name'] === '.MainActivity');
    main['intent-filter'] = (main['intent-filter'] ?? []).filter((f) => !(f.category ?? []).some((c) => c.$['android:name'] === 'android.intent.category.LAUNCHER'));
    app['activity-alias'] = app['activity-alias'] ?? [];
    for (const a of ALIASES) {
      if (app['activity-alias'].some((x) => x.$['android:name'] === a.name)) continue;
      app['activity-alias'].push({
        $: {
          'android:name': a.name,
          'android:enabled': String(a.enabled),
          'android:exported': 'true',
          'android:targetActivity': '.MainActivity',
          'android:icon': a.icon,
          'android:roundIcon': a.round,
          'android:label': '@string/app_name',
        },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }], category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }] }],
      });
    }
    return mod;
  });

const ADAPTIVE = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_female_background"/>
    <foreground android:drawable="@drawable/ic_launcher_female_foreground"/>
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>
</adaptive-icon>
`;

const withResources = (config) =>
  withDangerousMod(config, [
    'android',
    (mod) => {
      const assets = path.join(mod.modRequest.projectRoot, 'assets');
      const res = path.join(mod.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
      const put = (dir, file, content) => {
        fs.mkdirSync(path.join(res, dir), { recursive: true });
        fs.writeFileSync(path.join(res, dir, file), content);
      };
      const foreground = fs.readFileSync(path.join(assets, 'adaptive-icon-female-432.png'));
      const background = fs.readFileSync(path.join(assets, 'adaptive-background-female-216.png'));
      const full = fs.readFileSync(path.join(assets, 'icon-female-192.png'));
      put('drawable-nodpi', 'ic_launcher_female_foreground.png', foreground);
      put('drawable-nodpi', 'ic_launcher_female_background.png', background);
      // Android 7 (no adaptive icons): plain bitmaps. Android 8+ picks the adaptive XML below.
      put('mipmap-xxxhdpi', 'ic_launcher_female.png', full);
      put('mipmap-xxxhdpi', 'ic_launcher_female_round.png', full);
      put('mipmap-anydpi-v26', 'ic_launcher_female.xml', ADAPTIVE);
      put('mipmap-anydpi-v26', 'ic_launcher_female_round.xml', ADAPTIVE);
      return mod;
    },
  ]);

module.exports = (config) => withResources(withAliases(config));
