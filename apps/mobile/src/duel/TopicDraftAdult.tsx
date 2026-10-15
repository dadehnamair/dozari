import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RANDOM_TOPIC, toPersianDigits } from '@dozari/shared';
import type { DraftView } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { fonts } from '../theme/colors';
import { nativeTopInset } from '../theme/safeArea';
import { AdultBackdrop, BrassButton, Plate } from './adultKit';

const t = fa.duel.topics;
const byText = (by: DraftView['picked'][number]['by'], you: 0 | 1): string => (by === 'system' ? t.bySystem : by === 'timeout' ? t.byTimeout : by === you ? t.byYou : t.byRival);

/** Adult look of the pre-match topic draft: a plate per round, then the open topics as copper chips and «تصادفی» as a brass button. */
export function TopicDraftAdult({ draft, now, onPick, onLeave }: { draft: DraftView; now: number; onPick: (topic: string) => Promise<string | null>; onLeave: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const secs = Math.max(0, Math.ceil((draft.endsAt - now) / 1000));
  const pick = async (topic: string) => {
    if (busy) return;
    setBusy(true);
    setNote(await onPick(topic));
    setBusy(false);
  };
  const slots = Array.from({ length: draft.rounds }, (_, i) => draft.picked.find((p) => p.round === i) ?? null);
  const done = draft.status === 'done';
  return (
    <AdultBackdrop>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.sub}>{t.sub}</Text>
        <View style={styles.rounds}>
          {slots.map((p, i) => (
            <View key={i} style={styles.slotWrap}>
              <Plate radius={14} border={p ? '#9FE870' : i === draft.round && !done ? '#E8B64A' : '#5A3A1C'} from={p ? '#22480F' : '#2A1E16'} to={p ? '#143008' : '#17100C'} ledge={3} style={styles.slot}>
                <Text style={styles.slotRound}>{t.round(i + 1)}</Text>
                <Text style={styles.slotTopic} numberOfLines={1}>{p ? p.nameFa : '؟'}</Text>
                {p ? <Text style={styles.slotBy}>{byText(p.by, draft.you)}</Text> : null}
              </Plate>
            </View>
          ))}
        </View>
        {done ? (
          <Text style={styles.wait}>{t.starting}</Text>
        ) : draft.yourTurn ? (
          <Plate radius={20} border="#E0895A" ledge={5} style={styles.panel}>
            <Text style={styles.ask}>{t.yourPick(draft.round + 1)} · {toPersianDigits(String(secs))}</Text>
            <View style={styles.grid}>
              {draft.open.map((o) => (
                <Pressable key={o.id} accessibilityRole="button" disabled={busy} onPress={() => void pick(o.id)} style={({ pressed }) => (pressed ? styles.pressed : null)}>
                  <Plate radius={14} border="#8A5A16" ledge={3} style={styles.chip}><Text style={styles.chipText}>{o.nameFa}</Text></Plate>
                </Pressable>
              ))}
            </View>
            <BrassButton label={t.random} tone="gold" height={50} disabled={busy} onPress={() => void pick(RANDOM_TOPIC)} />
            {note ? <Text style={styles.error}>{note}</Text> : null}
          </Plate>
        ) : (
          <Text style={styles.wait}>{draft.chooser === 'system' ? t.systemPicking : draft.chooserName ? t.playerPicking(draft.chooserName, draft.round + 1) : t.rivalPicking(draft.round + 1)} · {toPersianDigits(String(secs))}</Text>
        )}
        <BrassButton label={fa.duel.leave} tone="dark" height={48} onPress={onLeave} />
      </ScrollView>
    </AdultBackdrop>
  );
}

const styles = StyleSheet.create({
  screen: { direction: 'rtl', flexGrow: 1, alignItems: 'stretch', gap: 12, paddingHorizontal: 16, paddingTop: 24 + nativeTopInset(), paddingBottom: 28, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 40, color: '#FFE9A8', textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: 'rgba(255,233,168,0.8)', textAlign: 'center' },
  rounds: { flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  slotWrap: { minWidth: 92, flexGrow: 1, flexBasis: 92 },
  slot: { padding: 8, alignItems: 'center', gap: 2 },
  slotRound: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,233,168,0.7)' },
  slotTopic: { fontFamily: fonts.display, fontSize: 17, lineHeight: 26, color: '#FFE9A8' },
  slotBy: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,233,168,0.65)' },
  panel: { gap: 10, padding: 14 },
  ask: { fontFamily: fonts.display, fontSize: 18, lineHeight: 28, color: '#FFE9A8', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 6 },
  chipText: { fontFamily: fonts.display, fontSize: 17, lineHeight: 26, color: '#FFE9A8' },
  pressed: { transform: [{ translateY: 2 }] },
  wait: { fontFamily: fonts.bold, fontSize: 16, color: '#FFE9A8', textAlign: 'center', paddingVertical: 18 },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#FF9A8A', textAlign: 'center' },
});
