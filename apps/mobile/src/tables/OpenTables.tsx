import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PublicTable, TableView } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { avatarOf } from '../social/avatarOf';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';
import { fetchMyTable, fetchPublicTables, requestSeat } from './api';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const INK = '#3A2418';
const o = fa.tables.openList;
const TONE: Record<PublicTable['status'], string> = { open: '#7ED957', full: '#FFAA7A', playing: '#FFC93C', locked: '#C9A3FF', closed: '#D0C6C0' };
const POLL_MS = 3000;

/**
 * The «میزهای باز» tab: every public table with its rounds, entry and seats. Open ones take a request (the host answers);
 * full, locked, playing and recently closed ones are listed with their status and are view only, so the list is rarely bare.
 * When the host lets the player in, the table they now sit at opens.
 */
export function OpenTables({ onSeated, onNote, errText }: { onSeated: (table: TableView) => void; onNote: (text: string | null) => void; errText: (e: unknown) => string }) {
  const [rows, setRows] = useState<PublicTable[] | null>(null);
  const seen = useRef<Set<string>>(new Set());
  const load = useCallback(() => {
    fetchPublicTables().then(
      (list) => {
        setRows(list);
        // A request that was answered while this list is open: «denied» shows once, and an accepted one seats the player.
        for (const r of list) if (r.yourRequest === 'denied' && !seen.current.has(r.code)) {
          seen.current.add(r.code);
          onNote(o.declined);
        }
      },
      () => setRows((cur) => cur ?? []),
    );
    fetchMyTable().then((t) => {
      if (!t) return;
      onNote(o.accepted);
      onSeated(t);
    }, () => undefined);
  }, [onNote, onSeated]);
  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const ask = (code: string) =>
    requestSeat(code).then(
      () => (onNote(o.sent), setRows((cur) => cur?.map((r) => (r.code === code ? { ...r, yourRequest: 'pending' as const } : r)) ?? cur)),
      (e) => (onNote(errText(e)), load()),
    );

  return (
    <View style={styles.wrap}>
      <Text style={styles.intro}>{o.intro}</Text>
      {rows && rows.length === 0 ? <Text style={styles.empty}>{o.empty}</Text> : null}
      {rows?.map((r) => {
        const live = r.status === 'open';
        return (
          <View key={`${r.code}-${r.status}`} style={[styles.card, live ? null : styles.cardDim]}>
            <View style={styles.top}>
              <View style={styles.icon}><Item icon={r.icon} /></View>
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
                <View style={styles.hostRow}>
                  <Avatar avatar={avatarOf(r.hostAvatarKey)} size={20} />
                  <Text style={styles.sub} numberOfLines={1}>{o.host(r.hostNickname)}</Text>
                </View>
              </View>
              <View style={[styles.chip, { backgroundColor: TONE[r.status] }]}><Text style={styles.chipText}>{o.status[r.status]}</Text></View>
            </View>
            <Text style={styles.facts}>
              {r.format === '2v2' ? fa.tables.format2v2 : fa.tables.format1v1} · {fa.tables.rounds(r.rounds)} · {fa.tables.entry(r.entryFee)} · {o.seats(r.taken, r.seats)}
            </Text>
            {live ? (
              r.yourRequest === 'pending' ? <Text style={styles.waiting}>{o.pending}</Text>
              : <Pressable onPress={() => void ask(r.code)} style={styles.ask} accessibilityRole="button"><Text style={styles.askText}>{r.yourRequest === 'denied' ? `${o.denied} · ${o.ask}` : o.ask}</Text></Pressable>
            ) : <Text style={styles.viewOnly}>{o.viewOnly}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  intro: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 21, color: INK, opacity: 0.85, textAlign: TEXT_RIGHT },
  empty: { fontFamily: fonts.bold, fontSize: 13, color: INK, textAlign: 'center', paddingVertical: 14 },
  card: { gap: 6, padding: 10, borderRadius: 16, borderWidth: 3, borderColor: INK, backgroundColor: '#fff' },
  cardDim: { backgroundColor: '#F1ECE6' },
  top: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  icon: { width: 40, height: 40 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 17, color: INK, textAlign: TEXT_RIGHT },
  hostRow: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  sub: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.8 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, borderWidth: 2, borderColor: INK },
  chipText: { fontFamily: fonts.bold, fontSize: 11, color: INK },
  facts: { fontFamily: fonts.bold, fontSize: 12, color: INK, textAlign: TEXT_RIGHT },
  ask: { alignSelf: 'stretch', height: 38, borderRadius: 12, borderWidth: 2.5, borderColor: INK, backgroundColor: colors.candy.lime, alignItems: 'center', justifyContent: 'center' },
  askText: { fontFamily: fonts.display, fontSize: 15, color: INK },
  waiting: { fontFamily: fonts.bold, fontSize: 12.5, color: '#7E46D6', textAlign: 'center' },
  viewOnly: { fontFamily: fonts.bold, fontSize: 11.5, color: INK, opacity: 0.55, textAlign: 'center' },
});
