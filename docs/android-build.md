# Building the Android app (D14: local / CI, no EAS cloud)

The app is Expo (React Native). There is no EAS dependency: `expo prebuild` writes the native `android/` project and Gradle builds it.
Package id `ir.dozari.app` (`apps/mobile/app.json`). The API address and the market are baked in at build time:
`EXPO_PUBLIC_API_URL` (e.g. `https://api.mrbots.ir`) and `EXPO_PUBLIC_STORE` (`myket` | `bazaar` | `bale` | empty).

## A. On GitHub (easiest, nothing to install)

Repository → **Actions → Android APK → Run workflow** (`.github/workflows/android-apk.yml`). Give the API address and the market, wait
(~10–20 min), download the APK from the run's **Artifacts**. Without signing secrets the APK is signed with a throw-away key: good for
installing and testing, **not for a store**. For a store build add repository secrets `ANDROID_KEYSTORE_BASE64` (`base64 -w0 release.keystore`),
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and **keep the same keystore forever** (an update must be signed by
the same key).

## B. On your own computer

Needs Node 22, pnpm, JDK 17 and the Android SDK (platform 35+, build-tools).

```bash
pnpm install
cd apps/mobile
EXPO_PUBLIC_API_URL=https://api.mrbots.ir pnpm exec expo prebuild --platform android
cd android && ./gradlew assembleRelease     # app/build/outputs/apk/release/app-release.apk
```

Put `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_STORE` in `apps/mobile/.env` (git-ignored) if you build from Android Studio, which does not see your shell variables.
Plain `http://` API addresses (LAN tests) turn on Android cleartext traffic automatically (`app.config.js`); `https://` keeps it off.

The launcher icon follows the player's gender (D166): `plugins/withGenderIcon.js` + `modules/app-icon`; change the art in `src/brand/BrandScreen.tsx` and re-export with `scripts/export-brand.mjs`.

### APK size

`plugins/withSlimAndroid.js` (run by `expo prebuild`) builds only `arm64-v8a` + `armeabi-v7a` (no emulator ABIs), turns on R8 and resource shrinking, and stores native libraries compressed. If a release build crashes at start-up, suspect R8 first: set `android.enableMinifyInReleaseBuilds=false` in `android/gradle.properties` and rebuild to confirm, then add a `-keep` rule for the class in the stack trace to `plugins/withSlimAndroid.js`.

### Windows notes (verified on a real build)

- Install with `pnpm install --node-linker=hoisted`: the default `node_modules/.pnpm/...` paths make CMake/ninja fail (`build.ninja still dirty`, object path > 250 chars).
- Run Gradle with JDK 21, not Android Studio's bundled JBR 25 (its prefab step prints a "restricted method" warning that Gradle treats as a failure): set `JAVA_HOME` and, if Android Studio created `android/gradle/gradle-daemon-jvm.properties`, set `toolchainVersion=21` in it.
- Install NDK 27.1.12297006 and CMake 3.22.1 in the SDK Manager. A very new Android Studio writes SDK XML v4 that this AGP cannot read (`CXX5304`); put `ndk.dir=` and `cmake.dir=` in `android/local.properties` to bypass it.
- Gradle needs Google's and Maven Central's repositories: from Iran run it with a working proxy (`~/.gradle/gradle.properties`, `systemProp.socksProxyHost/Port`) and make sure the proxy app is on.

Quick check on a connected phone instead: `pnpm --filter @dozari/mobile android` (dev build, needs the dev server).

## Before a store release

Version: bump `version` in `app.json` (and `android.versionCode`). Icons, adaptive icon and notification icon are in `apps/mobile/assets`.
Gradle downloads AndroidX from Google's Maven at **build time**; that is a build tool, not a runtime dependency (rule 8), but from an
Iranian network use a mirror or build on GitHub (option A). Background music plays on a phone (rendered offline to a looping WAV, `src/sound/nativeMusic.ts`); sound effects are still web only (D89/D121).
The app forces RTL natively (`app.config.js`, `Application.onCreate`) so the first launch is already right-to-left, and on Android content is padded below the status bar (`nativeTopInset`) while backgrounds stay full-bleed.

## Not verified

A local Windows build (Android Studio, JDK 21, hoisted pnpm) produces a working release APK. The GitHub Actions path (A) is not verified yet.
