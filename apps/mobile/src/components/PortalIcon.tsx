import { StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import type { PortalSpec } from '../kit/data';
import { candyTone, colors, fonts } from '../theme/colors';
import { Icon } from './Icon';

/** One of the ten big hub entrances: a candy tile with a white line icon and a Lalezar label. */
export function PortalIcon({ portal, size = 88 }: { portal: PortalSpec; size?: number }) {
  const tone = candyTone[portal.tone];
  return (
    <View style={styles.wrap}>
      <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3, backgroundColor: tone.base, borderTopColor: tone.light, borderBottomColor: tone.dark }]}>
        <Icon name={portal.icon} size={size * 0.5} color="#fff" strokeWidth={2.4} />
      </View>
      <Text style={styles.label}>{fa.kit.portals[portal.key]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6 },
  tile: { borderWidth: 3, borderColor: colors.ink, borderTopWidth: 5, borderBottomWidth: 9, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.display, fontSize: 18, color: colors.cream, textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
});
