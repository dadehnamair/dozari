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
import { HomeScreen } from './src/home/HomeScreen';
import { onAccountSwitched } from './src/auth/switched';
import { useMusic } from './src/sound/music';
import { useHardwareBack } from './src/nav/useHardwareBack';
import { useKeyboardInset } from './src/nav/useKeyboardInset';
import { BrandScreen } from './src/brand/BrandScreen';
import { KitGallery } from './src/kit/KitGallery';
import { LookupScreen } from './src/lookup/LookupScreen';
import { SearchScreen } from './src/search/SearchScreen';
import { Tutorial } from './src/onboarding/Tutorial';
import { loginSeen, markLoginSeen, markTutorialSeen, tutorialSeen } from './src/onboarding/state';
import { LoginScreen } from './src/phone/LoginScreen';
import { SplashScreen } from './src/splash/SplashScreen';
import { DuelScreen } from './src/duel/DuelScreen';
import { SoloScreen } from './src/solo/SoloScreen';
import { useInviteLink } from './src/social/useInviteLink';
import { safeInsetTop } from './src/theme/safeArea';
import { PwaLayer } from './src/pwa/PwaLayer';
import { ServerDownBanner } from './src/net/ServerDownBanner';
import { takeLaunchTarget } from './src/pwa/usePwa';

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

export default function App() {
  const shell = useRef<View>(null);
  const keyboard = useKeyboardInset(shell);
  const config = useClientConfig();
  const phone = usePhoneGate(config.raw);
  const gate = gateState(config, APP_BUILD);
  useInviteLink(gate === 'ok' && config.features.friends);
  const [fontsLoaded] = useFonts({ Vazirmatn_400Regular, Vazirmatn_700Bold, Lalezar_400Regular });

  // Minimal navigation until a real router lands with the hub screen (docs/logic/app-screens.md).
  const [screen, setScreen] = useState<'splash' | 'login' | 'home' | 'solo' | 'daily' | 'duel' | 'tutorial' | 'duelResume' | 'gallery' | 'search' | 'brand' | 'lookup'>(
    'splash',
  );

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
    const timer = setTimeout(() => void Promise.all([tutorialSeen(), loginSeen()]).then(([seen, logged]) => alive && setScreen(BRAND_SHEET ? 'brand' : config.phoneLogin && !logged ? 'login' : !seen ? 'tutorial' : launchOn && launch ? launch : 'home')), SPLASH_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [fontsLoaded, screen, launch, launchOn, config.phoneLogin]);

  // The phone's back button leaves a full-screen mode for the screen it came from (sheets close first, they register later).
  useHardwareBack(
    screen === 'brand' || screen === 'search'
      ? () => setScreen('gallery')
      : screen === 'solo' || screen === 'daily' || screen === 'duel' || screen === 'duelResume' || screen === 'lookup' || screen === 'gallery'
        ? () => setScreen('home')
        : null,
  );

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
          onDone={(r) => void markLoginSeen().then(async () => (r.signedIn && !r.created ? (await markTutorialSeen(), setScreen('home')) : setScreen((await tutorialSeen()) ? 'home' : 'tutorial')))}
        />
      ) : null}
      {screen === 'solo' ? <SoloScreen onBack={() => setScreen('home')} hintsEnabled={config.features.shop} /> : null}
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
          onDaily={() => setScreen('daily')}
          onTutorial={() => setScreen('tutorial')}
          onDuel={() => setScreen('duel')}
          onDuelResume={() => setScreen('duelResume')}
          onLookup={() => setScreen('lookup')}
          features={config.features}
          settings={config.raw}
          onGallery={__DEV__ ? () => setScreen('gallery') : undefined}
        />
      ) : null}
      <ServerDownBanner />
      <PwaLayer home={screen === 'home'} />
    </View>
  );
}

const styles = StyleSheet.create({
  // On a notched phone the home-screen web app draws under the status bar: keep the screens below it (the band stays dark purple).
  container: { flex: 1, backgroundColor: '#2A0E52', paddingTop: safeInsetTop() },
  loadingArt: { width: 190, height: 190 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A0E52' },
});
