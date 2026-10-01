import { useState } from 'react';
import { ActivityIndicator, I18nManager, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Lalezar_400Regular } from '@expo-google-fonts/lalezar';
import { useFonts, Vazirmatn_400Regular, Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn';
import { HomeScreen } from './src/home/HomeScreen';
import { SoloScreen } from './src/solo/SoloScreen';

// Rule (CLAUDE.md §Language): in-game UI is Persian/RTL. Expo's managed I18nManager call is a
// no-op on web and only takes effect after a native reload, which is expected here.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function App() {
  const [fontsLoaded] = useFonts({ Vazirmatn_400Regular, Vazirmatn_700Bold, Lalezar_400Regular });

  // Minimal navigation until a real router lands with the hub screen (docs/logic/app-screens.md).
  const [screen, setScreen] = useState<'home' | 'solo'>('home');

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
      {screen === 'solo' ? (
        <SoloScreen onBack={() => setScreen('home')} />
      ) : (
        <HomeScreen onSolo={() => setScreen('solo')} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2A0E52' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A0E52' },
});
