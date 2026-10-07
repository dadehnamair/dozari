import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import { GuideBubble } from '../components/GuideBubble';
import { PageShell } from '../components/PageShell';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** What a counter in the Home top bar means: an intro on top, then how it is earned and what it is for (💎 الماس, 🔥 زنجیره). */
export function StatInfoSheet({ kind, value, onClose }: { kind: 'gems' | 'streak'; value: number; onClose: () => void }) {
  const t = fa.statInfo[kind];
  return (
    <PageShell title={t.title} color={kind === 'gems' ? colors.candy.sky : colors.candy.pink} backLabel={fa.statInfo.close} onBack={onClose}>
      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.hero}>
          <Text style={styles.glyph}>{kind === 'gems' ? '💎' : '🔥'}</Text>
          <Text style={styles.value}>{toPersianDigits(String(value))}</Text>
          <Text style={styles.unit}>{t.unit}</Text>
        </View>
        <Text style={styles.intro}>{t.intro}</Text>
        <GuideBubble who={kind === 'gems' ? 'baqal' : 'goli'} text={t.guide} />
        {t.sections.map((s) => (
          <View key={s.title} style={styles.card}>
            <Text style={styles.cardTitle}>{s.title}</Text>
            {s.lines.map((line) => (
              <View key={line} style={styles.line}>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.lineText}>{line}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingHorizontal: 14, paddingBottom: 32 },
  hero: { alignItems: 'center', gap: 2, paddingVertical: 6 },
  glyph: { fontSize: 52, lineHeight: 66 },
  value: { fontFamily: fonts.display, fontSize: 38, lineHeight: 50, color: colors.ink },
  unit: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, opacity: 0.7 },
  intro: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 26, color: colors.ink, textAlign: 'center' },
  card: { padding: 12, gap: 6, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FBF1DE' },
  cardTitle: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: TEXT_RIGHT },
  line: { flexDirection: ROW, alignItems: 'flex-start', gap: 6 },
  dot: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  lineText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 23, color: colors.ink, textAlign: TEXT_RIGHT },
});
