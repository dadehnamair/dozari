import { useEffect, useState } from 'react';
import { ActivityIndicator, I18nManager, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Lalezar_400Regular } from '@expo-google-fonts/lalezar';
import { useFonts, Vazirmatn_400Regular, Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn';
import { HomeScreen } from './src/home/HomeScreen';
import { BrandScreen } from './src/brand/BrandScreen';
import { KitGallery } from './src/kit/KitGallery';
import { SearchScreen } from './src/search/SearchScreen';
import { SplashScreen } from './src/splash/SplashScreen';
import { SoloScreen } from './src/solo/SoloScreen';

// Rule (CLAUDE.md §Language): in-game UI is Persian/RTL. Expo's managed I18nManager call is a
// no-op on web and only takes effect after a native reload, which is expected here.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

const SPLASH_MS = 1800;

export default function App() {
  const [fontsLoaded] = useFonts({ Vazirmatn_400Regular, Vazirmatn_700Bold, Lalezar_400Regular });

  // Minimal navigation until a real router lands with the hub screen (docs/logic/app-screens.md).
  const [screen, setScreen] = useState<'splash' | 'home' | 'solo' | 'gallery' | 'search' | 'brand'>(
    'splash',
  );

  useEffect(() => {
    if (!fontsLoaded || screen !== 'splash') return;
    const timer = setTimeout(() => setScreen('home'), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, screen]);

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#FFC93C" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      {screen === 'splash' ? <SplashScreen /> : null}
      {screen === 'solo' ? <SoloScreen onBack={() => setScreen('home')} /> : null}
      {screen === 'gallery' ? (
        <KitGallery
          onBack={() => setScreen('home')}
          onSearch={() => setScreen('search')}
          onBrand={() => setScreen('brand')}
        />
      ) : null}
      {screen === 'brand' ? <BrandScreen onBack={() => setScreen('gallery')} /> : null}
      {screen === 'search' ? <SearchScreen onCancel={() => setScreen('gallery')} /> : null}
      {screen === 'home' ? (
        <HomeScreen
          onSolo={() => setScreen('solo')}
          onGallery={__DEV__ ? () => setScreen('gallery') : undefined}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2A0E52' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A0E52' },
});
