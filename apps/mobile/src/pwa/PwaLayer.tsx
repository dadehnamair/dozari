import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { usePwa } from './usePwa';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/**
 * PWA notices over the whole app (D102): an offline strip on every screen; on Home only (never mid-match) the
 * «new version» bar and the install card. Renders nothing on native.
 */
export function PwaLayer({ home }: { home: boolean }) {
  const pwa = usePwa();
  const [ios, setIos] = useState(false);
  if (Platform.OS !== 'web') return null;
  const install = () => void pwa.promptInstall().then((r) => (r === 'ios' ? setIos(true) : pwa.dismissBanner()));
  return (
    <>
      {!pwa.online ? (
        <View style={styles.offline} pointerEvents="none" accessibilityLiveRegion="polite">
          <Text style={styles.offlineText}>{fa.pwa.offline}</Text>
        </View>
      ) : null}
      {home && pwa.update ? (
        <View style={[styles.bar, styles.updateBar]}>
          <Text style={styles.barText}>{fa.pwa.updateReady}</Text>
          <Pressable accessibilityRole="button" onPress={pwa.applyUpdate} style={styles.cta}>
            <Text style={styles.ctaText}>{fa.pwa.update}</Text>
          </Pressable>
        </View>
      ) : home && pwa.installBanner ? (
        <View style={styles.bar}>
          <View style={styles.icon}><Item icon="phone" /></View>
          <View style={styles.body}>
            <Text style={styles.title}>{fa.pwa.installTitle}</Text>
            <Text style={styles.small}>{fa.pwa.installText}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={install} style={styles.cta}>
              <Text style={styles.ctaText}>{fa.pwa.install}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={pwa.dismissBanner}>
              <Text style={styles.later}>{fa.pwa.later}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {ios ? <IosInstallSheet onClose={() => (setIos(false), pwa.dismissBanner())} /> : null}
    </>
  );
}

/** iPhone has no install prompt: the three Safari steps. */
export function IosInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.pwa.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.sheetTitle}>{fa.pwa.iosTitle}</Text>
        {fa.pwa.iosSteps.map((step, i) => (
          <View key={i} style={styles.step}>
            <View style={styles.num}><Text style={styles.numText}>{['۱', '۲', '۳'][i]}</Text></View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
        <Text style={styles.small}>{fa.pwa.iosNote}</Text>
        <Pressable accessibilityRole="button" onPress={onClose} style={[styles.cta, styles.sheetCta]}>
          <Text style={styles.ctaText}>{fa.pwa.close}</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const lift = { shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 };

const styles = StyleSheet.create({
  offline: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 60, paddingVertical: 5, paddingHorizontal: 12, backgroundColor: colors.candy.pink, borderBottomWidth: 3, borderColor: colors.ink },
  offlineText: { fontFamily: fonts.bold, fontSize: 12, color: '#fff', textAlign: 'center', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
  bar: { position: 'absolute', left: 12, right: 12, bottom: 128, zIndex: 40, maxWidth: 496, alignSelf: 'center', flexDirection: ROW, alignItems: 'center', gap: 8, padding: 10, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, ...lift },
  updateBar: { backgroundColor: colors.hi },
  barText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: TEXT_RIGHT },
  icon: { width: 40, height: 40 },
  body: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, textAlign: TEXT_RIGHT },
  small: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 18, color: '#5A3A7A', textAlign: TEXT_RIGHT },
  actions: { alignItems: 'center', gap: 4 },
  cta: { paddingHorizontal: 14, height: 38, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.lime, alignItems: 'center', justifyContent: 'center', ...lift },
  ctaText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  later: { fontFamily: fonts.bold, fontSize: 11, color: '#7E46D6' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { width: '100%', maxWidth: 360, gap: 10, padding: 16, borderRadius: 24, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, ...lift },
  sheetTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  step: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  num: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  stepText: { flex: 1, fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 20, color: colors.ink, textAlign: TEXT_RIGHT },
  sheetCta: { alignSelf: 'center', marginTop: 4 },
});
