import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { RANDOM_TOPIC, toPersianDigits } from '@dozari/shared';
import type { DraftView } from '@dozari/shared';
import { SlabButton } from '../components/SlabButton';
import { MatchBackground } from '../game/MatchBackground';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { nativeTopInset } from '../theme/safeArea';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const t = fa.duel.topics;

/** Who named a round's topic, as a short label. */
const byText = (by: DraftView['picked'][number]['by'], you: 0 | 1): string => (by === 'system' ? t.bySystem : by === 'timeout' ? t.byTimeout : by === you ? t.byYou : t.byRival);

/**
 * The pre-match topic draft (themed-rounds.md): the sides take turns naming the topic of each round, a named topic closes, «تصادفی»
 * lets the game draw, and the last round of an odd count is the game's own. The server runs the clock and draws when it runs out.
 */
export function TopicDraft({ draft, now, onPick, onLeave }: { draft: DraftView; now: number; /** Resolves to an error text, or null when the server took it. */ onPick: (topic: string) => Promise<string | null>; onLeave: () => void }) {
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
    <MatchBackground>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.sub}>{t.sub}</Text>
        <View style={styles.rounds}>
          {slots.map((p, i) => (
            <View key={i} style={[styles.slot, p ? styles.slotDone : i === draft.round && !done ? styles.slotNow : null]}>
              <Text style={styles.slotRound}>{t.round(i + 1)}</Text>
              <Text style={styles.slotTopic} numberOfLines={1}>{p ? p.nameFa : '؟'}</Text>
              {p ? <Text style={styles.slotBy}>{byText(p.by, draft.you)}</Text> : null}
            </View>
          ))}
        </View>
        {done ? (
          <Text style={styles.wait}>{t.starting}</Text>
        ) : draft.yourTurn ? (
          <View style={styles.panel}>
            <Text style={styles.ask}>{t.yourPick(draft.round + 1)} · {toPersianDigits(String(secs))}</Text>
            <View style={styles.grid}>
              {draft.open.map((o) => (
                <Pressable key={o.id} accessibilityRole="button" disabled={busy} onPress={() => void pick(o.id)} style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}>
                  <Text style={styles.chipText}>{o.nameFa}</Text>
                </Pressable>
              ))}
            </View>
            <SlabButton label={t.random} sfx="confirm" color={colors.candy.yellow} height={52} fontSize={20} onPress={() => void pick(RANDOM_TOPIC)} disabled={busy} />
            {note ? <Text style={styles.error}>{note}</Text> : null}
          </View>
        ) : (
          <Text style={styles.wait}>{draft.chooser === 'system' ? t.systemPicking : draft.chooserName ? t.playerPicking(draft.chooserName, draft.round + 1) : t.rivalPicking(draft.round + 1)} · {toPersianDigits(String(secs))}</Text>
        )}
        <SlabButton label={fa.duel.leave} sfx="back" color={colors.candy.sky} height={50} fontSize={18} onPress={onLeave} />
      </ScrollView>
    </MatchBackground>
  );
}

const styles = StyleSheet.create({
  screen: { flexGrow: 1, alignItems: 'stretch', gap: 12, paddingHorizontal: 16, paddingTop: 24 + nativeTopInset(), paddingBottom: 28, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { fontFamily: fonts.display, fontSize: 28, color: colors.candy.yellow, textAlign: 'center' },
  sub: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.cream, textAlign: 'center', opacity: 0.85 },
  rounds: { flexDirection: ROW, gap: 8, justifyContent: 'center', flexWrap: 'wrap' },
  slot: { minWidth: 92, flexGrow: 1, flexBasis: 92, padding: 8, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', gap: 2 },
  slotNow: { borderColor: colors.candy.yellow },
  slotDone: { backgroundColor: '#E1F7C9' },
  slotRound: { fontFamily: fonts.bold, fontSize: 11, color: colors.cream },
  slotTopic: { fontFamily: fonts.display, fontSize: 17, color: colors.cream },
  slotBy: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, opacity: 0.7 },
  panel: { gap: 10, padding: 14, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper },
  ask: { fontFamily: fonts.display, fontSize: 18, color: colors.ink, textAlign: 'center' },
  grid: { flexDirection: ROW, flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.sky },
  chipPressed: { transform: [{ translateY: 2 }] },
  chipText: { fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  wait: { fontFamily: fonts.bold, fontSize: 16, color: colors.cream, textAlign: 'center', paddingVertical: 18 },
  error: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E', textAlign: 'center' },
});
