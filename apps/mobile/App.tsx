import { useEffect } from 'react';
import { ActivityIndicator, I18nManager, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Vazirmatn_400Regular, Vazirmatn_700Bold } from '@expo-google-fonts/vazirmatn';
import { rialsToTomanString } from '@dozari/shared';
import { fa } from './src/i18n/fa';

// Rule (CLAUDE.md §Language): in-game UI is Persian/RTL. Expo's managed I18nManager call is a
// no-op on web and only takes effect after a native reload, which is expected here.
if (!I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}

export default function App() {
  const [fontsLoaded] = useFonts({ Vazirmatn_400Regular, Vazirmatn_700Bold });

  useEffect(() => {
    // placeholder screen only — real navigation/screens land in later phases per docs/PLAN.md.
  }, []);

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
      <Text style={styles.title}>{fa.home.title}</Text>
      <Text style={styles.tagline}>{fa.home.tagline}</Text>
      <Text style={styles.sample}>{rialsToTomanString(1_500)}</Text>
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
    fontFamily: 'Vazirmatn_700Bold',
    fontSize: 32,
    color: '#FFF6E8',
  },
  tagline: {
    fontFamily: 'Vazirmatn_400Regular',
    fontSize: 16,
    color: '#FFF6E8',
  },
  sample: {
    fontFamily: 'Vazirmatn_400Regular',
    fontSize: 14,
    color: '#FFC93C',
  },
});
