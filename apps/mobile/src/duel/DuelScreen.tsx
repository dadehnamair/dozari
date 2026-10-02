import { useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TauntCategory } from '@dozari/shared';
import { fetchTaunts } from '../chat/api';
import { Board } from '../components/Board';
import { CandyButton } from '../components/CandyButton';
import { Confetti } from '../components/Confetti';
import { Rain } from '../components/Rain';
import { fa } from '../i18n/fa';
import { usePrefs } from '../prefs/store';
import { buzz, playSfx } from '../sound/engine';
import { canSubmit, pruneSelection, toggleSelection } from '../solo/selection';
import { colors } from '../theme/colors';
import { boardSolved, duelReducer, initialDuel, isMyTurn, myOutcome, turnSecondsLeft } from './model';
import { connectDuel } from './socket';
import type { DuelConnection } from './socket';

const FLASH_MS = 1500;

/** «دوئل زنده»: find an opponent in the queue (or pick up a match a private table started) and play it over the socket. */
export function DuelScreen({ onBack, resume = false }: { onBack: () => void; /** A table already started the match: do not queue, ask the server for the current snapshot. */ resume?: boolean }) {
  const prefs = usePrefs();
  const [state, dispatch] = useReducer(duelReducer, initialDuel);
  const [selected, setSelected] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [taunts, setTaunts] = useState<TauntCategory[]>([]);
  const [tauntOpen, setTauntOpen] = useState(false);
  const conn = useRef<DuelConnection | null>(null);

  useEffect(() => {
    let alive = true;
    void connectDuel((a) => alive && dispatch(a)).then(async (c) => {
      if (!alive) return c.close();
      conn.current = c;
      const ack = await (resume ? c.resume() : c.joinQueue());
      if (!ack.ok) dispatch({ t: 'error', error: ack.error });
      else if (!resume) dispatch({ t: 'queued' });
    }, () => dispatch({ t: 'error', error: 'NETWORK' }));
    return () => {
      alive = false;
      conn.current?.close();
    };
  }, [resume]);

  useEffect(() => {
    fetchTaunts().then(setTaunts, () => undefined);
  }, []);
  useEffect(() => {
    if (!state.taunt) return;
    const id = setTimeout(() => dispatch({ t: 'clearTaunt' }), 4000);
    return () => clearTimeout(id);
  }, [state.taunt]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!state.flash) return;
    if (state.flash === 'correct' || state.flash === 'one_away' || state.flash === 'wrong') playSfx(state.flash === 'one_away' ? 'oneAway' : state.flash);
    if (state.flash === 'wrong' || state.flash === 'timeout') buzz(60);
    const id = setTimeout(() => dispatch({ t: 'clearFlash' }), FLASH_MS);
    return () => clearTimeout(id);
  }, [state.flash]);
  useEffect(() => {
    if (state.view) setSelected((s) => pruneSelection(s, state.view!.cards));
  }, [state.view]);
  useEffect(() => {
    if (state.phase === 'ended' && state.ended && state.view) playSfx(myOutcome(state.ended, state.view.you) === 'won' ? 'win' : 'lose');
  }, [state.phase, state.ended, state.view]);

  const errorText = state.error ? fa.duel.errors[state.error] ?? fa.duel.errors.generic : null;
  const view = state.view;

  if (errorText && state.phase !== 'playing') {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>{errorText}</Text>
        <CandyButton label={fa.duel.back} color={colors.candy.sky} onPress={onBack} />
      </View>
    );
  }
  if (state.phase === 'idle' || state.phase === 'queued' || !view) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.candy.yellow} />
        <Text style={styles.msg}>{fa.duel.searching}</Text>
        {state.phase === 'queued' ? <Text style={styles.sub}>{fa.duel.waited(state.waitedSec)}</Text> : null}
        <CandyButton label={fa.duel.cancel} color={colors.candy.orange} onPress={() => (void conn.current?.leaveQueue(), onBack())} />
      </View>
    );
  }

  const me = view.you;
  const mine = isMyTurn(view);
  const playing = view.status === 'playing' && state.phase !== 'ended';
  const players = state.found?.players;
  const submit = () => {
    if (!canSubmit(selected) || !mine) return;
    void conn.current?.submit(selected).then((ack) => {
      if (ack.ok) setSelected([]);
      else dispatch({ t: 'error', error: ack.error });
    });
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.title}>{players ? fa.duel.vs(players[me].nickname, players[(1 - me) as 0 | 1].nickname) : fa.duel.title}</Text>
        <Text style={styles.score}>{fa.duel.score(view.scores[me], view.scores[(1 - me) as 0 | 1])}</Text>
        {playing ? (
          <Text style={[styles.turn, mine && styles.turnMine]}>
            {view.lockedOut[me] ? fa.duel.lockedOut : mine ? fa.duel.yourTurn : fa.duel.theirTurn} · {fa.duel.seconds(turnSecondsLeft(view, now))}
          </Text>
        ) : null}
        {state.taunt ? <Text style={styles.taunt}>{state.taunt.from}: {state.taunt.text}</Text> : null}
        <View style={styles.flashSlot}>{state.flash ? <Text style={styles.flash}>{fa.duel.feedback[state.flash]}</Text> : null}</View>
        <Board solved={boardSolved(view)} cards={view.cards} names={state.names} selected={selected} onToggle={(id) => (playSfx('tap'), setSelected((s) => toggleSelection(s, id)))} disabled={!playing || !mine} />
        {playing ? (
          <View style={styles.actions}>
            <CandyButton label={fa.duel.deselect} color={colors.candy.grape} onPress={() => setSelected([])} disabled={selected.length === 0} />
            <CandyButton label={fa.duel.submit} color={colors.candy.lime} onPress={submit} disabled={!canSubmit(selected) || !mine} />
            {taunts.length > 0 ? <CandyButton label={fa.duel.taunts} color={colors.candy.pink} onPress={() => setTauntOpen((v) => !v)} /> : null}
            <CandyButton label={fa.duel.leave} color={colors.candy.orange} onPress={() => (void conn.current?.leave(), undefined)} />
          </View>
        ) : state.ended ? (
          <View style={styles.actions}>
            <Text style={styles.msg}>{fa.duel[myOutcome(state.ended, me)]}</Text>
            <Text style={styles.sub}>{fa.duel.reasons[state.ended.result.reason] ?? ''}</Text>
            <CandyButton label={fa.duel.back} color={colors.candy.sky} onPress={onBack} />
          </View>
        ) : null}
        {tauntOpen && playing ? (
          <View style={styles.tauntBox}>
            {(taunts[0]?.taunts ?? []).map((t) => (
              <Pressable key={t.id} onPress={() => (void conn.current?.taunt(t.id), setTauntOpen(false))} style={styles.tauntChip} accessibilityRole="button"><Text style={styles.tauntText}>{t.text}</Text></Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
      {state.phase === 'ended' && state.ended && !prefs.reduceMotion ? (myOutcome(state.ended, me) === 'won' ? <Confetti distance={500} /> : <Rain distance={800} />) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  screen: { padding: 16, gap: 10, alignItems: 'center' },
  title: { fontFamily: 'Vazirmatn_700Bold', fontSize: 20, color: colors.cream, textAlign: 'center' },
  score: { fontFamily: 'Vazirmatn_700Bold', fontSize: 28, color: colors.candy.yellow },
  turn: { fontFamily: 'Vazirmatn_700Bold', fontSize: 14, color: colors.cream, opacity: 0.85 },
  turnMine: { color: colors.candy.lime, opacity: 1 },
  taunt: { fontFamily: 'Vazirmatn_700Bold', fontSize: 14, color: colors.candy.pink, textAlign: 'center' },
  tauntBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tauntChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 2, borderColor: '#3A2418', backgroundColor: '#E8D5FF' },
  tauntText: { fontFamily: 'Vazirmatn_700Bold', fontSize: 13, color: '#3A2418' },
  flashSlot: { height: 26, justifyContent: 'center' },
  flash: { fontFamily: 'Vazirmatn_700Bold', fontSize: 18, color: colors.candy.yellow },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 },
  msg: { fontFamily: 'Vazirmatn_700Bold', fontSize: 18, color: colors.cream, textAlign: 'center' },
  sub: { fontFamily: 'Vazirmatn_400Regular', fontSize: 13, color: colors.cream, opacity: 0.8, textAlign: 'center' },
});
