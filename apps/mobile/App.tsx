import { useEffect, useRef, useState } from 'react';
import { I18nManager, Image, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import loadingArt from './assets/adaptive-icon.png';
import { initialWindowMetrics } from 'react-native-safe-area-context';
// Per-weight imports: the package index pulls in all nine Vazirmatn weights, which the web export would ship and the
// PWA precache (D102); only these two are used. The files are bundled and self-hosted, never fetched from Google.
import { Lalezar_400Regular } from '@expo-google-fonts/lalezar/400Regular';
import { Vazirmatn_400Regular } from '@expo-google-fonts/vazirmatn/400Regular';
import { Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn/700Bold';
import { useFonts } from 'expo-font';
import { APP_BUILD } from './src/config/build';
import { GateScreen } from './src/config/GateScreen';
import { PhoneGate } from './src/config/PhoneGate';
import { usePhoneGate } from './src/config/usePhoneGate';
import { gateState } from './src/config/gate';
import { useClientConfig } from './src/config/useClientConfig';
import type { ClientConfig } from './src/config/gate';
import { HomeScreen } from './src/home/HomeScreen';
import { onAccountSwitched } from './src/auth/switched';
import { useMusic } from './src/sound/music';
import { useHardwareBack } from './src/nav/useHardwareBack';
import { useMiniAppBack } from './src/miniapp/useMiniAppBack';
import { miniAppHost } from './src/miniapp/host';
import { installWebHistory } from './src/nav/webHistory';
import type { HistoryWindow } from './src/nav/webHistory';
import { useKeyboardInset } from './src/nav/useKeyboardInset';
import { BrandScreen } from './src/brand/BrandScreen';
import { KitGallery } from './src/kit/KitGallery';
import { LookupScreen } from './src/lookup/LookupScreen';
import { SearchScreen } from './src/search/SearchScreen';
import { Tutorial } from './src/onboarding/Tutorial';
import { loginSeen, markLoginSeen, markTutorialSeen, tutorialSeen } from './src/onboarding/state';
import type { AgeTrack } from '@dozari/shared';
import { LoginScreen } from './src/phone/LoginScreen';
import { bootTheme } from './src/theme/bootTheme';
import { installDarkTextShadowFix } from './src/theme/darkTextShadow';
import { AgeTrackScreen } from './src/agetrack/AgeTrackScreen';
import { ageTrackNeeded } from './src/agetrack/api';
import { useTrackRules } from './src/agetrack/useTrackRules';
import { SplashScreen } from './src/splash/SplashScreen';
import { DuelScreen } from './src/duel/DuelScreen';
import { SoloScreen } from './src/solo/SoloScreen';
import { useInviteLink } from './src/social/useInviteLink';
import { useMyTrack } from './src/agetrack/useMyTrack';
import { RestCardView } from './src/agetrack/RestCardView';
import { safeInsetTop } from './src/theme/safeArea';
import { PwaLayer } from './src/pwa/PwaLayer';
import { PriceOnlyScreen } from './src/priceonly/PriceOnlyScreen';
import { refillPack } from './src/offline/pack';
import { ServerDownBanner } from './src/net/ServerDownBanner';
import { takeLaunchTarget } from './src/pwa/usePwa';
import { ErrorBoundary } from './src/errors/ErrorBoundary';
import { installGlobalErrorReporting } from './src/errors/globalHandlers';
import { setCurrentScreen } from './src/errors/breadcrumbs';
import { setShotRoot } from './src/errors/screenshot';

installGlobalErrorReporting();

// The browser's and the installed PWA's Back / Forward drive the in-app back stack (not inside a messenger mini-app, which has its own back button).
if (Platform.OS === 'web' && !miniAppHost()) {
  const win = (globalThis as { window?: HistoryWindow }).window;
  if (win?.history) installWebHistory(win);
}

// The adult look has dark text on brass and silver faces: a shadow under it only smears, so it is dropped app-wide.
if (bootTheme() === 'adult') installDarkTextShadowFix();

// `?brand` on the web build opens the brand sheet directly (used by `scripts/export-brand.mjs`); read once, before anything rewrites the URL.
const BRAND_SHEET = Platform.OS === 'web' && new URLSearchParams((globalThis as { location?: { search?: string } }).location?.search ?? '').has('brand');

// Rule (CLAUDE.md §Language): in-game UI is Persian/RTL. Expo's managed I18nManager call is a
// no-op on web and only takes effect after a native reload, which is expected here.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}
// Coordinates (`left`/`right`, margins) stay physical like the web and the SVG art; only flex rows follow RTL.
// (react-native-web has no such method: calling it there crashed the whole web app at load.)
if (Platform.OS !== 'web') I18nManager.swapLeftAndRightInRTL(false);

const SPLASH_MS = 1800;
/** Android draws edge-to-edge, so a 3-button/gesture navigation bar would cover the bottom of every screen: keep it clear. */
const NAV_BAR_INSET = Platform.OS === 'android' ? Math.round(initialWindowMetrics?.insets.bottom ?? 0) : 0;

/** The whole app inside the safety net: a screen that throws shows a card and reports itself instead of leaving a blank page. */
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

function AppInner() {
  const shell = useRef<View>(null);
  useEffect(() => (setShotRoot(shell), () => setShotRoot(null)), []);
  const keyboard = useKeyboardInset(shell);
  const config = useClientConfig();
  const phone = usePhoneGate(config.raw);
  const gate = gateState(config, APP_BUILD);
  const inviteGate = useInviteLink(gate === 'ok' && config.features.friends);
  const ageTracksOn = config.raw['feature.age_tracks'] === 1;
  const myTrack = useMyTrack(ageTracksOn && gate === 'ok');
  const [fontsLoaded] = useFonts({ Vazirmatn_400Regular, Vazirmatn_700Bold, Lalezar_400Regular });

  // Minimal navigation until a real router lands with the hub screen (docs/logic/app-screens.md).
  /** A guardian's read-only look at the kid or teen space (no progress is saved). */
  const [previewTrack, setPreviewTrack] = useState<'kid' | 'teen' | null>(null);
  /** The track picked on the sign-in card (age tracks on); saved by the next screen. */
  const [pickedTrack, setPickedTrack] = useState<AgeTrack | null>(null);
  const [screen, setScreen] = useState<'splash' | 'login' | 'ageTrack' | 'home' | 'solo' | 'daily' | 'duel' | 'tutorial' | 'duelResume' | 'gallery' | 'search' | 'brand' | 'lookup' | 'priceonly'>(
    'splash',
  );
  // The screen name rides along with an error report.
  useEffect(() => setCurrentScreen(screen), [screen]);

  // A kid or teen track hides what needs adult content or price knowledge (docs/logic/age-tracks.md); the rules come from the server.
  const trackRules = useTrackRules(ageTracksOn, screen);
  const homeFeatures: ClientConfig['features'] = trackRules
    ? { ...config.features, daily: config.features.daily && trackRules.dailyPuzzle, priceonly: config.features.priceonly && trackRules.priceOnly, lookup: config.features.lookup && trackRules.lookup }
    : config.features;

  /** A home-screen shortcut (`?go=`, D102) opens its screen straight after the splash, when that mode is on. */
  const [launch] = useState(takeLaunchTarget);
  // Another account was loaded on this device (phone proof): remount every screen so nothing shows the old account.
  const [epoch, setEpoch] = useState(0);
  useEffect(() => onAccountSwitched(() => (setScreen('home'), setEpoch((e) => e + 1))), []);
  const launchOn = launch === 'solo' || (launch === 'daily' && config.features.daily) || (launch === 'duel' && config.features.duel);

  useEffect(() => {
    if (!fontsLoaded || screen !== 'splash') return;
    let alive = true;
    // First run: the sign-in screen (when the server can send codes), then the tutorial; a returning player goes straight on.
    const timer = setTimeout(
      () =>
        void Promise.all([tutorialSeen(), loginSeen()]).then(async ([seen, logged]) => {
          if (!alive) return;
          if (BRAND_SHEET) return setScreen('brand');
          if (config.phoneLogin && !logged) return setScreen('login');
          // The one-time «who is playing?» question (age tracks), only when the server switch is on and this account was never asked.
          if (await ageTrackNeeded(config.raw)) return alive && setScreen('ageTrack');
          setScreen(!seen ? 'tutorial' : launchOn && launch ? launch : 'home');
        }),
      SPLASH_MS,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [fontsLoaded, screen, launch, launchOn, config.phoneLogin, config.raw]);

  // The phone's back button leaves a full-screen mode for the screen it came from (sheets close first, they register later).
  useHardwareBack(
    screen === 'brand' || screen === 'search'
      ? () => setScreen('gallery')
      : screen === 'solo' || screen === 'priceonly' || screen === 'daily' || screen === 'duel' || screen === 'duelResume' || screen === 'lookup' || screen === 'gallery'
        ? () => setScreen('home')
        : null,
  );

  // Inside a mini-app the host's header back button does the same.
  useMiniAppBack();

  // Whenever Home is shown (so the player is signed in and probably online), keep the saved offline puzzles topped up.
  useEffect(() => {
    if (screen === 'home') void refillPack();
  }, [screen]);

  // Soft music everywhere; a livelier loop during a duel (the competitive screens).
  useMusic(screen === 'splash' || screen === 'tutorial' || screen === 'login' ? null : screen === 'duel' || screen === 'duelResume' ? 'tense' : 'calm');

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        {/* Static on purpose (no spinner): fonts are not loaded yet, so it is just the mascot on the splash colour. */}
        <Image source={loadingArt} style={styles.loadingArt} resizeMode="contain" accessibilityLabel="دوزاری" />
      </View>
    );
  }

  // Desktop browser → QR card, Android phone → download card, iPhone → install steps (D171); it waits for the saved «continue» choice.
  if (!phone.ready) return <View style={styles.container} />;
  if (phone.verdict !== 'pass') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <PhoneGate kind={phone.verdict} address={phone.address} download={phone.download} onContinue={phone.continueBrowser} />
      </View>
    );
  }

  if (gate !== 'ok') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <GateScreen kind={gate} message={config.maintenance.message} updateUrl={config.updateUrl} />
      </View>
    );
  }

  return (
    <View key={epoch} ref={shell} style={[styles.container, keyboard ? { marginBottom: keyboard } : NAV_BAR_INSET ? { paddingBottom: NAV_BAR_INSET } : null]}>
      <StatusBar style="light" />
      {screen === 'splash' ? <SplashScreen /> : null}
      {screen === 'login' ? (
        <LoginScreen
          ageTracksOn={config.raw['feature.age_tracks'] === 1}
          onDone={(r) =>
            void markLoginSeen().then(async () => {
              if (r.track) setPickedTrack(r.track);
              if (await ageTrackNeeded(config.raw)) return setScreen('ageTrack');
              if (r.signedIn && !r.created) return (await markTutorialSeen(), setScreen('home'));
              setScreen((await tutorialSeen()) ? 'home' : 'tutorial');
            })
          }
        />
      ) : null}
      {screen === 'ageTrack' ? <AgeTrackScreen initial={pickedTrack ?? undefined} onDone={() => void tutorialSeen().then((seen) => setScreen(seen ? 'home' : 'tutorial'))} /> : null}
      {screen === 'solo' ? <SoloScreen key={previewTrack ?? 'own'} previewTrack={previewTrack ?? undefined} onBack={() => (setPreviewTrack(null), setScreen('home'))} hintsEnabled={config.features.shop} ageTracksOn={config.raw['feature.age_tracks'] === 1} /> : null}
      {screen === 'priceonly' ? <PriceOnlyScreen onBack={() => setScreen('home')} /> : null}
      {screen === 'daily' ? <SoloScreen daily onBack={() => setScreen('home')} hintsEnabled={config.features.shop} /> : null}
      {screen === 'tutorial' ? <Tutorial onDone={() => void markTutorialSeen().then(() => setScreen('home'))} /> : null}
      {screen === 'duel' ? <DuelScreen onBack={() => setScreen('home')} settings={config.raw} /> : null}
      {screen === 'duelResume' ? <DuelScreen resume onBack={() => setScreen('home')} settings={config.raw} /> : null}
      {screen === 'gallery' ? (
        <KitGallery
          onBack={() => setScreen('home')}
          onSearch={() => setScreen('search')}
          onBrand={() => setScreen('brand')}
        />
      ) : null}
      {screen === 'lookup' ? <LookupScreen onBack={() => setScreen('home')} /> : null}
      {screen === 'brand' ? <BrandScreen onBack={() => setScreen('gallery')} /> : null}
      {screen === 'search' ? <SearchScreen onCancel={() => setScreen('gallery')} /> : null}
      {screen === 'home' ? (
        <HomeScreen
          onSolo={() => setScreen('solo')}
          onPriceOnly={() => setScreen('priceonly')}
          onDaily={() => setScreen('daily')}
          onTutorial={() => setScreen('tutorial')}
          onDuel={() => setScreen('duel')}
          onDuelResume={() => setScreen('duelResume')}
          onLookup={() => setScreen('lookup')}
          features={homeFeatures}
          settings={config.raw}
          myTrack={myTrack}
          onPreview={(t) => (setPreviewTrack(t), setScreen('solo'))}
          onGallery={__DEV__ ? () => setScreen('gallery') : undefined}
        />
      ) : null}
      <ServerDownBanner />
      <PwaLayer home={screen === 'home'} />
      {inviteGate}
      {myTrack.limits ? <RestCardView limits={myTrack.limits} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // On a notched phone the home-screen web app draws under the status bar: keep the screens below it (the band stays dark purple).
  container: { flex: 1, backgroundColor: '#2A0E52', paddingTop: safeInsetTop() },
  loadingArt: { width: 190, height: 190 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A0E52' },
});
