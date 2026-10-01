import { StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { fa } from '../i18n/fa';
import type { StampSpec } from '../kit/data';
import { colors, fonts } from '../theme/colors';

/** Round "decade" rubber stamp, slightly rotated. */
export function EraStamp({ stamp, size = 124 }: { stamp: StampSpec; size?: number }) {
  return (
    <View
      style={[styles.outer, { width: size, height: size, borderRadius: size / 2, borderColor: stamp.color, transform: [{ rotate: `${stamp.rotate}deg` }] }]}
      accessibilityLabel={`${fa.kit.decade} ${toPersianDigits(stamp.decade)}`}
    >
      <View style={[styles.inner, { borderColor: stamp.color, borderRadius: size / 2 }]}>
        <Text style={[styles.brand, { color: stamp.color, fontSize: size * 0.09 }]}>DOZARI</Text>
        <Text style={[styles.title, { color: stamp.color, fontSize: size * 0.225, lineHeight: size * 0.26 }]}>{fa.kit.decade} {toPersianDigits(stamp.decade)}</Text>
        <Text style={[styles.stars, { color: stamp.color, fontSize: size * 0.13 }]}>★ ★ ★</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.cream, borderWidth: 4, borderStyle: 'dashed', padding: 6 },
  inner: { flex: 1, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  brand: { letterSpacing: 2, fontWeight: '700' },
  title: { fontFamily: fonts.display, textAlign: 'center' },
  stars: { fontFamily: fonts.display },
});
