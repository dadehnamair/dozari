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
- Gradle needs Google's and Maven Central's repositories: from Iran run it with a working proxy (`~/.gradle/gradle.properties`, `systemProp.socksProxyHost/Port`) and make sure the proxy app is on. `scripts/build-android.ps1` does this itself: when `dl.google.com` is unreachable it asks for the local proxy (`host:port`, or `-Proxy 127.0.0.1:10808`), detects SOCKS5 vs HTTP, and writes it to `gradle.properties` between marker lines; If Google still answers 404 (it does for many foreign exit IPs), it installs `~/.gradle/init.d/dozari-mirror.gradle` so Gradle tries the Aliyun Google/Central mirrors first (JitPack still goes through the proxy). `-NoProxy` removes the proxy lines and the init script.

Quick check on a connected phone instead: `pnpm --filter @dozari/mobile android` (dev build, needs the dev server).

## Push notifications (FCM, optional)

Set these in the build environment (GitHub secrets or `apps/mobile/.env`) to include instant push: `FCM_PROJECT_ID`, `FCM_APP_ID`, `FCM_API_KEY`, `FCM_SENDER_ID` (Firebase console → Project settings → Your apps → Android `ir.dozari.app`). Without them the APK builds the same and relies on the background check. The server needs `FCM_SERVICE_ACCOUNT_JSON`. Details: `docs/logic/web-notifications.md`.

## Before a store release

Version: bump `version` in `app.json` (and `android.versionCode`). Icons, adaptive icon and notification icon are in `apps/mobile/assets`.
Gradle downloads AndroidX from Google's Maven at **build time**; that is a build tool, not a runtime dependency (rule 8), but from an
Iranian network use a mirror or build on GitHub (option A). Background music plays on a phone (rendered offline to a looping WAV, `src/sound/nativeMusic.ts`); sound effects are still web only (D89/D121).
The app forces RTL natively (`app.config.js`, `Application.onCreate`) so the first launch is already right-to-left, and on Android content is padded below the status bar (`nativeTopInset`) while backgrounds stay full-bleed.

## Not verified

A local Windows build (Android Studio, JDK 21, hoisted pnpm) produces a working release APK. The GitHub Actions path (A) is not verified yet.

## Store release (Myket / Bazaar) on your own computer

**Windows shortcut:** keep the repository in a short folder (`C:\d`), put the four `android.injected.signing.*` lines
(`store.file` with `/` slashes, `store.password`, `key.alias`, `key.password`) in `%USERPROFILE%\.gradle\gradle.properties`, then run
`powershell -ExecutionPolicy Bypass -File scripts\build-android.ps1 -Store myket`. It does the hoisted install, prebuild and Gradle build below.
Do not pass signing as `-Pandroid.injected...` on the PowerShell command line: PowerShell splits the argument at the first dot.
(Not run on Windows by the author of the script; fix it here if a step misbehaves.)

1. One-time: make the upload key and **back it up outside the repo (a lost key means no more updates)**:
   `keytool -genkeypair -v -keystore dozari-release.keystore -alias dozari -keyalg RSA -keysize 2048 -validity 10000`
2. Build (PowerShell; `EXPO_PUBLIC_STORE` = `myket` or `bazaar`):
   ```powershell
   $env:EXPO_PUBLIC_API_URL="https://api.mrbots.ir"; $env:EXPO_PUBLIC_STORE="myket"
   cd apps\mobile; Remove-Item -Recurse -Force android; pnpm exec expo prebuild --platform android
   cd android
   .\gradlew assembleRelease `
     -Pandroid.injected.signing.store.file="C:\keys\dozari-release.keystore" `
     -Pandroid.injected.signing.store.password="<store pass>" `
     -Pandroid.injected.signing.key.alias="dozari" `
     -Pandroid.injected.signing.key.password="<key pass>"
   ```
3. Check: `apksigner verify --print-certs app\build\outputs\apk\release\app-release.apk` must not show the Android Debug certificate.
4. Permissions: the manifest keeps only `INTERNET`, `READ_CONTACTS` (find friends) and `VIBRATE`; `app.json` `android.blockedPermissions` strips the storage, `WRITE_CONTACTS` and `SYSTEM_ALERT_WINDOW` ones that libraries add (stores flag them). Check `android/app/src/main/AndroidManifest.xml` after prebuild.
5. Every store update needs a higher `android.versionCode` in `apps/mobile/app.json` (and a new `version` for users); build one APK per market.

The `Android APK` workflow reads `FCM_PROJECT_ID`, `FCM_APP_ID`, `FCM_API_KEY`, `FCM_SENDER_ID`, `IRNOTI_PUSH_APP_KEY` (and optional `IRNOTI_API_BASE`) from GitHub repository secrets (Settings → Secrets and variables → Actions). Empty secrets are ignored. If a build fails, open Actions → Android APK → the failed run → the red step ("Generate the native Android project" or "Build the APK") and read the last lines.
