import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import type { LedgerPage } from '@dozari/shared';
import { PageShell } from '../components/PageShell';
import { fa } from '../i18n/fa';
import { agoText } from '../inbox/ago';
import { colors, fonts } from '../theme/colors';
import { fetchLedger } from './api';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const fmt = (n: number) => toPersianDigits(Math.abs(n).toLocaleString('en-US').replace(/,/g, '٬'));

/** «تاریخچه‌ی سکه»: the player's own coin movements, newest first, opened by tapping the coin count on Home. */
export function LedgerSheet({ onClose }: { onClose: () => void }) {
  const [now] = useState(() => Date.now());
  const [page, setPage] = useState<LedgerPage | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const l = fa.ledger;

  const load = useCallback((before?: string | null) => {
    setLoading(true);
    fetchLedger(before).then(
      (p) => (setPage((cur) => (before && cur ? { ...p, items: [...cur.items, ...p.items] } : p)), setFailed(false)),
      () => setFailed(true),
    ).finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);

  return (
    <PageShell title={l.title} color={colors.candy.yellow} backLabel={l.close} onBack={onClose}>
      <ScrollView contentContainerStyle={styles.list}>
        {page ? <Text style={styles.balance}>{`${l.balance}: ${fmt(page.balance)} ${fa.home.hub.coins}`}</Text> : null}
        {failed ? <Text style={styles.note}>{l.error}</Text> : null}
        {page && page.items.length === 0 ? <Text style={styles.note}>{l.empty}</Text> : null}
        {page?.items.map((r) => (
          <View key={r.id} style={styles.card}>
            <View style={styles.body}>
              <Text style={styles.title}>{l.reasons[r.reason] ?? l.other}</Text>
              <Text style={styles.time}>{agoText(r.createdAt, now)}</Text>
            </View>
            <Text style={[styles.delta, r.delta >= 0 ? styles.gain : styles.loss]}>{`${r.delta >= 0 ? '+' : '−'}${fmt(r.delta)}`}</Text>
          </View>
        ))}
        {page?.next ? (
          <Pressable onPress={() => load(page.next)} disabled={loading} accessibilityRole="button" style={styles.more}>
            <Text style={styles.moreText}>{l.more}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingBottom: 24 },
  balance: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center', marginVertical: 6 },
  note: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center', marginTop: 12 },
  card: { flexDirection: ROW, alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff' },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, textAlign: 'right' },
  time: { fontFamily: fonts.bold, fontSize: 11, color: '#7A6A4A', textAlign: 'right' },
  delta: { fontFamily: fonts.display, fontSize: 18 },
  gain: { color: '#1F8A3B' },
  loss: { color: '#C23B3B' },
  more: { alignSelf: 'center', paddingHorizontal: 18, height: 36, borderRadius: 18, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
});
