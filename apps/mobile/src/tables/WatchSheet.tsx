import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TABLE_REACTIONS } from '@dozari/shared';
import type { TableWatch } from '@dozari/shared';
import { Board } from '../components/Board';
import { CandyButton } from '../components/CandyButton';
import { Item } from '../components/Item';
import { characterFor } from '../duel/arena';
import { MatchHud } from '../duel/MatchHud';
import { boardSolved } from '../duel/model';
import { fa } from '../i18n/fa';
import { useHardwareBack } from '../nav/useHardwareBack';
import { colors, fonts } from '../theme/colors';
import { fetchWatch, reactAtTable } from './api';

const INK = '#3A2418';
const POLL_MS = 2000;
const w = fa.tables.watch;
const noop = () => undefined;

/** Stands of a playing public table: the board as it is now, the players and the score, read only. Polls the server; it ends when the match does. */
export function WatchSheet({ code, onClose }: { code: string; onClose: () => void }) {
  useHardwareBack(onClose);
  const [data, setData] = useState<TableWatch | null>(null);
  const [gone, setGone] = useState(false);
  const [wait, setWait] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    const load = () => void fetchWatch(code).then((d) => alive && setData(d), () => alive && setGone(true));
    load();
    const id = setInterval(() => (setNow(Date.now()), load()), POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [code]);
  const view = data?.view;
  const side = (s: 0 | 1) => (data?.players ?? []).filter((p) => p.side === s);
  const nameOf = (s: 0 | 1) => side(s).map((p) => p.nickname).reduce((acc, n) => (acc ? w.teamOf(acc, n) : n), '');
  const finished = view?.status === 'finished';
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={w.back}>
      <Pressable style={styles.sheet} onPress={noop}>
        <View style={styles.titleRow}>
          {data ? <View style={styles.titleIcon}><Item icon={data.icon} /></View> : null}
          <Text style={styles.title} numberOfLines={1}>{data?.name ?? w.title}</Text>
        </View>
        {gone ? <Text style={styles.note}>{w.gone}</Text> : null}
        {data && view ? (
          <ScrollView style={styles.list} contentContainerStyle={styles.content}>
            <MatchHud
              me={{ name: nameOf(0), who: characterFor(side(0)[0]?.avatarKey ?? nameOf(0)), score: view.scores[0], groups: view.solved.filter((g) => g.by === 0).length, active: !finished && view.turn === 0 }}
              rival={{ name: nameOf(1), who: characterFor(side(1)[0]?.avatarKey ?? nameOf(1)), score: view.scores[1], groups: view.solved.filter((g) => g.by === 1).length, active: !finished && view.turn === 1 }}
            />
            <Text style={styles.note}>
              {finished ? w.over : data.inPriceRound ? w.price : w.turn(nameOf(view.turn))}
              {view.rounds && view.rounds > 1 ? ` · ${w.round((view.round ?? 0) + 1, view.rounds)}` : ''} · {w.watchers(data.watchers)}
            </Text>
            {!finished && !data.inPriceRound ? <Text style={styles.clock}>{w.clock(Math.max(0, Math.ceil((view.turnEndsAt - now) / 1000)))}</Text> : null}
            <Board solved={boardSolved(view)} cards={view.cards} names={data.names} selected={[]} onToggle={noop} disabled muted={false} />
            {data.reactions.length > 0 ? (
              <View style={styles.cheerFeed}>
                {data.reactions.map((r, i) => <Text key={`${i}-${r.nickname}-${r.kind}`} style={styles.cheerLine} numberOfLines={1}>{w.cheerFrom(r.nickname, w.cheers[r.kind] ?? '')}</Text>)}
              </View>
            ) : null}
            <View style={styles.cheerRow}>
              {TABLE_REACTIONS.map((k) => (
                <Pressable key={k} accessibilityRole="button" accessibilityLabel={w.cheerTitle} style={styles.cheerBtn} onPress={() => void reactAtTable(code, k).then(() => setWait(false), () => setWait(true))}>
                  <Text style={styles.cheerIcon}>{w.cheers[k]}</Text>
                </Pressable>
              ))}
            </View>
            {wait ? <Text style={styles.hint}>{w.cheerWait}</Text> : null}
            <Text style={styles.recentTitle}>{w.recentTitle}</Text>
            {data.recent.length === 0 ? <Text style={styles.hint}>{w.noGuessYet}</Text> : null}
            {[...data.recent].reverse().map((g, i) => (
              <View key={`${i}-${g.names.join('')}`} style={[styles.guess, { borderColor: g.side === 0 ? colors.candy.sky : colors.candy.pink }]}>
                <Text style={styles.guessText} numberOfLines={2}>{g.names.join('، ')}</Text>
                <Text style={[styles.outcome, g.outcome === 'correct' ? styles.ok : g.outcome === 'one_away' ? styles.near : styles.bad]}>{w.outcome[g.outcome]}</Text>
              </View>
            ))}
            <Text style={styles.hint}>{w.readOnly}</Text>
          </ScrollView>
        ) : null}
        <CandyButton label={w.back} sfx="back" color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 12 },
  sheet: { width: '100%', maxWidth: 460, maxHeight: '94%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 12, gap: 8, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  titleIcon: { width: 32, height: 32 },
  title: { fontFamily: fonts.display, fontSize: 20, color: INK, flexShrink: 1 },
  list: { alignSelf: 'stretch', flexGrow: 0 },
  content: { gap: 8 },
  note: { fontFamily: fonts.bold, fontSize: 13, color: INK, textAlign: 'center' },
  cheerFeed: { gap: 2, alignItems: 'center' },
  cheerLine: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.85 },
  cheerRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  cheerBtn: { width: 46, height: 40, borderRadius: 12, borderWidth: 2.5, borderColor: INK, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  cheerIcon: { fontSize: 20 },
  clock: { fontFamily: fonts.display, fontSize: 18, color: INK, textAlign: 'center' },
  recentTitle: { fontFamily: fonts.bold, fontSize: 14, color: INK, textAlign: 'center', marginTop: 4 },
  guess: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 2.5, backgroundColor: '#fff' },
  guessText: { flex: 1, fontFamily: fonts.bold, fontSize: 12, color: INK },
  outcome: { fontFamily: fonts.display, fontSize: 13 },
  ok: { color: '#2E8B57' },
  near: { color: '#C77700' },
  bad: { color: '#B3261E' },
  hint: { fontFamily: fonts.bold, fontSize: 11.5, color: INK, opacity: 0.6, textAlign: 'center' },
});
