import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';
import { safeInsetTop, nativeTopInset } from '../theme/safeArea';
import { BASE_URL } from './http';
import { isServerDown, onServerDown, reportServer } from './health';

const RETRY_MS = 15_000;
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** A calm strip when the server is not answering: «don't worry, we'll be back soon». It re-checks `/health` itself and goes away on its own. */
export function ServerDownBanner() {
  const [down, setDown] = useState(isServerDown());
  useEffect(() => onServerDown(setDown), []);
  useEffect(() => {
    if (!down) return undefined;
    const timer = setInterval(() => {
      fetch(`${BASE_URL}/health`).then((r) => reportServer(r.ok), () => reportServer(false));
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [down]);
  if (!down) return null;
  return (
    <View style={[styles.wrap, { top: safeInsetTop() + nativeTopInset() + 6 }]} pointerEvents="none" accessibilityLiveRegion="polite">
      <View style={styles.strip}>
        <View style={styles.dot} />
        <View style={styles.body}>
          <Text style={styles.title}>{fa.net.downTitle}</Text>
          <Text style={styles.text}>{fa.net.down}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 100, alignItems: 'center' },
  strip: { maxWidth: 420, flexDirection: ROW, alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.pink, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.card },
  body: { flexShrink: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 17, lineHeight: 26, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, textAlign: TEXT_RIGHT },
  text: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 19, color: '#fff', textAlign: TEXT_RIGHT },
});
