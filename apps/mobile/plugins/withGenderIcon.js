const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

/**
 * Four launcher icons, switched at runtime by the player's gender and age track (modules/app-icon): the original hero and the female hero (kid, teen), and the same two on the adult gold coin.
 * MainActivity loses its own LAUNCHER entry; four activity-aliases take it, only the default one enabled until the app switches.
 * Art: the female one is exported by scripts/export-brand.mjs, the adult ones by scripts/build-adult-icons.py; each ships downscaled
 * (…-432.png xxxhdpi foreground, …-216.png backdrop, …-192.png Android 7 fallback).
 */
const ALIASES = [
  { name: '.MainActivityDefault', enabled: true, icon: '@mipmap/ic_launcher', round: '@mipmap/ic_launcher_round' },
  { name: '.MainActivityFemale', enabled: false, icon: '@mipmap/ic_launcher_female', round: '@mipmap/ic_launcher_female_round' },
  { name: '.MainActivityAdult', enabled: false, icon: '@mipmap/ic_launcher_adult', round: '@mipmap/ic_launcher_adult_round' },
  { name: '.MainActivityAdultFemale', enabled: false, icon: '@mipmap/ic_launcher_adult_female', round: '@mipmap/ic_launcher_adult_female_round' },
];

/** Resource suffix and asset files of each extra variant (the default one is Expo's own launcher icon). */
const VARIANTS = [
  { res: 'female', fg: 'adaptive-icon-female-432.png', bg: 'adaptive-background-female-216.png', full: 'icon-female-192.png' },
  { res: 'adult', fg: 'adaptive-icon-adult-432.png', bg: 'adaptive-background-adult-216.png', full: 'icon-adult-192.png' },
  { res: 'adult_female', fg: 'adaptive-icon-adult-female-432.png', bg: 'adaptive-background-adult-216.png', full: 'icon-adult-female-192.png' },
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

const adaptive = (res) => `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_${res}_background"/>
    <foreground android:drawable="@drawable/ic_launcher_${res}_foreground"/>
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
      for (const v of VARIANTS) {
        const full = fs.readFileSync(path.join(assets, v.full));
        put('drawable-nodpi', `ic_launcher_${v.res}_foreground.png`, fs.readFileSync(path.join(assets, v.fg)));
        put('drawable-nodpi', `ic_launcher_${v.res}_background.png`, fs.readFileSync(path.join(assets, v.bg)));
        // Android 7 (no adaptive icons): plain bitmaps. Android 8+ picks the adaptive XML below.
        put('mipmap-xxxhdpi', `ic_launcher_${v.res}.png`, full);
        put('mipmap-xxxhdpi', `ic_launcher_${v.res}_round.png`, full);
        put('mipmap-anydpi-v26', `ic_launcher_${v.res}.xml`, adaptive(v.res));
        put('mipmap-anydpi-v26', `ic_launcher_${v.res}_round.xml`, adaptive(v.res));
      }
      return mod;
    },
  ]);

module.exports = (config) => withResources(withAliases(config));
