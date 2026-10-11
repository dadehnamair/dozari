import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TournamentTurn } from '@dozari/shared';
import { Icon } from '../components/Icon';
import { formatCountdown } from '../daily/countdown';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';
import { checkInTournament, fetchTurn } from './api';
import { roundLabel, startsInText, turnPollMs, turnWhen } from './text';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/** Polls the caller's next tournament match; when the server has started the duel (`playing`) `onPlaying` takes the player to it. */
export function useTournamentTurn(enabled: boolean, onPlaying: (() => void) | undefined): { turn: TournamentTurn | null; now: number; enter: () => void; failed: boolean } {
  const [turn, setTurn] = useState<TournamentTurn | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);
  const sent = useRef<string | null>(null);
  const load = useCallback(() => {
    fetchTurn().then(setTurn, () => setTurn(null));
  }, []);
  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [enabled, load]);
  const every = turnPollMs(turn, now);
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = setInterval(load, every);
    return () => clearInterval(timer);
  }, [enabled, every, load]);
  // The duel starts on the server once both are in: take the player there, once per match.
  useEffect(() => {
    if (!turn || turn.state !== 'playing') return;
    const key = `${turn.tournamentId}:${turn.round}`;
    if (sent.current === key) return;
    sent.current = key;
    onPlaying?.();
  }, [turn, onPlaying]);
  const enter = useCallback(() => {
    if (!turn) return;
    setFailed(false);
    checkInTournament(turn.tournamentId).then(load, () => (setFailed(true), load()));
  }, [turn, load]);
  return { turn, now, enter, failed };
}

/** The strip pinned under Home's top row: counts down to the player's next tournament match, then asks them to come in. */
export function TurnBanner({ turn, now, enter, failed }: { turn: TournamentTurn; now: number; enter: () => void; failed: boolean }) {
  const t = fa.tournament.turn;
  const round = roundLabel(turn.round, turn.size);
  const open = turn.state === 'open';
  const waiting = turn.state === 'checked_in';
  const upcoming = turn.state === 'upcoming';
  return (
    <View style={[styles.root, open ? styles.rootOpen : null]} accessibilityRole="summary">
      <View style={styles.icon}><Icon name="trophy" size={22} color={colors.ink} strokeWidth={2.6} /></View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{open ? t.yourTurn : turn.titleFa}</Text>
        {upcoming && turn.opensAt !== null ? (
          <Text style={styles.sub} numberOfLines={2}>{t.upcoming(round, turnWhen(turn.opensAt))} · {t.left} <Text style={styles.mono}>{startsInText(turn.opensAt, now)}</Text></Text>
        ) : null}
        {open ? <Text style={styles.sub} numberOfLines={2}>{turn.titleFa} · {round}{turn.opponent ? ` · ${t.vs(turn.opponent)}` : ''} · {t.deadline} <Text style={styles.mono}>{turn.deadline !== null ? formatCountdown(turn.deadline, now) : ''}</Text></Text> : null}
        {waiting ? <Text style={styles.sub} numberOfLines={2}>{t.waitingRival} {t.waitingHint} <Text style={styles.mono}>{turn.deadline !== null ? formatCountdown(turn.deadline, now) : ''}</Text></Text> : null}
        {failed ? <Text style={styles.warn}>{t.error}</Text> : null}
      </View>
      {open ? (
        <Pressable onPress={enter} accessibilityRole="button" accessibilityLabel={t.enter} style={styles.cta}>
          <Text style={styles.ctaText}>{t.enter}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: ROW, alignItems: 'center', gap: 8, marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.cream },
  rootOpen: { backgroundColor: '#FFE48A' },
  icon: { width: 34, height: 34, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.orange, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, textAlign: TEXT_RIGHT },
  sub: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 18, color: colors.ink, textAlign: TEXT_RIGHT },
  mono: { fontFamily: fonts.bold, writingDirection: 'ltr' },
  warn: { fontFamily: fonts.bold, fontSize: 11, color: '#C0392B', textAlign: TEXT_RIGHT },
  cta: { paddingHorizontal: 14, height: 40, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.lime, justifyContent: 'center' },
  ctaText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
});
