import { useCallback, useEffect, useState } from 'react';
import { playSfx } from '../sound/engine';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TournamentDetail, TournamentListItem } from '@dozari/shared';
import { toPersianDigits } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { PageShell } from '../components/PageShell';
import { Scene } from '../components/Scene';
import { SlabButton } from '../components/SlabButton';
import { formatCountdown } from '../daily/countdown';
import { GuideBubble } from '../components/GuideBubble';
import { useConfirm } from '../components/useConfirm';
import { EmptyNote } from '../components/EmptyState';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { avatarOf } from '../social/avatarOf';
import { colors, fonts } from '../theme/colors';
import { fetchTournament, fetchTournaments, joinTournament, leaveTournament } from './api';
import { blockedText, placeLabel, roundLabel } from './text';
import { pageTop } from '../theme/safeArea';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));
const when = (ms: number) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
const TINTS = ['#FFE48A', '#3FC1F0', '#FF8FB6', '#B8F08F', '#C9A3FF', '#FFAA7A'];
const STATUS_TONE: Record<string, string> = { open: '#7ED957', running: '#FFC93C', finished: '#C9A3FF', draft: '#C9A3FF', cancelled: '#FF8FB6' };

/** «تورنومنت‌ها»: the list (orange page) and a tournament's own page (screen-tournament of `11 More Screens`). */
export function TournamentSheet({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<TournamentListItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (openId === null) fetchTournaments().then(setList, () => setList([]));
  }, [openId]);
  if (openId) return <TournamentPage id={openId} onBack={() => setOpenId(null)} />;
  return (
    <PageShell title={fa.tournament.title} color={colors.candy.orange} backLabel={fa.tournament.close} onBack={onClose}>
      <ScrollView contentContainerStyle={styles.list}>
        <GuideBubble who="pahlevan" text={fa.tournament.pahlevanHello} />
        {list && list.length === 0 ? <EmptyNote skin={0} pose="sad" text={fa.tournament.empty} /> : null}
        {list?.map((t, i) => (
          <Pressable key={t.id} onPress={() => setOpenId(t.id)} accessibilityRole="button">
            {({ pressed }) => (
              <View style={[styles.card, pressed ? styles.pressed : null]}>
                <View style={[styles.tile, { backgroundColor: TINTS[i % TINTS.length] }]}>
                  <View style={styles.tileIcon}><Item icon={t.iconKey ?? 'trophy'} /></View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{t.titleFa}</Text>
                  <Text style={styles.cardSub}>{fa.tournament.joined(t.joined, t.size)} · {fa.tournament.entry(t.entryCoins, t.entryGems)}</Text>
                  <Text style={styles.cardSub}>{fa.tournament.starts}: {when(t.startsAt)}{t.entered ? ` · ${fa.tournament.mine}` : ''}</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: STATUS_TONE[t.status] ?? '#C9A3FF' }]}><Text style={styles.chipText}>{fa.tournament.status[t.status]}</Text></View>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </PageShell>
  );
}

function TournamentPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { ask, dialog } = useConfirm();
  const [t, setT] = useState<TournamentDetail | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const load = useCallback(() => {
    fetchTournament(id).then(setT, () => setNote(fa.tournament.errors.generic ?? ''));
  }, [id]);
  useEffect(() => {
    load();
    const timer = setInterval(load, 10_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => (clearInterval(timer), clearInterval(tick));
  }, [load]);

  const act = (fn: (id: string) => Promise<void>) => fn(id).then(() => (setNote(null), load()), (e) => (setNote(fa.tournament.errors[e instanceof ApiError ? e.code : 'generic'] ?? fa.tournament.errors.generic ?? ''), load()));
  const why = t ? blockedText(t.blocked, t) : null;
  const first = t?.prizes.find((p) => p.place === 1)?.coins ?? 0;

  return (
    <View style={styles.root}>
      <View style={styles.sceneBox} pointerEvents="none"><Scene scene="win" /></View>
      <View style={styles.fade} pointerEvents="none"><GradientFill from="rgba(64,22,106,0)" to="#40166A" mid={{ at: 0.46, color: 'rgba(64,22,106,0.92)' }} /></View>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.column}>
          <View style={styles.top}>
            <Pressable accessibilityRole="button" accessibilityLabel={fa.tournament.back} onPress={() => (playSfx('back'), onBack())}>
              {({ pressed }) => (
                <View style={[styles.back, pressed ? styles.pressed : null]}>
                  <GradientFill from="#C9A3FF" to="#A66BF0" />
                  <Icon name="back" size={22} color="#fff" strokeWidth={3} />
                </View>
              )}
            </Pressable>
            {t ? (
              <View style={[styles.status, { backgroundColor: STATUS_TONE[t.status] ?? '#C9A3FF' }]}>
                {t.status === 'open' ? <View style={styles.dot} /> : null}
                <Text style={styles.statusText}>{fa.tournament.status[t.status]}</Text>
              </View>
            ) : null}
          </View>

          {t ? (
            <>
              <View style={styles.ribbonRow}>
                <View style={styles.ribbon}>
                  <GradientFill from="#FFE48A" to={colors.candy.yellow} />
                  <Text style={styles.ribbonText} numberOfLines={1}>{t.titleFa}</Text>
                </View>
                {t.status === 'open' ? (
                  <View style={styles.countdown}><Text style={styles.countdownText}>{fa.tournament.startsIn} <Text style={styles.mono}>{formatCountdown(t.startsAt, now)}</Text></Text></View>
                ) : (
                  <View style={styles.countdown}><Text style={styles.countdownText}>{fa.tournament.startedAt}: {when(t.startsAt)}</Text></View>
                )}
              </View>

              <View style={styles.stats}>
                {([['players', `${n(t.joined)}/${n(t.size)}`, '#B8F08F'], ['entry', t.entryCoins === 0 && t.entryGems === 0 ? fa.tournament.free : [t.entryCoins > 0 ? n(t.entryCoins) : '', t.entryGems > 0 ? `${n(t.entryGems)}💎` : ''].filter(Boolean).join('+'), '#FFE48A'], ['prize', n(first), '#FF8FB6']] as const).map(([k, v, c]) => (
                  <View key={k} style={[styles.stat, { backgroundColor: c }]}>
                    <Text style={styles.statValue}>{v}</Text>
                    <Text style={styles.statLabel}>{fa.tournament.statTitle[k]}</Text>
                  </View>
                ))}
              </View>

              {t.bracket.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bracket}>
                  {Array.from({ length: t.rounds }, (_, i) => i + 1).map((round) => (
                    <View key={round} style={styles.col}>
                      <Text style={styles.colTitle}>{roundLabel(round, t.size)}</Text>
                      <View style={styles.colBody}>
                        {t.bracket.filter((m) => m.round === round).map((m) => (
                          <View key={`${m.round}-${m.slot}`} style={[styles.match, m.status === 'playing' ? styles.matchLive : null]}>
                            {([m.a, m.b] as const).map((p, k) => (
                              <View key={k} style={[styles.player, p && m.winnerId === p.id ? styles.playerWon : null]}>
                                <Text style={[styles.playerName, !p || (m.winnerId && m.winnerId !== p.id) ? styles.dim : null]} numberOfLines={1}>
                                  {p?.nickname ?? (m.status === 'bye' ? fa.tournament.bye : fa.tournament.waiting)}
                                </Text>
                                {p && m.winnerId === p.id ? <Text style={styles.check}>✓</Text> : null}
                              </View>
                            ))}
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              ) : null}

              <View style={styles.panel}>
                {t.descriptionFa ? <Text style={styles.text}>{t.descriptionFa}</Text> : null}
                {t.prizes.length > 0 ? (
                  <>
                    <Text style={styles.label}>{fa.tournament.prizes}</Text>
                    {t.prizes.map((p) => <Text key={p.place} style={styles.text}>{fa.tournament.prizeLine(placeLabel(p.place), p.coins, p.spins, p.gems)}</Text>)}
                  </>
                ) : null}
                <Text style={styles.label}>{fa.tournament.rulesTitle}</Text>
                {[fa.tournament.rules.elimination, fa.tournament.rules.fee(t.entryCoins, t.entryGems), fa.tournament.rules.byes, fa.tournament.rules.cancel, fa.tournament.rules.online].map((r) => <Text key={r} style={styles.small}>• {r}</Text>)}
                {t.results.length > 0 ? (
                  <>
                    <Text style={styles.label}>{fa.tournament.results}</Text>
                    {t.results.map((r) => <Text key={r.id} style={styles.text}>{placeLabel(r.place)}: {r.nickname}{r.coins > 0 ? ` (${n(r.coins)})` : ''}</Text>)}
                  </>
                ) : null}
                <Text style={styles.label}>{fa.tournament.players} ({n(t.players.length)})</Text>
                <View style={styles.people}>
                  {t.players.map((p) => (
                    <View key={p.id} style={styles.person}><Avatar avatar={avatarOf(p.avatarKey)} size={28} /><Text style={styles.small}>{p.nickname}</Text></View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.warnLight}>{note ?? ''}</Text>
          )}
        </View>
      </ScrollView>

      {t && t.status === 'open' ? (
        <View style={styles.cta}>
          {why && !t.entered ? <Text style={styles.warnLight}>{why}</Text> : null}
          {note ? <Text style={styles.warnLight}>{note}</Text> : null}
          {t.entered ? (
            <SlabButton label={fa.tournament.leave} color={colors.candy.orange} height={60} fontSize={22} grow={0} onPress={() => ask({ title: fa.confirm.leaveTournament.title, message: fa.confirm.leaveTournament.message, confirmLabel: fa.confirm.leaveTournament.yes, onConfirm: () => void act(leaveTournament) })} />
          ) : (
            <SlabButton label={fa.tournament.join} color={colors.candy.lime} height={64} fontSize={24} grow={0} disabled={t.blocked !== null} onPress={() => void act(joinTournament)} />
          )}
        </View>
      ) : null}
      {dialog}
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  list: { gap: 8, paddingBottom: 24 },
  note: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center', marginTop: 12 },
  pressed: { transform: [{ translateY: 3 }] },
  card: { flexDirection: ROW, alignItems: 'center', gap: 10, padding: 8, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#fff', ...lift(4) },
  tile: { width: 50, height: 50, borderRadius: 14, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  tileIcon: { width: 38, height: 38 },
  cardBody: { flex: 1, minWidth: 0, gap: 1 },
  cardTitle: { fontFamily: fonts.display, fontSize: 16, color: colors.ink, textAlign: TEXT_RIGHT },
  cardSub: { fontFamily: fonts.bold, fontSize: 10.5, color: '#5A3A7A', textAlign: TEXT_RIGHT },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, borderWidth: 2, borderColor: colors.ink },
  chipText: { fontFamily: fonts.display, fontSize: 11, color: colors.ink },

  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#40166A' },
  sceneBox: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  fade: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  page: { paddingBottom: 130 },
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 12, paddingTop: pageTop(), gap: 12 },
  top: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  status: { flexDirection: ROW, alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
  statusText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  ribbonRow: { alignItems: 'center', gap: 8, marginTop: 6 },
  ribbon: { height: 58, paddingHorizontal: 30, borderRadius: 14, borderWidth: 4, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', ...lift(6) },
  ribbonText: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  countdown: { paddingHorizontal: 14, paddingVertical: 3, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#FFF6E8' },
  countdownText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  mono: { fontFamily: fonts.bold, writingDirection: 'ltr' },
  stats: { flexDirection: ROW, gap: 8, marginTop: 6 },
  stat: { flex: 1, height: 62, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...lift(4) },
  statValue: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  statLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
  bracket: { flexDirection: ROW, gap: 12, paddingTop: 22, paddingBottom: 4 },
  col: { width: 138, gap: 6 },
  colTitle: { position: 'absolute', top: -18, left: 0, right: 0, textAlign: 'center', fontFamily: fonts.display, fontSize: 13, color: colors.candy.yellow },
  colBody: { justifyContent: 'space-around', gap: 8, flexGrow: 1 },
  match: { borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#FBF1DE', overflow: 'hidden', ...lift(3) },
  matchLive: { borderColor: '#7ED957' },
  player: { height: 28, flexDirection: ROW, alignItems: 'center', gap: 4, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: 'rgba(43,18,64,0.15)' },
  playerWon: { backgroundColor: '#E4F7D0' },
  playerName: { flex: 1, fontFamily: fonts.bold, fontSize: 11, color: colors.ink, textAlign: TEXT_RIGHT },
  dim: { opacity: 0.5 },
  check: { fontFamily: fonts.display, fontSize: 13, color: '#3FA36B' },
  panel: { gap: 6, padding: 12, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FBF1DE', ...lift(5) },
  label: { fontFamily: fonts.display, fontSize: 16, color: '#7E46D6', textAlign: TEXT_RIGHT, marginTop: 4 },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.ink, textAlign: TEXT_RIGHT },
  small: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 19, color: colors.ink, opacity: 0.85, textAlign: TEXT_RIGHT },
  people: { flexDirection: ROW, flexWrap: 'wrap', gap: 8 },
  person: { flexDirection: ROW, alignItems: 'center', gap: 4 },
  warnLight: { fontFamily: fonts.bold, fontSize: 12, color: '#FFE48A', textAlign: 'center' },
  cta: { position: 'absolute', left: 16, right: 16, bottom: 22, gap: 6 },
});
