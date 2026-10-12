import { useEffect, useReducer, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { isLastLife, toPersianDigits } from '@dozari/shared';
import type { TauntCategory } from '@dozari/shared';
import { fetchTaunts } from '../chat/api';
import { Board, WRONG_SHAKE_MS } from '../components/Board';
import { GemBurst } from '../components/GemBurst';
import { ErrorCard } from '../components/EmptyState';
import { Confetti } from '../components/Confetti';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { Rain } from '../components/Rain';
import { SlabButton } from '../components/SlabButton';
import { ComboRing } from '../game/ComboRing';
import { Lives } from '../game/Lives';
import { NearMissPill } from '../game/NearMissPill';
import { useCombo } from '../game/useCombo';
import { useHeartbeat } from '../game/useHeartbeat';
import { MatchBackground } from '../game/MatchBackground';
import { fa } from '../i18n/fa';
import { usePrefs } from '../prefs/store';
import { buzz, playSfx } from '../sound/engine';
import { canSubmit, pruneSelection, toggleSelection } from '../solo/selection';
import { leaveTable } from '../tables/api';
import { TableSheet } from '../tables/TableSheet';
import { nativeTopInset } from '../theme/safeArea';
import { colors, fonts } from '../theme/colors';
import { getLookGender } from '../theme/look';
import { arenaNumbers, arenaTiers, arrange, characterFor, clockText, endReason, groupsBy, myCharacter, shuffled } from './arena';
import type { TierId } from './arena';
import { DuelPriceRound } from './DuelPriceRound';
import { DuelResult } from './DuelResult';
import { EDGE_LEFT, EDGE_RIGHT } from '../theme/direction';
import { InviteSheet } from '../invite/InviteSheet';
import { PlayerSheet } from '../social/PlayerSheet';
import { ReportDialog } from '../feedback/ReportDialog';
import { MatchHud } from './MatchHud';
import { ChatDrawer } from './ChatDrawer';
import { SpeechBubble } from './SpeechBubble';
import { ArenaBackground } from './ArenaBackground';
import { ModeSelect } from './ModeSelect';
import { boardSolved, duelReducer, endedFromView, initialDuel, isCaptain, isMyTurn, myOutcome, sideName, sidePlayers, turnSecondsLeft } from './model';
import { connectDuel } from './socket';
import type { DuelConnection } from './socket';
import { SearchScreen } from '../search/SearchScreen';
import { Versus } from './Versus';
import { LeaveGuard } from './LeaveGuard';
import { fetchWheel } from '../wheel/api';
import { WheelPage } from '../wheel/WheelPage';

const FLASH_MS = 1500;
/** The versus card stays up this long once a rival is found (the turn clock is 45s by default). */
const INTRO_MS = 3000;
const LEAVE_ARM_MS = 3000;
/** How long a taunt floats under its sender's card, and the pause before the next one. */
const BUBBLE_MS = 3200;
const TAUNT_COOLDOWN_S = 3;
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
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [state, dispatch] = useReducer(duelReducer, initialDuel);
  const [selected, setSelected] = useState<string[]>([]);
  const [order, setOrder] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [introUntil, setIntroUntil] = useState(0);
  const [taunts, setTaunts] = useState<TauntCategory[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatTab, setChatTab] = useState(0);
  /** Seconds before another taunt may be sent (the badge dims meanwhile). */
  const [cool, setCool] = useState(0);
  /** The taunt the player just sent, floating under their card for a few seconds. */
  const [myBubble, setMyBubble] = useState<string | null>(null);
  const [leaveArmed, setLeaveArmed] = useState(false);
  const [friendOpen, setFriendOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [mode, setMode] = useState<'duel' | 'team'>('duel');
  const [tier, setTier] = useState<TierId>('bronze');
  const conn = useRef<DuelConnection | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [spinsWaiting, setSpinsWaiting] = useState(0);
  const numbers = arenaNumbers(settings);
  const combo = useCombo();
  /** A submit is on its way to the server: no second tap until the answer is back (a double tap used to answer «already tried»). */
  const [sending, setSending] = useState(false);
  /** The last row playing itself out (see `state.finale`): which of its four cards are lit, and whether its row is open. */
  const [finaleSel, setFinaleSel] = useState<string[]>([]);
  const [finaleLast, setFinaleLast] = useState(false);
  const foundAt = useRef(0);
  const lastResync = useRef(0);
  const finishedAt = useRef(0);

  useEffect(() => {
    if (stage === 'pick') return;
    let alive = true;
    void connectDuel((act) => alive && dispatch(act)).then(async (c) => {
      if (!alive) return c.close();
      conn.current = c;
      const ack = await (stage === 'resume' ? c.resume() : c.joinQueue(mode, tier));
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
    if (!state.powerNote) return;
    const id = setTimeout(() => dispatch({ t: 'clearPowerNote' }), 2400);
    return () => clearTimeout(id);
  }, [state.powerNote]);
  // The magnifier shows two cards: they are picked for the player, who adds the other two.
  useEffect(() => {
    if (state.peek) setSelected(state.peek.ids);
  }, [state.peek?.n]);
  useEffect(() => {
    if (cool <= 0) return;
    const id = setTimeout(() => setCool((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cool]);
  useEffect(() => {
    if (!myBubble) return;
    const id = setTimeout(() => setMyBubble(null), BUBBLE_MS);
    return () => clearTimeout(id);
  }, [myBubble]);
  useEffect(() => {
    if (!state.boardNote) return;
    const id = setTimeout(() => dispatch({ t: 'clearBoard' }), 3500);
    return () => clearTimeout(id);
  }, [state.boardNote]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!state.flash) return;
    if (state.flash === 'correct' || state.flash === 'one_away' || state.flash === 'wrong') playSfx(state.flash === 'one_away' ? 'oneAway' : state.flash);
    if (state.flash === 'wrong' || state.flash === 'timeout') buzz(60);
    if (state.flash === 'one_away') buzz(40);
    if (state.flash === 'correct') buzz(25);
    // The combo of solo play: groups found back to back; any slip or a timeout breaks it.
    if (state.flash === 'correct' && combo.record('correct') >= 2) playSfx('combo');
    else if (state.flash !== 'correct') combo.record(state.flash === 'one_away' ? 'one_away' : 'wrong');
    const id = setTimeout(() => dispatch({ t: 'clearFlash' }), FLASH_MS);
    // A miss shakes the four cards red (the board does that), then they are put back.
    // (not cancelled with the flash: it must outlive FLASH_MS if the shake is longer)
    if (state.flash === 'wrong' || state.flash === 'one_away') setTimeout(() => setSelected([]), prefs.reduceMotion ? 0 : WRONG_SHAKE_MS);
    return () => clearTimeout(id);
  }, [state.flash]);
  useEffect(() => {
    if (state.gem) playSfx('gem');
  }, [state.gem]);
  useEffect(() => {
    if (state.view) setSelected((s) => pruneSelection(s, state.view!.cards));
  }, [state.view]);
  // 2v2: the captain sees the teammate's proposal as the current selection; a non-captain teammate's picks go to the captain.
  const proposalKey = state.view?.proposal ? state.view.proposal.itemIds.join(',') : '';
  useEffect(() => {
    const v = state.view;
    if (!v || !isCaptain(v) || !v.proposal) return;
    setSelected(pruneSelection(v.proposal.itemIds, v.cards));
  }, [proposalKey]);
  const proposing = !!state.view && isMyTurn(state.view) && !isCaptain(state.view);
  const selectedKey = selected.join(',');
  useEffect(() => {
    if (proposing) void conn.current?.propose(selected);
  }, [proposing, selectedKey]);
  const foundId = state.found?.matchId;
  useEffect(() => {
    if (foundId && stage === 'queue') setIntroUntil(Date.now() + INTRO_MS);
  }, [foundId, stage]);
  // A win earns a wheel spin; the server records it just after the result, so ask once shortly after and once more later.
  const wonMatch = state.phase === 'ended' && state.ended && state.view ? myOutcome(state.ended, state.view.you) === 'won' : false;
  useEffect(() => {
    if (!wonMatch) return;
    let alive = true;
    const ask = () => void fetchWheel().then((w) => alive && w.enabled && setSpinsWaiting(w.pending), () => undefined);
    const ids = [setTimeout(ask, 1200), setTimeout(ask, 4000)];
    return () => {
      alive = false;
      ids.forEach(clearTimeout);
    };
  }, [wonMatch]);
  useEffect(() => {
    if (!leaveArmed) return;
    const id = setTimeout(() => setLeaveArmed(false), LEAVE_ARM_MS);
    return () => clearTimeout(id);
  }, [leaveArmed]);

  // The last row plays itself out before the board moves on or the result shows: the last four cards light up one by one, then their row opens.
  const finale = state.finale;
  useEffect(() => {
    if (!finale) return undefined;
    setFinaleSel([]);
    setFinaleLast(false);
    if (prefs.reduceMotion) {
      dispatch({ t: 'clearFinale' });
      return undefined;
    }
    let alive = true;
    const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const run = async () => {
      await pause(450);
      for (const c of finale.cards) {
        if (!alive) return;
        setFinaleSel((cur) => [...cur, c.id]);
        playSfx('select');
        buzz(15);
        await pause(280);
      }
      await pause(420);
      if (!alive) return;
      playSfx('correct');
      buzz(40);
      setFinaleLast(true);
      await pause(1400);
      if (alive) dispatch({ t: 'clearFinale' });
    };
    void run();
    // Whatever happens, the script lets go of the screen after a few seconds.
    const guard = setTimeout(() => dispatch({ t: 'clearFinale' }), 8000);
    return () => {
      alive = false;
      clearTimeout(guard);
    };
  }, [finale?.key, prefs.reduceMotion]);

  // A refused submit or a late answer is a toast for a moment, never a dead end.
  useEffect(() => {
    if (!state.notice) return undefined;
    const id = setTimeout(() => dispatch({ t: 'clearNotice' }), 3500);
    return () => clearTimeout(id);
  }, [state.notice]);
  // The last chance: the heartbeat of solo play (sound, a double buzz, the beating dot).
  const lv = state.view;
  const lastLife = !!lv && lv.status === 'playing' && !state.finale && !lv.priceRound && !lv.lockedOut[lv.you] && isLastLife(lv.mistakes[lv.you], numbers.maxMistakes, true);
  useHeartbeat(lastLife);
  useEffect(() => setSending(false), [state.view?.turnId, state.view?.round]);

  // Nobody gets stuck: every wait below has a way out. A snapshot that never came, a turn that ran out without the server moving
  // on, a finished board whose «ended» was lost: ask the server again, and when it no longer has the match, close it from what we know.
  const stateRef = useRef(state);
  stateRef.current = state;
  const resync = () => {
    lastResync.current = Date.now();
    void conn.current?.resume().then((ack) => {
      if (ack.ok || ack.error !== 'NOT_IN_MATCH') return;
      const cur = stateRef.current;
      if (cur.phase === 'ended') return;
      const ended = cur.view ? endedFromView(cur.view) : null;
      dispatch(ended ? { t: 'ended', ended } : { t: 'error', error: 'NOT_IN_MATCH' });
    });
  };
  useEffect(() => {
    if (foundId || stage === 'resume') foundAt.current = Date.now();
  }, [foundId, stage, round]);
  useEffect(() => {
    if (stage === 'pick' || !conn.current || state.phase === 'ended') return;
    const t = Date.now();
    const v = state.view;
    const quiet = t - lastResync.current > 6000;
    if (!v) {
      // The match is on but its first snapshot has not shown up.
      if (!(state.found || stage === 'resume') || !foundAt.current) return;
      if (t - foundAt.current > 20000) dispatch({ t: 'error', error: 'NETWORK' });
      else if (t - foundAt.current > 6000 && quiet) resync();
      return;
    }
    if (v.status === 'finished') {
      if (!finishedAt.current) finishedAt.current = t;
      else if (t - finishedAt.current > 5000) {
        const e = endedFromView(v);
        if (e) dispatch({ t: 'ended', ended: e });
      }
      return;
    }
    finishedAt.current = 0;
    const deadline = v.priceRound ? v.priceRound.endsAt : v.turnEndsAt;
    if (deadline > 0 && t > deadline + 6000 && quiet) resync();
  }, [now]);

  useEffect(() => {
    if (state.phase === 'ended' && state.ended && state.view && !state.finale) playSfx(myOutcome(state.ended, state.view.you) === 'won' ? 'win' : 'lose');
  }, [state.phase, state.ended, state.view, state.finale]);

  const again = () => {
    dispatch({ t: 'reset' });
    setSelected([]);
    setOrder([]);
    setIntroUntil(0);
    setStage('queue');
    setRound((r) => r + 1);
  };

  /** The private table started its next match: clear the old board and resume into the new one. */
  const rematch = () => {
    setTableOpen(false);
    dispatch({ t: 'reset' });
    setSelected([]);
    setOrder([]);
    setIntroUntil(0);
    setRound((r) => r + 1);
  };

  if (stage === 'pick') {
    return (
      <>
        <ModeSelect entry={numbers.entry} prize={numbers.prize} mode={mode} onMode={setMode} tiers={arenaTiers(settings)} tier={tier} onTier={setTier} onBack={onBack} onGo={() => setStage('queue')} onFriend={() => setFriendOpen(true)} />
        {friendOpen ? <TableSheet onClose={() => setFriendOpen(false)} onMatch={() => (setFriendOpen(false), setStage('resume'))} /> : null}
      </>
    );
  }

  const offline = state.error === 'NETWORK' || state.error === 'INTERNAL';
  const noPuzzles = state.problem === 'no_puzzles';
  const errorText = state.error ? fa.duel.errors[state.error] ?? fa.duel.errors.generic : null;
  const view = state.view;
  const players = state.found?.players;
  const team = (players?.length ?? 0) > 2 || view?.team === true;
  /** Try the same thing again: a fresh socket and queue join. */
  const retry = () => (dispatch({ t: 'reset' }), setRound((r) => r + 1));

  if ((errorText || (noPuzzles && !state.found)) && (state.phase !== 'playing' || !state.view)) {
    return (
      <MatchBackground>
        <View style={styles.center}>
          {offline ? (
            <ErrorCard kind="noInternet" sub={fa.duel.errors.NETWORK} onRetry={retry} onBack={onBack} />
          ) : noPuzzles ? (
            <ErrorCard kind="noPuzzles" sub={fa.duel.problems.no_puzzles} onBack={() => (void conn.current?.leaveQueue(), onBack())} />
          ) : (
            <ErrorCard kind="error" sub={errorText ?? undefined} onBack={onBack} />
          )}
        </View>
      </MatchBackground>
    );
  }

  const countdown = Math.ceil((introUntil - now) / 1000);
  // Searching: the diamond search screen; once a rival is found: the versus screen counting down (D104).
  if (!state.found && stage !== 'resume') return <SearchScreen team={mode === 'team'} waitedSec={state.waitedSec} note={state.problem ? fa.duel.problems[state.problem] : undefined} onCancel={() => (void conn.current?.leaveQueue(), setStage('pick'), dispatch({ t: 'reset' }))} />;
  if (state.phase === 'idle' || state.phase === 'queued' || !view || countdown > 0) {
    const you = state.found?.you ?? 0;
    const mineSide = sidePlayers(state.found, you);
    const myProfile = mineSide.find((p) => p.userId !== undefined && p.userId === state.found?.youId) ?? mineSide[0];
    return (
      <Versus
        me={{ nickname: myProfile?.nickname ?? '', level: myProfile?.level, who: myCharacter(myProfile?.avatarKey, getLookGender()) }}
        rival={players ? sidePlayers(state.found, (1 - you) as 0 | 1)[0] ?? null : null}
        mate={team ? sidePlayers(state.found, you).find((p) => p !== myProfile) ?? null : undefined}
        rivals={team ? sidePlayers(state.found, (1 - you) as 0 | 1) : undefined}
        waitedSec={state.waitedSec}
        countdown={players ? Math.max(1, countdown) : null}
        onCancel={() => (void conn.current?.leaveQueue(), setStage('pick'), dispatch({ t: 'reset' }))}
      />
    );
  }

  const me = view.you;
  const them = (1 - me) as 0 | 1;
  const myName = sideName(state.found, me, a.teamOf) || a.you;
  const rivalName = sideName(state.found, them, a.teamOf) || a.rival;
  const rivalWho = characterFor(sidePlayers(state.found, them)[0]?.avatarKey || rivalName);
  const mineProfiles = sidePlayers(state.found, me);
  const myWho = myCharacter((mineProfiles.find((p) => p.userId !== undefined && p.userId === state.found?.youId) ?? mineProfiles[0])?.avatarKey, getLookGender());
  const lines = [
    { name: myName, who: myWho, groups: groupsBy(view, me), me: true },
    { name: rivalName, who: rivalWho, groups: groupsBy(view, them), me: false, playerId: sidePlayers(state.found, them).length === 1 ? sidePlayers(state.found, them)[0]?.userId : undefined,
      reportable: sidePlayers(state.found, them).flatMap((p) => (p.userId ? [{ id: p.userId, name: p.nickname }] : [])) },
  ];

  if (state.phase === 'ended' && state.ended && !state.finale) {
    const outcome = myOutcome(state.ended, me);
    const scores = state.ended.scores;
    return (
      <View style={styles.fill}>
        <DuelResult
          outcome={outcome}
          reason={endReason(outcome, state.ended.result.reason)}
          lines={lines.map((l) => ({ ...l, points: scores[l.me ? me : them] }))}
          priceRound={state.ended.priceRound}
          onHome={stage === 'resume' ? () => (void leaveTable().then(() => undefined, () => undefined), onBack()) : onBack}
          onAgain={stage === 'queue' ? again : () => setTableOpen(true)}
          againLabel={stage === 'resume' ? fa.tables.rematch : undefined}
          onInvite={() => setInviteOpen(true)}
          onPlayer={(id) => setProfileId(id)}
          onReport={(id) => setReportId(id)}
        />
        {!prefs.reduceMotion ? (outcome === 'won' ? <Confetti distance={500} /> : <Rain distance={800} />) : null}
        {state.gem ? <GemBurst key={state.gem.n} amount={state.gem.amount} onDone={() => dispatch({ t: 'clearGem' })} /> : null}
        {outcome === 'won' && spinsWaiting > 0 ? (
          <View style={styles.wheelCta}><SlabButton label={fa.wheel.open} color={colors.candy.yellow} badge={toPersianDigits(String(spinsWaiting))} onPress={() => setWheelOpen(true)} /></View>
        ) : null}
        <View style={styles.sheets} pointerEvents="box-none">
          {inviteOpen ? <InviteSheet onClose={() => setInviteOpen(false)} /> : null}
          {tableOpen ? <TableSheet onClose={() => setTableOpen(false)} onMatch={rematch} /> : null}
          {profileId ? <PlayerSheet playerId={profileId} onClose={() => setProfileId(null)} /> : null}
          {reportId ? <ReportDialog target={{ kind: 'user', userId: reportId }} onClose={() => setReportId(null)} /> : null}
          {wheelOpen ? <WheelPage onClose={() => (setWheelOpen(false), void fetchWheel().then((w) => setSpinsWaiting(w.pending), () => undefined))} /> : null}
        </View>
      </View>
    );
  }

  // The board is over but the match is not: the price-guess round replaces the board until the server ends the match.
  if (view.priceRound && !state.finale) {
    return (
      <MatchBackground>
        <ScrollView contentContainerStyle={styles.screen}>
          <DuelPriceRound
            round={view.priceRound}
            now={now}
            onGuess={async (rials) => {
              const ack = await conn.current?.priceGuess(rials);
              return !ack || ack.ok ? null : (fa.duel.errors[ack.error] ?? fa.duel.errors.generic ?? '');
            }}
          />
        </ScrollView>
      </MatchBackground>
    );
  }

  const mineSide = sidePlayers(state.found, me);
  const rivalSide = sidePlayers(state.found, them);
  const myProfile = mineSide.find((p) => p.userId !== undefined && p.userId === state.found?.youId) ?? mineSide[0];
  const myLevel = myProfile?.level;
  const rivalLevel = rivalSide[0]?.level;
  const mateProfile = mineSide.find((p) => p !== myProfile);
  const mateWho = mateProfile ? characterFor(mateProfile.avatarKey || mateProfile.nickname) : undefined;
  const rivalMateWho = rivalSide[1] ? characterFor(rivalSide[1].avatarKey || rivalSide[1].nickname) : undefined;
  const mine = isMyTurn(view);
  const captain = isCaptain(view);
  const playing = view.status === 'playing';
  const secs = turnSecondsLeft(view, now);
  const nameOf = (id: string | undefined) => state.found?.players.find((p) => p.userId === id)?.nickname ?? '';
  const captainName = nameOf(view.captain?.[me]);
  /** 2v2: the teammate's four picks are waiting for the captain's «ثبت». */
  const proposalReady = team && mine && captain && (view.proposal?.itemIds.length ?? 0) === 4;
  const mateWaiting = team && mine && !captain && selected.length === 4;
  const turnText = view.lockedOut[me] ? fa.duel.lockedOut : mine ? (!captain ? (mateWaiting ? a.waitCaptain(captainName) : a.mateCaptain) : proposalReady ? a.mateReady(nameOf(view.proposal?.by)) : team ? a.captain : fa.duel.yourTurn) : fa.duel.theirTurn;
  const boards = view.rounds ?? 1;
  const noticeText = state.notice ? fa.duel.errors[state.notice] ?? fa.duel.errors.generic ?? null : null;
  const frozenMs = (view.frozenUntil?.[me] ?? 0) - now;
  const frozenMe = frozenMs > 0 && playing;
  const frozenRival = (view.frozenUntil?.[them] ?? 0) > now;
  const powerText = frozenMe ? fa.duel.power.frozenLeft(Math.ceil(frozenMs / 1000)) : state.powerNote ? fa.duel.power.notes[state.powerNote] ?? null : null;
  const toast = leaveArmed ? a.leaveSure : noticeText ? noticeText : powerText ? powerText : state.boardNote ? a.nextBoard(state.boardNote.board, state.boardNote.of) : state.flash && state.flash !== 'one_away' ? fa.duel.feedback[state.flash] : null;
  /** The submit button lights up only when this player can really submit now: their side's turn, they are the captain, four cards are picked, no answer pending. */
  const canSend = playing && mine && captain && canSubmit(selected) && !sending && !state.finale && !frozenMe;
  /** The power-ups work on the player's own turn, for the captain, while no answer is pending. */
  const canPower = playing && mine && captain && !sending && !state.finale && !frozenMe && !view.powerUsed;
  const canFreeze = playing && !mine && !state.finale && !frozenRival && !view.lockedOut[them] && !view.powerUsed;
  const submit = () => {
    if (!canSend) return;
    // No live connection object at all: never a silent tap. Say so and ask the server where things stand once the line is back.
    if (!conn.current) return dispatch({ t: 'notice', error: 'NETWORK' });
    setSending(true);
    void conn.current.submit(selected).then((ack) => {
      setSending(false);
      if (ack.ok) return setSelected([]);
      // A refused submit never ends the game for the player: it is a toast, and a lost answer asks the server where things stand.
      dispatch({ t: 'notice', error: ack.error });
      if (ack.error === 'INTERNAL' || ack.error === 'NOT_IN_MATCH') resync();
    });
  };
  const power = (kind: 'magnifier' | 'freeze') => {
    // The magnifier works on the player's own turn, the freeze on the rival's: each button has its own condition.
    if (!(kind === 'magnifier' ? canPower : canFreeze) || !conn.current) return;
    void conn.current.power(kind).then((ack) => {
      if (!ack.ok) dispatch({ t: 'notice', error: ack.error });
    });
  };
  const sendTaunt = (tauntId: string, text: string) => {
    if (cool > 0 || !conn.current) return;
    setChatOpen(false);
    setCool(TAUNT_COOLDOWN_S);
    setMyBubble(text);
    void conn.current.taunt(tauntId).then((ack) => {
      if (ack.ok) return;
      setMyBubble(null);
      dispatch({ t: 'notice', error: ack.error });
    });
  };
  const leave = () => {
    if (!leaveArmed) return setLeaveArmed(true);
    setLeaveArmed(false);
    void conn.current?.leave();
  };

  return (
    <ArenaBackground>
      {playing ? <LeaveGuard onLeave={leave} /> : null}
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
            <View style={styles.clockWrap}>
              <Pulse on={secs <= 10 && playing && !prefs.reduceMotion}><View style={styles.clock} accessibilityLabel={`${turnText} ${fa.duel.seconds(secs)}`}>
                <GradientFill from={secs <= 10 ? '#FF8FB6' : '#FFE48A'} to={secs <= 10 ? colors.candy.pink : colors.candy.yellow} />
                <View style={styles.clockIcon}><Item icon="hourglass" /></View>
                <Text style={styles.clockText}>{toPersianDigits(clockText(secs))}</Text>
              </View></Pulse>
            </View>
            <ComboRing streak={combo.streak} left={combo.left} showLabel={false} />
            <View style={styles.mode}><Text style={styles.modeText}>{team ? (boards > 1 ? `${a.twoVsTwo} · ${a.boardOf((view.round ?? 0) + 1, boards)}` : a.twoVsTwo) : a.oneVsOne}</Text></View>
          </View>

          <View style={styles.hudWrap}>
            <MatchHud
              me={{ name: myName, who: myWho, score: view.scores[me], groups: lines[0]!.groups, active: playing && view.turn === me, frozen: frozenMe, level: myLevel, mate: team ? mateWho : undefined }}
              rival={{ name: rivalName, who: rivalWho, score: view.scores[them], groups: lines[1]!.groups, active: playing && view.turn === them, frozen: frozenRival, level: rivalLevel, mate: team ? rivalMateWho : undefined }}
              onChat={taunts.length > 0 ? () => setChatOpen((v) => !v) : undefined}
              chatOpen={chatOpen}
              chatCooling={cool > 0}
              ofLabel={view.found ? a.boardsWon : undefined}
            />
            {myBubble ? <View style={[styles.bubble, { [EDGE_RIGHT]: 4 }]}><SpeechBubble text={myBubble} mine /></View> : null}
            {state.taunt ? <View style={[styles.bubble, { [EDGE_LEFT]: 4 }]}><SpeechBubble text={state.taunt.text} mine={false} /></View> : null}
          </View>

          {view.found && playing ? <Text style={[styles.rivalFound, view.found[them] >= 3 ? styles.rivalFoundHot : null]}>{view.found[them] > 0 ? a.rivalFound(view.found[them]) : a.rivalFoundNone}</Text> : null}
          <View style={styles.turnRow}>
            <View style={[styles.turn, mine ? styles.turnMine : null]}><Text style={[styles.turnText, mine ? styles.turnTextMine : null]}>{turnText}</Text></View>
            {/* Toasts cover the turn pill for a moment instead of reserving a row of their own (no empty gap above the board). */}
            {toast ? <View style={styles.toastOver} pointerEvents="none"><View style={styles.toast}><Text style={styles.toastText} numberOfLines={2}>{toast}</Text></View></View> : null}
          </View>

          <View style={styles.boardPanel}>
            <Board solved={state.finale ? (finaleLast ? [...state.finale.solved, state.finale.last] : state.finale.solved) : boardSolved(view)} cards={state.finale ? (finaleLast ? [] : state.finale.cards) : arrange(view.cards, order)} names={state.names} selected={state.finale ? finaleSel : selected} onToggle={(id) => setSelected((s) => toggleSelection(s, id))} disabled={!playing || !mine || !!state.finale || frozenMe} muted={playing && !mine && !state.finale && !view.found} faceDown={!!view.found && playing && !mine && !state.finale} hinted={state.peek?.ids ?? []} verdict={state.verdict} />
            {state.flash === 'one_away' ? <View style={styles.nearMiss} pointerEvents="none"><NearMissPill /></View> : null}
          </View>

          <View style={styles.tools}>
            <PowerButton kind="magnifier" count={view.powers?.magnifier ?? 0} enabled={canPower} onPress={() => power('magnifier')} />
            <Lives mistakes={view.mistakes[me]} max={numbers.maxMistakes} last={lastLife} />
            <PowerButton kind="freeze" count={view.powers?.freeze ?? 0} enabled={canFreeze} onPress={() => power('freeze')} />
          </View>

          {/* The same notice again right above the buttons: the one at the top of the board is out of sight when the player is down here. */}
          {noticeText ? <View style={styles.toastSlot}><View style={styles.toast}><Text style={styles.toastText} numberOfLines={2}>{noticeText}</Text></View></View> : null}
          <View style={styles.actions}>
            <SlabButton label={fa.solo.shuffle} color={colors.candy.sky} height={58} fontSize={20} onPress={() => setOrder(shuffled(view.cards.map((c) => c.id)))} disabled={!playing || !!state.finale} />
            <SlabButton label={fa.solo.deselect} color={colors.candy.orange} height={58} fontSize={20} onPress={() => setSelected([])} disabled={selected.length === 0 || !!state.finale} />
            <SlabButton label={sending ? fa.duel.submitting : fa.solo.submit} sfx="confirm" color={colors.candy.lime} height={58} fontSize={24} grow={1.4} onPress={submit} disabled={!canSend} />
          </View>
        </View>
      </ScrollView>
      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} categories={taunts} tab={chatTab} onTab={setChatTab} onSend={sendTaunt} />
      {state.gem ? <GemBurst key={state.gem.n} amount={state.gem.amount} onDone={() => dispatch({ t: 'clearGem' })} /> : null}
    </ArenaBackground>
  );
}

/** A round power-up button of screen-match (`13 Match Screens v2`): the magnifier on the left, the freeze on the right, a pink count badge on each. */
function PowerButton({ kind, count, enabled, onPress }: { kind: 'magnifier' | 'freeze'; count: number; enabled: boolean; onPress: () => void }) {
  const on = enabled && count > 0;
  const label = fa.duel.power[kind];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} · ${fa.duel.power[kind === 'magnifier' ? 'hintMagnifier' : 'hintFreeze']}`} accessibilityState={{ disabled: !on }} onPress={on ? () => (playSfx('press'), onPress()) : undefined} style={({ pressed }) => [styles.power, kind === 'freeze' ? styles.powerIce : null, on ? null : styles.powerOff, pressed && on ? styles.pressed : null]}>
      <View style={styles.powerIcon}><Item icon={kind} /></View>
      <View style={[styles.powerBadge, kind === 'freeze' ? { [EDGE_RIGHT]: -6 } : { [EDGE_LEFT]: -6 }]}><Text style={styles.powerBadgeText}>{toPersianDigits(String(count))}</Text></View>
    </Pressable>
  );
}

/** Beats gently (1 → 1.1 → 1) while `on`: the turn clock in its last seconds. */
function Pulse({ on, children }: { on: boolean; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!on) return v.setValue(1);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1.1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [on, v]);
  return <Animated.View style={{ transform: [{ scale: v }] }}>{children}</Animated.View>;
}

const lift = { shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 };

const styles = StyleSheet.create({
  fill: { flex: 1 },
  wheelCta: { position: 'absolute', top: 54 + nativeTopInset(), right: 16, width: 150 },
  /** Sheets over the result page. Android draws a view with elevation above later siblings, so the result's banner and buttons (elevation) showed over the sheet and its confirm dialog; one elevated layer keeps every sheet on top. */
  sheets: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40, elevation: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  screen: { flexGrow: 1, paddingHorizontal: 10, paddingTop: 14 + nativeTopInset(), paddingBottom: 24, alignItems: 'center' },
  column: { width: '100%', maxWidth: 520, gap: 10 },
  bar: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  square: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 4, ...lift },
  pressed: { transform: [{ translateY: 3 }] },
  power: { width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#F6E2C2', alignItems: 'center', justifyContent: 'center', ...lift },
  powerIce: { backgroundColor: '#BFEFFF' },
  powerOff: { opacity: 0.45 },
  powerIcon: { width: 32, height: 32 },
  powerBadge: { position: 'absolute', top: -6, minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.pink, alignItems: 'center', justifyContent: 'center' },
  powerBadgeText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 19, color: '#fff' },
  clockWrap: { flex: 1, alignItems: 'center' },
  hudWrap: { zIndex: 8 },
  bubble: { position: 'absolute', top: '100%', marginTop: 20, zIndex: 8 },
  boardPanel: { padding: 8, borderRadius: 22, borderWidth: 3, borderColor: colors.ink, backgroundColor: 'rgba(26,8,44,0.88)', shadowColor: '#140822', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.8, shadowRadius: 0, elevation: 6 },
  clock: { minWidth: 120, paddingRight: 14, height: 40, borderRadius: 99, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4, ...lift },
  clockIcon: { width: 28, height: 28 },
  clockText: { fontFamily: fonts.display, fontSize: 26, lineHeight: 36, color: colors.ink },
  mode: { height: 40, paddingHorizontal: 12, borderRadius: 13, backgroundColor: 'rgba(26,8,44,0.8)', borderWidth: 2, borderColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  modeText: { fontFamily: fonts.display, fontSize: 17, color: colors.candy.yellow },
  rivalFound: { textAlign: 'center', fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: 'rgba(255,246,232,0.85)', marginBottom: 4 },
  rivalFoundHot: { color: colors.candy.yellow, fontFamily: fonts.display },
  turnRow: { alignItems: 'center', justifyContent: 'center' },
  toastOver: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 5 },
  turn: { paddingHorizontal: 18, paddingVertical: 4, borderRadius: 99, backgroundColor: colors.candy.pink, borderWidth: 3, borderColor: colors.ink },
  turnMine: { backgroundColor: colors.candy.lime, borderColor: colors.ink },
  turnText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 26, color: '#fff' },
  turnTextMine: { color: colors.ink },
  toastSlot: { minHeight: 34, alignItems: 'center', justifyContent: 'center' },
  toast: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 99, backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.candy.yellow, maxWidth: '100%' },
  toastText: { fontFamily: fonts.display, fontSize: 16, color: colors.candy.yellow, textAlign: 'center' },
  tools: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  actions: { flexDirection: ROW, gap: 9 },
  nearMiss: { position: 'absolute', top: '38%', left: 0, right: 0, alignItems: 'center' },
  msg: { fontFamily: fonts.bold, fontSize: 18, color: colors.cream, textAlign: 'center' },
});
