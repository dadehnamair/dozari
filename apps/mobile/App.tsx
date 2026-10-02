import { useEffect, useState } from 'react';
import { ActivityIndicator, I18nManager, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
// Per-weight imports: the package index pulls in all nine Vazirmatn weights, which the web export would ship and the
// PWA precache (D102); only these two are used. The files are bundled and self-hosted, never fetched from Google.
import { Lalezar_400Regular } from '@expo-google-fonts/lalezar/400Regular';
import { Vazirmatn_400Regular } from '@expo-google-fonts/vazirmatn/400Regular';
import { Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn/700Bold';
import { useFonts } from 'expo-font';
import { APP_BUILD } from './src/config/build';
import { GateScreen } from './src/config/GateScreen';
import { gateState } from './src/config/gate';
import { useClientConfig } from './src/config/useClientConfig';
import { HomeScreen } from './src/home/HomeScreen';
import { useMusic } from './src/sound/music';
import { BrandScreen } from './src/brand/BrandScreen';
import { KitGallery } from './src/kit/KitGallery';
import { LookupScreen } from './src/lookup/LookupScreen';
import { SearchScreen } from './src/search/SearchScreen';
import { Tutorial } from './src/onboarding/Tutorial';
import { markTutorialSeen, tutorialSeen } from './src/onboarding/state';
import { SplashScreen } from './src/splash/SplashScreen';
import { DuelScreen } from './src/duel/DuelScreen';
import { SoloScreen } from './src/solo/SoloScreen';
import { useInviteLink } from './src/social/useInviteLink';
import { safeInsetTop } from './src/theme/safeArea';
import { PwaLayer } from './src/pwa/PwaLayer';
import { takeLaunchTarget } from './src/pwa/usePwa';

// Rule (CLAUDE.md §Language): in-game UI is Persian/RTL. Expo's managed I18nManager call is a
// no-op on web and only takes effect after a native reload, which is expected here.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

const SPLASH_MS = 1800;

export default function App() {
  const config = useClientConfig();
  const gate = gateState(config, APP_BUILD);
  useInviteLink(gate === 'ok' && config.features.friends);
  const [fontsLoaded] = useFonts({ Vazirmatn_400Regular, Vazirmatn_700Bold, Lalezar_400Regular });

  // Minimal navigation until a real router lands with the hub screen (docs/logic/app-screens.md).
  const [screen, setScreen] = useState<'splash' | 'home' | 'solo' | 'daily' | 'duel' | 'tutorial' | 'duelResume' | 'gallery' | 'search' | 'brand' | 'lookup'>(
    'splash',
  );

  /** A home-screen shortcut (`?go=`, D102) opens its screen straight after the splash, when that mode is on. */
  const [launch] = useState(takeLaunchTarget);
  const launchOn = launch === 'solo' || (launch === 'daily' && config.features.daily) || (launch === 'duel' && config.features.duel);

  useEffect(() => {
    if (!fontsLoaded || screen !== 'splash') return;
    let alive = true;
    const timer = setTimeout(() => void tutorialSeen().then((seen) => alive && setScreen(!seen ? 'tutorial' : launchOn && launch ? launch : 'home')), SPLASH_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [fontsLoaded, screen, launch, launchOn]);

  // Soft music everywhere; a livelier loop during a duel (the competitive screens).
  useMusic(screen === 'splash' || screen === 'tutorial' ? null : screen === 'duel' || screen === 'duelResume' ? 'tense' : 'calm');

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#FFC93C" />
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
    <View style={styles.container}>
      <StatusBar style="light" />
      {screen === 'splash' ? <SplashScreen /> : null}
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
      <PwaLayer home={screen === 'home'} />
    </View>
  );
}

const styles = StyleSheet.create({
  // On a notched phone the home-screen web app draws under the status bar: keep the screens below it (the band stays dark purple).
  container: { flex: 1, backgroundColor: '#2A0E52', paddingTop: safeInsetTop() },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A0E52' },
});
