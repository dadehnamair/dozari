import { useState } from 'react';
import { ActivityIndicator, I18nManager, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Lalezar_400Regular } from '@expo-google-fonts/lalezar';
import { useFonts, Vazirmatn_400Regular, Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn';
import { CandyButton } from './src/components/CandyButton';
import { fa } from './src/i18n/fa';
import { SoloScreen } from './src/solo/SoloScreen';
import { colors } from './src/theme/colors';

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
      <View style={styles.container}>
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
        <>
          <Text style={styles.title}>{fa.home.title}</Text>
          <Text style={styles.tagline}>{fa.home.tagline}</Text>
          <CandyButton label={fa.home.soloButton} color={colors.candy.pink} onPress={() => setScreen('solo')} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A0E52',
    gap: 12,
  },
  title: {
    fontFamily: 'Lalezar_400Regular',
    fontSize: 56,
    color: '#FFF6E8',
  },
  tagline: {
    fontFamily: 'Vazirmatn_400Regular',
    fontSize: 16,
    color: '#FFF6E8',
  },
});
