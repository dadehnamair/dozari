import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { safeInsetTop } from '../theme/safeArea';
import { BASE_URL } from './http';
import { isServerDown, onServerDown, reportServer } from './health';

const RETRY_MS = 15_000;

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
    <View style={[styles.wrap, { top: safeInsetTop() + 6 }]} pointerEvents="none" accessibilityLiveRegion="polite">
      <View style={styles.strip}>
        <Text style={styles.text}>{fa.net.down}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, zIndex: 100, alignItems: 'center' },
  strip: { maxWidth: 420, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.yellow },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.ink, textAlign: 'center' },
});
