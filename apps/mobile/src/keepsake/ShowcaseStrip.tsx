import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import type { ShowcaseView } from '@dozari/shared';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchShowcase } from './api';
import { RARITY_COLOR } from './model';
import { YadegarMedal, yadegarCard } from './YadegarArt';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const t = fa.treasury.showcase;

/** The pinned keepsakes of a player and how much of the treasury they have (their profile's shop window). Draws nothing until it knows there is something to show. */
export function ShowcaseStrip({ playerId }: { playerId: string }) {
  const [v, setV] = useState<ShowcaseView | null>(null);
  useEffect(() => {
    let alive = true;
    fetchShowcase(playerId).then(
      (x) => alive && setV(x),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [playerId]);
  if (!v || v.total === 0) return null;
  return (
    <View style={styles.box} accessibilityLabel={t.title}>
      <View style={styles.head}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.sub}>{t.complete(v.percent)}</Text>
      </View>
      {v.items.length === 0 ? (
        <Text style={styles.empty}>{t.empty}</Text>
      ) : (
        <View style={styles.row}>
          {v.items.map((k) => (
            <View key={k.id} style={[styles.slot, yadegarCard(k.artKey) ? styles.slotMedal : { backgroundColor: RARITY_COLOR[k.rarity] }]} accessibilityLabel={k.titleFa}>
              {yadegarCard(k.artKey) ? <YadegarMedal card={yadegarCard(k.artKey)!} size={50} /> : <View style={styles.icon}><Item icon={k.iconKey ?? 'coin'} /></View>}
              {k.level > 1 ? <Text style={styles.level}>{toPersianDigits(String(k.level))}</Text> : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', gap: 6, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: 'rgba(255,255,255,0.7)' },
  head: { flexDirection: ROW, justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, opacity: 0.7 },
  empty: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.6, textAlign: 'center' },
  row: { flexDirection: ROW, flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  slot: { width: 46, height: 46, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  slotMedal: { width: 52, height: 52, borderRadius: 26, borderWidth: 0, backgroundColor: 'transparent' },
  icon: { width: 34, height: 34 },
  level: { position: 'absolute', bottom: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, textAlign: 'center', fontFamily: fonts.bold, fontSize: 10, lineHeight: 16, color: colors.candy.yellow, backgroundColor: colors.ink, overflow: 'hidden' },
});
