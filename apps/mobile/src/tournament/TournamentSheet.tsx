import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TournamentDetail, TournamentListItem } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { avatarOf } from '../social/avatarOf';
import { colors, fonts } from '../theme/colors';
import { fetchTournament, fetchTournaments, joinTournament, leaveTournament } from './api';
import { blockedText, placeLabel, roundLabel } from './text';

const INK = '#3A2418';
const n = (v: number) => toPersianDigits(String(v));
const when = (ms: number) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

/** «تورنومنت‌ها»: the list, and a tournament's own page (story, rules, prizes, players, bracket, results). */
export function TournamentSheet({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<TournamentListItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (openId === null) fetchTournaments().then(setList, () => setList([]));
  }, [openId]);
  if (openId) return <TournamentPage id={openId} onBack={() => setOpenId(null)} />;
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.tournament.close}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        <Text style={styles.title}>{fa.tournament.title}</Text>
        <ScrollView style={styles.list} contentContainerStyle={styles.content}>
          {list && list.length === 0 ? <Text style={styles.hint}>{fa.tournament.empty}</Text> : null}
          {list?.map((t) => (
            <Pressable key={t.id} onPress={() => setOpenId(t.id)} style={styles.card} accessibilityRole="button">
              {t.iconKey ? <View style={styles.icon}><Item icon={t.iconKey} /></View> : null}
              <View style={styles.cardText}>
                <Text style={styles.name}>{t.titleFa}</Text>
                <Text style={styles.hint}>{fa.tournament.status[t.status]} · {fa.tournament.joined(t.joined, t.size)} · {fa.tournament.entry(t.entryCoins)} · {fa.tournament.levelFrom(t.minLevel)}</Text>
                <Text style={styles.hint}>{fa.tournament.starts}: {when(t.startsAt)}{t.entered ? ` · ${fa.tournament.mine}` : ''}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
        <CandyButton label={fa.tournament.close} color={colors.candy.sky} onPress={onClose} />
      </Pressable>
    </Pressable>
  );
}

function TournamentPage({ id, onBack }: { id: string; onBack: () => void }) {
  const [t, setT] = useState<TournamentDetail | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const load = useCallback(() => {
    fetchTournament(id).then(setT, () => setNote(fa.tournament.errors.generic ?? ''));
  }, [id]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 10_000);
    return () => clearInterval(timer);
  }, [load]);

  const act = (fn: (id: string) => Promise<void>) => fn(id).then(() => (setNote(null), load()), (e) => (setNote(fa.tournament.errors[e instanceof ApiError ? e.code : 'generic'] ?? fa.tournament.errors.generic ?? ''), load()));
  const why = t ? blockedText(t.blocked, t) : null;
  const prizeLabel = (place: number) => placeLabel(place);

  return (
    <Pressable style={styles.overlay} onPress={onBack} accessibilityLabel={fa.tournament.back}>
      <Pressable style={styles.sheet} onPress={() => undefined}>
        {t ? (
          <ScrollView style={styles.list} contentContainerStyle={styles.content}>
            <View style={styles.head}>
              {t.iconKey ? <View style={styles.icon}><Item icon={t.iconKey} /></View> : null}
              <Text style={styles.title}>{t.titleFa}</Text>
            </View>
            <Text style={styles.hint}>{fa.tournament.status[t.status]} · {fa.tournament.joined(t.joined, t.size)} · {fa.tournament.entry(t.entryCoins)} · {fa.tournament.levelFrom(t.minLevel)}</Text>
            <Text style={styles.hint}>{fa.tournament.starts}: {when(t.startsAt)}</Text>
            {t.descriptionFa ? <Text style={styles.text}>{t.descriptionFa}</Text> : null}
            {t.prizes.length > 0 ? (
              <>
                <Text style={styles.label}>{fa.tournament.prizes}</Text>
                {t.prizes.map((p) => <Text key={p.place} style={styles.text}>{fa.tournament.prizeLine(prizeLabel(p.place), p.coins)}</Text>)}
              </>
            ) : null}
            <Text style={styles.label}>{fa.tournament.rulesTitle}</Text>
            {[fa.tournament.rules.elimination, fa.tournament.rules.fee(t.entryCoins), fa.tournament.rules.byes, fa.tournament.rules.cancel, fa.tournament.rules.online].map((r) => <Text key={r} style={styles.hint}>• {r}</Text>)}
            {t.status === 'open' ? (
              t.entered ? (
                <CandyButton label={fa.tournament.leave} color={colors.candy.orange} onPress={() => void act(leaveTournament)} />
              ) : (
                <>
                  {why ? <Text style={styles.warn}>{why}</Text> : null}
                  <CandyButton label={fa.tournament.join} color={colors.candy.lime} disabled={t.blocked !== null} onPress={() => void act(joinTournament)} />
                </>
              )
            ) : null}
            {note ? <Text style={styles.warn}>{note}</Text> : null}
            {t.results.length > 0 ? (
              <>
                <Text style={styles.label}>{fa.tournament.results}</Text>
                {t.results.map((r) => <Text key={r.id} style={styles.text}>{placeLabel(r.place)}: {r.nickname}{r.coins > 0 ? ` (${n(r.coins)})` : ''}</Text>)}
              </>
            ) : null}
            {t.bracket.length > 0 ? (
              <>
                <Text style={styles.label}>{fa.tournament.bracket}</Text>
                {Array.from({ length: t.rounds }, (_, i) => i + 1).map((round) => (
                  <View key={round} style={styles.round}>
                    <Text style={styles.roundTitle}>{roundLabel(round, t.size)}</Text>
                    {t.bracket.filter((m) => m.round === round).map((m) => (
                      <Text key={`${m.round}-${m.slot}`} style={[styles.match, m.status === 'playing' && styles.live]}>
                        {(m.a?.nickname ?? (m.status === 'bye' ? fa.tournament.bye : fa.tournament.waiting))} {m.winnerId && m.winnerId === m.a?.id ? '✓' : ''} ⚔ {(m.b?.nickname ?? (m.status === 'bye' ? fa.tournament.bye : fa.tournament.waiting))} {m.winnerId && m.winnerId === m.b?.id ? '✓' : ''}
                      </Text>
                    ))}
                  </View>
                ))}
              </>
            ) : null}
            <Text style={styles.label}>{fa.tournament.players} ({n(t.players.length)})</Text>
            <View style={styles.people}>
              {t.players.map((p) => (
                <View key={p.id} style={styles.person}><Avatar avatar={avatarOf(p.avatarKey)} size={28} /><Text style={styles.hint}>{p.nickname}</Text></View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <Text style={styles.hint}>{note ?? ''}</Text>
        )}
        <CandyButton label={fa.tournament.back} color={colors.candy.sky} onPress={onBack} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 420, maxHeight: '90%', backgroundColor: colors.cream, borderWidth: 3, borderColor: INK, borderRadius: 24, padding: 14, gap: 8, alignItems: 'center' },
  title: { fontFamily: fonts.display, fontSize: 22, color: INK },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { alignSelf: 'stretch', flexGrow: 0 },
  content: { gap: 6 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16, borderWidth: 2, borderColor: INK, backgroundColor: '#fff' },
  cardText: { flex: 1, gap: 2 },
  icon: { width: 44, height: 44 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: INK },
  label: { fontFamily: fonts.bold, fontSize: 15, color: INK, marginTop: 6 },
  text: { fontFamily: fonts.bold, fontSize: 14, color: INK },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: INK, opacity: 0.8 },
  warn: { fontFamily: fonts.bold, fontSize: 13, color: '#B3261E' },
  round: { gap: 2 },
  roundTitle: { fontFamily: fonts.bold, fontSize: 13, color: INK, opacity: 0.7 },
  match: { fontFamily: fonts.bold, fontSize: 13, color: INK, paddingVertical: 2 },
  live: { color: '#8A2BE2' },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
