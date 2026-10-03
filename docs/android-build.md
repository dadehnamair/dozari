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

Quick check on a connected phone instead: `pnpm --filter @dozari/mobile android` (dev build, needs the dev server).

## Before a store release

Version: bump `version` in `app.json` (and `android.versionCode`). Icons, adaptive icon and notification icon are in `apps/mobile/assets`.
Gradle downloads AndroidX from Google's Maven at **build time**; that is a build tool, not a runtime dependency (rule 8), but from an
Iranian network use a mirror or build on GitHub (option A). Native sound is still silent (web only, D89/D121).

## Not verified

This pipeline was written in a container with no Android SDK and no access to Google's repositories, so **no APK has been built yet**.
The first run may need small fixes (SDK version, a native module). Send the failing step's log.
