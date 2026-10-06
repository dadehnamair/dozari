import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Character } from '../components/Character';
import { QrCode } from '../components/QrCode';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import type { GateVerdict } from './deviceGate';

/**
 * The phone-only card (D171) that replaces the app on a desktop browser (QR to scan), on an Android phone (download) and on an
 * iPhone (the install steps). «ادامه با مرورگر» is the escape hatch for testers and for anyone who really wants the browser.
 */
export function PhoneGate({ kind, address, download, onContinue }: { kind: Exclude<GateVerdict, 'pass'>; address: string; download: string | null; onContinue: () => void }) {
  const t = fa.phoneGate;
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.hero}><Character who="dozari" pose="wave" /></View>
          <Text style={styles.title}>{t.title}</Text>
          {kind === 'desktop' ? (
            <>
              <View style={styles.bubble}><Text style={styles.text}>{t.desktop}</Text></View>
              <View style={styles.qr}><QrCode value={address} size={220} /></View>
              <Text style={styles.addr} selectable>{address}</Text>
            </>
          ) : null}
          {kind === 'android' ? (
            <>
              <View style={styles.bubble}><Text style={styles.text}>{t.android}</Text></View>
              {download ? (
                <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(download)} style={styles.cta}>
                  <Text style={styles.ctaText}>{t.download}</Text>
                </Pressable>
              ) : (
                <Text style={styles.small}>{t.noDownload}</Text>
              )}
            </>
          ) : null}
          {kind === 'ios' ? (
            <>
              <View style={styles.bubble}><Text style={styles.text}>{t.ios}</Text></View>
              {fa.pwa.iosSteps.map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={styles.num}><Text style={styles.numText}>{['۱', '۲', '۳'][i]}</Text></View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
              <Text style={styles.small}>{fa.pwa.iosNote}</Text>
            </>
          ) : null}
          <Pressable accessibilityRole="button" onPress={onContinue} style={styles.later}>
            <Text style={styles.laterText}>{t.continue}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: colors.ink },
  scroll: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 440, alignItems: 'center', gap: 12, padding: 22, borderRadius: 26, borderWidth: 4, borderColor: colors.ink, backgroundColor: colors.cream },
  hero: { width: 150, height: 164 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.ink, textAlign: 'center' },
  bubble: { alignSelf: 'stretch', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFE9B0' },
  text: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 25, color: colors.ink, textAlign: 'center' },
  small: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 20, color: colors.ink, opacity: 0.7, textAlign: 'center' },
  qr: { padding: 8, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff' },
  addr: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, opacity: 0.8 },
  cta: { alignSelf: 'stretch', height: 50, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.lime, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  step: { flexDirection: ROW, alignItems: 'center', gap: 10, alignSelf: 'stretch' },
  num: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  stepText: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 22, color: colors.ink },
  later: { paddingVertical: 6, paddingHorizontal: 10 },
  laterText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textDecorationLine: 'underline', opacity: 0.75 },
});
