import { StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import type { TagSpec } from '../kit/data';
import { candyTone, colors, fonts } from '../theme/colors';
import { Icon } from './Icon';

/** Profile tag: icon medallion plus label on a candy pill. */
export function TagPill({ tag }: { tag: TagSpec }) {
  const tone = candyTone[tag.tone];
  return (
    <View style={[styles.pill, { backgroundColor: tone.base, borderTopColor: tone.light }]}>
      <View style={styles.medal}>
        <Icon name={tag.icon} size={16} color="#fff" strokeWidth={2.6} />
      </View>
      <Text style={styles.label}>{fa.kit.tags[tag.key]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { height: 42, paddingStart: 6, paddingEnd: 16, borderRadius: 99, borderWidth: 3, borderColor: colors.ink, borderBottomWidth: 6, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  medal: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.display, fontSize: 18, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
});
