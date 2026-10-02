import { useEffect, useReducer, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { toPersianDigits } from '@dozari/shared';
import type { TauntCategory } from '@dozari/shared';
import { fetchTaunts } from '../chat/api';
import { Board } from '../components/Board';
import { CandyButton } from '../components/CandyButton';
import { Confetti } from '../components/Confetti';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { Rain } from '../components/Rain';
import { SlabButton } from '../components/SlabButton';
import { Lives } from '../game/Lives';
import { MatchBackground } from '../game/MatchBackground';
import { fa } from '../i18n/fa';
import { usePrefs } from '../prefs/store';
import { buzz, playSfx } from '../sound/engine';
import { canSubmit, pruneSelection, toggleSelection } from '../solo/selection';
import { TableSheet } from '../tables/TableSheet';
import { colors, fonts } from '../theme/colors';
import { arenaNumbers, arrange, characterFor, clockText, endReason, groupsBy, shuffled } from './arena';
import { DuelResult } from './DuelResult';
import { MatchHud } from './MatchHud';
import { ModeSelect } from './ModeSelect';
import { boardSolved, duelReducer, initialDuel, isMyTurn, myOutcome, turnSecondsLeft } from './model';
import { connectDuel } from './socket';
import type { DuelConnection } from './socket';
import { Versus } from './Versus';

const FLASH_MS = 1500;
/** The versus card stays up this long once a rival is found (the turn clock is 45s by default). */
const INTRO_MS = 3000;
const LEAVE_ARM_MS = 3000;
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const a = fa.duel.arena;

type Stage = 'pick' | 'queue' | 'resume';

/**
 * «دوئل زنده» as the `13 Match Screens` flow: pick a mode → versus (search, then the rival) → the board → results.
 * `resume` skips straight to the match a private table (or an earlier session) already started.
 */
export function DuelScreen({ onBack, resume = false, settings = {} }: { onBack: () => void; resume?: boolean; /** Public settings (`GET /config`) for the mode card numbers. */ settings?: Record<string, unknown> }) {
  const prefs = usePrefs();
  const [stage, setStage] = useState<Stage>(resume ? 'resume' : 'pick');
  const [round, setRound] = useState(0);
  const [state, dispatch] = useReducer(duelReducer, initialDuel);
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [introUntil, setIntroUntil] = useState(0);
  const [taunts, setTaunts] = useState<TauntCategory[]>([]);
  const [tauntOpen, setTauntOpen] = useState(false);
  const [leaveArmed, setLeaveArmed] = useState(false);
  const [friendOpen, setFriendOpen] = useState(false);
  const conn = useRef<DuelConnection | null>(null);
  const numbers = arenaNumbers(settings);

  useEffect(() => {
    if (stage === 'pick') return;
    let alive = true;
    void connectDuel((act) => alive && dispatch(act)).then(async (c) => {
      if (!alive) return c.close();
      conn.current = c;
      const ack = await (stage === 'resume' ? c.resume() : c.joinQueue());
      if (!ack.ok) dispatch({ t: 'error', error: ack.error });
      else if (stage === 'queue') dispatch({ t: 'queued' });
    }, () => dispatch({ t: 'error', error: 'NETWORK' }));
    return () => {
      alive = false;
      conn.current?.close();
      conn.current = null;
    };
  }, [stage, round]);

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
  const foundId = state.found?.matchId;
  useEffect(() => {
    if (foundId && stage === 'queue') setIntroUntil(Date.now() + INTRO_MS);
  }, [foundId, stage]);
  useEffect(() => {
    if (state.phase === 'ended' && state.ended && state.view) playSfx(myOutcome(state.ended, state.view.you) === 'won' ? 'win' : 'lose');
  }, [state.phase, state.ended, state.view]);
  useEffect(() => {
    if (!leaveArmed) return;
    const id = setTimeout(() => setLeaveArmed(false), LEAVE_ARM_MS);
    return () => clearTimeout(id);
  }, [leaveArmed]);

  const again = () => {
    dispatch({ t: 'reset' });
    setSelected([]);
    setOrder([]);
    setIntroUntil(0);
    setStage('queue');
    setRound((r) => r + 1);
  };

  if (stage === 'pick') {
    return (
      <>
        <ModeSelect entry={numbers.entry} prize={numbers.prize} onBack={onBack} onGo={() => setStage('queue')} onFriend={() => setFriendOpen(true)} />
        {friendOpen ? <TableSheet onClose={() => setFriendOpen(false)} onMatch={() => (setFriendOpen(false), setStage('resume'))} /> : null}
      </>
    );
  }

  const errorText = state.error ? fa.duel.errors[state.error] ?? fa.duel.errors.generic : null;
  const view = state.view;
  const players = state.found?.players;

  if (errorText && state.phase !== 'playing') {
    return (
      <MatchBackground>
        <View style={styles.center}>
          <Text style={styles.msg}>{errorText}</Text>
          <CandyButton label={fa.duel.back} color={colors.candy.sky} onPress={onBack} />
        </View>
      </MatchBackground>
    );
  }

  const countdown = Math.ceil((introUntil - now) / 1000);
  if (state.phase === 'idle' || state.phase === 'queued' || !view || countdown > 0) {
    const you = state.found?.you ?? 0;
    return (
      <Versus
        me={{ nickname: players?.[you].nickname ?? '', level: players?.[you].level }}
        rival={players ? players[(1 - you) as 0 | 1] : null}
        waitedSec={state.waitedSec}
        countdown={players ? Math.max(1, countdown) : null}
        onCancel={() => (void conn.current?.leaveQueue(), setStage('pick'), dispatch({ t: 'reset' }))}
      />
    );
  }

  const me = view.you;
  const them = (1 - me) as 0 | 1;
  const myName = players?.[me].nickname || a.you;
  const rivalName = players?.[them].nickname || a.rival;
  const rivalWho = characterFor(players?.[them].avatarKey || rivalName);
  const lines = [
    { name: myName, who: 'dozari' as const, groups: groupsBy(view, me), me: true },
    { name: rivalName, who: rivalWho, groups: groupsBy(view, them), me: false },
  ];

  if (state.phase === 'ended' && state.ended) {
    const outcome = myOutcome(state.ended, me);
    const scores = state.ended.scores;
    return (
      <View style={styles.fill}>
        <DuelResult
          outcome={outcome}
          reason={endReason(outcome, state.ended.result.reason)}
          lines={lines.map((l) => ({ ...l, points: scores[l.me ? me : them] }))}
          onHome={onBack}
          onAgain={stage === 'queue' ? again : undefined}
        />
        {!prefs.reduceMotion ? (outcome === 'won' ? <Confetti distance={500} /> : <Rain distance={800} />) : null}
      </View>
    );
  }

  const mine = isMyTurn(view);
  const playing = view.status === 'playing';
  const secs = turnSecondsLeft(view, now);
  const turnText = view.lockedOut[me] ? fa.duel.lockedOut : mine ? fa.duel.yourTurn : fa.duel.theirTurn;
  const toast = leaveArmed ? a.leaveSure : state.flash ? fa.duel.feedback[state.flash] : state.taunt ? `${state.taunt.from}: ${state.taunt.text}` : null;
  const submit = () => {
    if (!canSubmit(selected) || !mine) return;
    void conn.current?.submit(selected).then((ack) => {
      if (ack.ok) setSelected([]);
      else dispatch({ t: 'error', error: ack.error });
    });
  };
  const leave = () => {
    if (!leaveArmed) return setLeaveArmed(true);
    setLeaveArmed(false);
    void conn.current?.leave();
  };

  return (
    <MatchBackground>
      <ScrollView contentContainerStyle={styles.screen}>
        <View style={styles.column}>
          <View style={styles.bar}>
            <Pressable accessibilityRole="button" accessibilityLabel={a.leave} onPress={leave}>
              {({ pressed }) => (
                <View style={[styles.square, pressed ? styles.pressed : null]}>
                  <GradientFill from="#C9A3FF" to={colors.candy.grape} />
                  <Icon name="pause" size={20} color="#fff" strokeWidth={2.6} />
                </View>
              )}
            </Pressable>
            <View style={styles.clock} accessibilityLabel={`${turnText} ${fa.duel.seconds(secs)}`}>
              <GradientFill from={secs <= 10 ? '#FF8FB6' : '#FFE48A'} to={secs <= 10 ? colors.candy.pink : colors.candy.yellow} />
              <View style={styles.clockIcon}><Item icon="hourglass" /></View>
              <Text style={styles.clockText}>{toPersianDigits(clockText(secs))}</Text>
            </View>
            <View style={styles.mode}><Text style={styles.modeText}>{a.oneVsOne}</Text></View>
          </View>

          <MatchHud
            me={{ name: myName, who: 'dozari', score: view.scores[me], groups: lines[0]!.groups, active: playing && view.turn === me }}
            rival={{ name: rivalName, who: rivalWho, score: view.scores[them], groups: lines[1]!.groups, active: playing && view.turn === them }}
          />

          <View style={styles.turnRow}>
            <View style={[styles.turn, mine ? styles.turnMine : null]}><Text style={[styles.turnText, mine ? styles.turnTextMine : null]}>{turnText}</Text></View>
          </View>
          <View style={styles.toastSlot}>{toast ? <View style={styles.toast}><Text style={styles.toastText} numberOfLines={2}>{toast}</Text></View> : null}</View>

          <Board solved={boardSolved(view)} cards={arrange(view.cards, order)} names={state.names} selected={selected} onToggle={(id) => (playSfx('tap'), setSelected((s) => toggleSelection(s, id)))} disabled={!playing || !mine} />

          <View style={styles.tools}>
            {taunts.length > 0 ? (
              <Pressable accessibilityRole="button" accessibilityLabel={fa.duel.taunts} onPress={() => setTauntOpen((v) => !v)}>
                {({ pressed }) => <View style={[styles.round, pressed ? styles.pressed : null]}><Icon name="chat" size={24} color={colors.ink} strokeWidth={2.6} /></View>}
              </Pressable>
            ) : <View style={styles.roundGap} />}
            <Lives mistakes={view.mistakes[me]} max={numbers.maxMistakes} />
            <View style={styles.roundGap} />
          </View>
          {tauntOpen ? (
            <View style={styles.tauntBox}>
              {(taunts[0]?.taunts ?? []).map((t) => (
                <Pressable key={t.id} onPress={() => (void conn.current?.taunt(t.id), setTauntOpen(false))} style={styles.tauntChip} accessibilityRole="button"><Text style={styles.tauntText}>{t.text}</Text></Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.actions}>
            <SlabButton label={fa.solo.shuffle} color={colors.candy.sky} height={58} fontSize={20} onPress={() => setOrder(shuffled(view.cards.map((c) => c.id)))} />
            <SlabButton label={fa.solo.deselect} color={colors.candy.orange} height={58} fontSize={20} onPress={() => setSelected([])} disabled={selected.length === 0} />
            <SlabButton label={fa.solo.submit} color={colors.candy.lime} height={58} fontSize={24} grow={1.4} onPress={submit} disabled={!canSubmit(selected) || !mine} />
          </View>
        </View>
      </ScrollView>
    </MatchBackground>
  );
}

const lift = { shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 };

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  screen: { flexGrow: 1, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 24, alignItems: 'center' },
  column: { width: '100%', maxWidth: 520, gap: 10 },
  bar: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  square: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 4, ...lift },
  pressed: { transform: [{ translateY: 3 }] },
  clock: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4, ...lift },
  clockIcon: { width: 28, height: 28 },
  clockText: { fontFamily: fonts.display, fontSize: 26, lineHeight: 36, color: colors.ink },
  mode: { height: 42, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  modeText: { fontFamily: fonts.display, fontSize: 17, color: colors.candy.yellow },
  turnRow: { alignItems: 'center' },
  turn: { paddingHorizontal: 14, paddingVertical: 3, borderRadius: 99, backgroundColor: 'rgba(26,8,44,0.65)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  turnMine: { backgroundColor: colors.candy.lime, borderColor: colors.ink },
  turnText: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
  turnTextMine: { color: colors.ink },
  toastSlot: { minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.candy.yellow, maxWidth: '100%' },
  toastText: { fontFamily: fonts.display, fontSize: 16, color: colors.candy.yellow, textAlign: 'center' },
  tools: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  round: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', ...lift },
  roundGap: { width: 52 },
  tauntBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  tauntChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#E8D5FF' },
  tauntText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  actions: { flexDirection: ROW, gap: 9 },
  msg: { fontFamily: fonts.bold, fontSize: 18, color: colors.cream, textAlign: 'center' },
});
