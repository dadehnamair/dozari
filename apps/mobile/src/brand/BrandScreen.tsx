import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CandyButton } from '../components/CandyButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import {
  AndroidForeground,
  AppIconArt,
  FaviconArt,
  IconBackdrop,
  LogoLight,
  LogoStacked,
  RingMark,
} from './BrandArt';

/**
 * Dev-only sheet of the brand art at export size. `scripts/export-brand.mjs` screenshots the elements with these
 * `nativeID`s into `assets/` (icon.png, adaptive-icon.png, ...); the web build renders them exactly as the app does.
 */
export function BrandScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <CandyButton label={fa.solo.back} color={colors.candy.sky} onPress={onBack} />
      <Item id="brand-icon" label="app-icon · 1024">
        <AppIconArt size={1024} />
      </Item>
      <Item id="brand-android-fg" label="android-fg · 1024 (transparent)">
        <AndroidForeground size={1024} />
      </Item>
      <Item id="brand-icon-female" label="app-icon · 1024 · female hero (launcher icon for female players)">
        <AppIconArt size={1024} who="dozariF" />
      </Item>
      <Item id="brand-android-fg-female" label="android-fg · 1024 · female hero (transparent)">
        <AndroidForeground size={1024} who="dozariF" />
      </Item>
      <Item id="brand-android-bg" label="android-bg · 1024">
        <View style={{ width: 1024, height: 1024, overflow: 'hidden' }}>
          <IconBackdrop size={1024} />
        </View>
      </Item>
      <Item id="brand-android-bg-female" label="android-bg · 1024 · rose (female launcher icon)">
        <View style={{ width: 1024, height: 1024, overflow: 'hidden' }}>
          <IconBackdrop size={1024} tone="rose" />
        </View>
      </Item>
      <Item id="brand-mono" label="icon-android-mono · 1024 (transparent)">
        <RingMark size={1024} color="#000000" />
      </Item>
      <Item id="brand-notification" label="icon-notification · 96 (transparent)">
        <RingMark size={96} color="#FFFFFF" />
      </Item>
      <Item id="brand-favicon" label="favicon · 48">
        <FaviconArt size={48} />
      </Item>
      <Item id="brand-logo-stacked" label="logo-stacked">
        <LogoStacked width={480} />
      </Item>
      <Item id="brand-logo-light" label="logo-wordmark · light bg">
        <View style={styles.light}>
          <LogoLight width={500} />
        </View>
      </Item>
    </ScrollView>
  );
}

function Item({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <View style={styles.item}>
      <Text style={styles.label}>{label}</Text>
      <View nativeID={id} style={{ alignSelf: 'flex-start' }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 16, gap: 24, backgroundColor: colors.bgTop, alignItems: 'flex-start' },
  item: { gap: 8 },
  label: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream },
  light: { backgroundColor: colors.cream, padding: 24, borderRadius: 24 },
});
