import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import type { MissionKey, ProfileTask } from '@dozari/shared';
import { GuideBubble } from '../components/GuideBubble';
import { PageShell } from '../components/PageShell';
import { EmptyNote } from '../components/EmptyState';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { claimProfileTask, fetchProfileTasks } from '../social/profileTasksApi';
import { missionRows } from './model';
import type { MissionAvailability, MissionGo, MissionRow } from './model';
import { TEXT_START } from '../theme/direction';

const ROW = ('row-reverse' as const);
const fmt = (n: number) => toPersianDigits(n.toLocaleString('en-US').replace(/,/g, '٬'));

/**
 * «ماموریت‌ها» (D163): one-time tasks that pay coins. In-app steps hand over to `onGo` (the owner opens the right screen);
 * outside links open here and unlock the claim (they cannot be verified, so they pay little).
 */
export function MissionsSheet({ avail, links, onGo, onClose, onChanged }: { avail: MissionAvailability; links: (key: MissionKey) => string | null; onGo: (go: Exclude<MissionGo, 'link'>) => void; onClose: () => void; onChanged: () => void }) {
  const [tasks, setTasks] = useState<ProfileTask[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [visited, setVisited] = useState<ReadonlySet<MissionKey>>(new Set());
  const [busy, setBusy] = useState<MissionKey | null>(null);
  const [got, setGot] = useState<string | null>(null);
  const m = fa.missions;

  const load = useCallback(() => void fetchProfileTasks().then((r) => (setTasks(r.tasks), setFailed(false)), () => setFailed(true)), []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!got) return;
    const timer = setTimeout(() => setGot(null), 3000);
    return () => clearTimeout(timer);
  }, [got]);

  const rows = useMemo(() => (tasks ? missionRows(tasks, avail, visited) : []), [tasks, avail, visited]);

  const claim = (row: MissionRow) => {
    setBusy(row.task.key);
    claimProfileTask(row.task.key).then((r) => (setGot(m.got(fmt(r.coins))), onChanged()), () => undefined).finally(() => (setBusy(null), load()));
  };
  const go = (row: MissionRow) => {
    if (row.go !== 'link') return onGo(row.go);
    const url = links(row.task.key);
    if (url) void Linking.openURL(url).catch(() => undefined);
    setVisited((cur) => new Set(cur).add(row.task.key));
  };

  return (
    <PageShell title={m.title} color={colors.candy.lime} backLabel={m.close} onBack={onClose}>
      <ScrollView contentContainerStyle={styles.list}>
        <GuideBubble who="baqal" text={got ?? m.hello} />
        {failed ? <Text style={styles.note}>{m.error}</Text> : null}
        {tasks && rows.length === 0 ? <EmptyNote skin={4} pose="sleeping" text={m.empty} /> : null}
        {rows.map((row) => (
          <View key={row.task.key} style={[styles.card, row.state === 'claimed' ? styles.cardDone : null]}>
            <View style={styles.body}>
              <Text style={styles.title}>{m.titles[row.task.key] ?? row.task.key}</Text>
              <Text style={styles.reward}>{m.reward(fmt(row.task.coins))}</Text>
            </View>
            {row.state === 'claimed' ? (
              <Text style={styles.done}>{m.claimed}</Text>
            ) : (
              <Pressable onPress={() => (row.state === 'claim' ? claim(row) : go(row))} disabled={busy === row.task.key} accessibilityRole="button" style={[styles.btn, row.state === 'claim' ? styles.btnClaim : null]}>
                <Text style={styles.btnText}>{row.state === 'claim' ? m.claim : m.go}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>
    </PageShell>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8, paddingBottom: 24 },
  note: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center', marginTop: 12 },
  card: { flexDirection: ROW, alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff' },
  cardDone: { opacity: 0.55 },
  body: { flex: 1, minWidth: 0, gap: 1 },
  title: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, textAlign: TEXT_START },
  reward: { fontFamily: fonts.bold, fontSize: 12, color: '#1F8A3B', textAlign: TEXT_START },
  done: { fontFamily: fonts.bold, fontSize: 13, color: '#7A6A4A' },
  btn: { paddingHorizontal: 18, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  btnClaim: { backgroundColor: colors.candy.lime },
  btnText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
});
