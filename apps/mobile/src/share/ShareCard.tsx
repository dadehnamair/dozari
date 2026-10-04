import { forwardRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { SoloChart, YScale } from '@dozari/shared';
import { ChartView } from '../components/ChartView';
import { Wordmark } from '../components/Wordmark';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** Logical size; captured at 3x for a 1080x1350 image. */
export const CARD_W = 360;
export const CARD_H = 450;

/**
 * The share card (docs/logic/result-chart.md): logo, the group's title and chart, the four products, the «سال ۷۵ با ۱۰۰ تومن…» line
 * and the player's invite code. Rendered off screen and captured; never shown to the player.
 */
export const ShareCard = forwardRef<View, { group: SoloChart['groups'][number]; scale: YScale; line: string | null; code: string | null }>(function ShareCard({ group, scale, line, code }, ref) {
  return (
    <View ref={ref} collapsable={false} style={styles.card}>
      <View style={[styles.band, { backgroundColor: colors.group[group.level] }]} />
      <View style={styles.logo}><Wordmark width={150} /></View>
      <Text style={styles.title} numberOfLines={2}>{group.titleFa}</Text>
      <View style={styles.chart}><ChartView group={group} scale={scale} height={190} /></View>
      <View style={styles.names}>
        {group.items.map((it) => (
          <View key={it.productId} style={styles.chip}><Text style={styles.chipText} numberOfLines={1}>{it.nameFa}</Text></View>
        ))}
      </View>
      {line ? <Text style={styles.line}>{line}</Text> : null}
      <View style={styles.foot}>
        <Text style={styles.code}>{code ? fa.share.code(code) : ''}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: CARD_W, height: CARD_H, backgroundColor: '#2B1240', padding: 14, gap: 8, alignItems: 'center', overflow: 'hidden' },
  band: { position: 'absolute', top: 0, left: 0, right: 0, height: 8 },
  logo: { marginTop: 6 },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 30, color: colors.candy.yellow, textAlign: 'center' },
  chart: { width: '100%' },
  names: { flexDirection: ROW, flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.16)', maxWidth: 160 },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream },
  line: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: colors.cream, textAlign: 'center' },
  foot: { marginTop: 'auto', minHeight: 24, alignItems: 'center' },
  code: { fontFamily: fonts.bold, fontSize: 14, color: colors.candy.sky },
});
