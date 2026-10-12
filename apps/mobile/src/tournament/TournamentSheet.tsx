import { useCallback, useEffect, useState } from 'react';
import { SkeletonRows } from '../components/Skeleton';
import { swr } from '../net/cache';
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
import { GuideBubble } from '../components/GuideBubble';
import { useConfirm } from '../components/useConfirm';
import { EmptyNote } from '../components/EmptyState';
import { fa } from '../i18n/fa';
import { ApiError } from '../net/http';
import { avatarOf } from '../social/avatarOf';
import { usePlayerSheet } from '../social/usePlayerSheet';
import { colors, fonts } from '../theme/colors';
import { fetchTournament, fetchTournaments, joinTournament, leaveTournament } from './api';
import { SponsorCard, SponsorInvite, SponsorTag } from './Sponsor';
import { LivePulse, LoserFade, StampIn, WinnerHop } from './MatchFx';
import { Winners } from './Winners';
import { blockedText, currentRound, placeLabel, roundLabel, startsInText, turnWhen } from './text';
import { pageTop } from '../theme/safeArea';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));
const when = (ms: number) => new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));
const TINTS = ['#FFE48A', '#3FC1F0', '#FF8FB6', '#B8F08F', '#C9A3FF', '#FFAA7A'];
const STATUS_TONE: Record<string, string> = { full: '#FFAA7A', open: '#7ED957', running: '#FFC93C', finished: '#C9A3FF', draft: '#C9A3FF', cancelled: '#FF8FB6' };

/** «تورنومنت‌ها»: the list (orange page) and a tournament's own page (screen-tournament of `11 More Screens`). */
/** `invite`: the admin's «become a sponsor» card (hidden when there is no contact link). */
export function TournamentSheet({ onClose, invite = null }: { onClose: () => void; invite?: { title: string; body: string; url: string } | null }) {
  const [list, setList] = useState<TournamentListItem[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  useEffect(() => {
    if (openId === null) return swr('tournaments', fetchTournaments, setList, () => setList([]));
    return undefined;
  }, [openId]);
  if (openId) return <TournamentPage id={openId} onBack={() => setOpenId(null)} />;
  return (
    <PageShell title={fa.tournament.title} color={colors.candy.orange} backLabel={fa.tournament.close} onBack={onClose}>
      <ScrollView contentContainerStyle={styles.list}>
        <GuideBubble who="pahlevan" text={fa.tournament.pahlevanHello} />
        {list === null ? <SkeletonRows rows={4} avatar={false} /> : null}
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
                  {t.sponsor ? <SponsorTag sponsor={t.sponsor} /> : null}
                </View>
                {(() => {
                  const label = t.status === 'open' && t.joined >= t.size && !t.entered ? 'full' : t.status;
                  return <View style={[styles.chip, { backgroundColor: STATUS_TONE[label] ?? '#C9A3FF' }]}><Text style={styles.chipText}>{fa.tournament.status[label]}</Text></View>;
                })()}
              </View>
            )}
          </Pressable>
        ))}
        {list && invite ? <SponsorInvite title={invite.title} body={invite.body} url={invite.url} /> : null}
      </ScrollView>
    </PageShell>
  );
}

function TournamentPage({ id, onBack }: { id: string; onBack: () => void }) {
  const { ask, dialog } = useConfirm();
  const players = usePlayerSheet();
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
                  <View style={styles.countdown}><Text style={styles.countdownText}>{fa.tournament.startsIn} <Text style={styles.mono}>{startsInText(t.startsAt, now)}</Text></Text></View>
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

              {t.bracket.length > 0 ? <Bracket t={t} onPlayer={players.open} /> : null}

              {/* Sponsor + details + prizes + rules together, then the results, then who took part. */}
              {t.sponsor ? <SponsorCard sponsor={t.sponsor} /> : null}

              <View style={styles.panel}>
                {t.descriptionFa ? <Text style={styles.text}>{t.descriptionFa}</Text> : null}
                {t.prizes.length > 0 ? (
                  <>
                    <Text style={styles.label}>{fa.tournament.prizes}</Text>
                    {t.prizes.map((p) => <Text key={p.place} style={styles.text}>{fa.tournament.prizeLine(placeLabel(p.place), p.coins, p.spins, p.gems)}</Text>)}
                  </>
                ) : null}
                <Text style={styles.label}>{fa.tournament.rulesTitle}</Text>
                {[fa.tournament.rules.elimination, fa.tournament.rules.fee(t.entryCoins, t.entryGems), fa.tournament.rules.byes, fa.tournament.rules.cancel, ...(t.roundGapMinutes > 0 ? [fa.tournament.rules.scheduled(Math.round(t.roundGapMinutes / 60), t.graceMinutes), fa.tournament.rules.forfeit] : [fa.tournament.rules.online])].map((r) => <Text key={r} style={styles.small}>• {r}</Text>)}
              </View>

              {t.results.length > 0 ? <Winners t={t} onPlayer={players.open} /> : null}

              <View style={styles.panel}>
                <Text style={styles.label}>{fa.tournament.players} ({n(t.players.length)})</Text>
                <View style={styles.people}>
                  {t.players.map((p) => (
                    <View key={p.id} style={styles.personCell}>
                      <Pressable onPress={() => players.open(p.id)} accessibilityRole="button" accessibilityLabel={p.nickname} style={styles.person}>
                        <Avatar avatar={avatarOf(p.avatarKey)} size={40} />
                        <Text style={styles.personName} numberOfLines={1}>{p.nickname}</Text>
                      </Pressable>
                    </View>
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
      {players.sheet}
    </View>
  );
}

/** The bracket, one round at a time: round chips on top, the round's matches in a two-column grid (no sideways scrolling). */
function Bracket({ t, onPlayer }: { t: TournamentDetail; onPlayer: (playerId: string) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const round = picked ?? currentRound(t.bracket, t.rounds);
  const matches = t.bracket.filter((m) => m.round === round).sort((x, y) => x.slot - y.slot);
  const anyone = matches.some((m) => m.a || m.b);
  return (
    <View style={styles.panel}>
      <Text style={styles.label}>{fa.tournament.bracketTitle}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {Array.from({ length: t.rounds }, (_, i) => i + 1).map((r) => (
          <Pressable key={r} onPress={() => setPicked(r)} accessibilityRole="button" accessibilityState={{ selected: r === round }} style={[styles.roundChip, r === round ? styles.roundChipOn : null]}>
            <Text style={[styles.roundChipText, r === round ? styles.roundChipTextOn : null]}>{roundLabel(r, t.size)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {t.roundTimes[round - 1] !== undefined ? <Text style={styles.small}>{fa.tournament.roundAt(roundLabel(round, t.size), turnWhen(t.roundTimes[round - 1]!))}</Text> : null}
      {anyone ? (
        <View style={styles.grid}>
          {matches.map((m) => (
            <View key={`${m.round}-${m.slot}`} style={styles.cell}>
              <MatchCard m={m} onPlayer={onPlayer} />
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.small}>{round === 1 ? fa.tournament.drawLater : fa.tournament.roundLater}</Text>
      )}
    </View>
  );
}

type BracketMatch = TournamentDetail['bracket'][number];

/** One match: both faces, the winner lit up in green with a ✓, the loser greyed out and struck through with a ✕. */
function MatchCard({ m, onPlayer }: { m: BracketMatch; onPlayer: (playerId: string) => void }) {
  const decided = m.winnerId !== null;
  return (
    <View style={styles.matchOuter}>
      <View style={[styles.match, m.status === 'playing' ? styles.matchLive : null]}>
        {([m.a, m.b] as const).map((p, k) => {
          const won = !!p && m.winnerId === p.id;
          const lost = !!p && decided && !won;
          const row = (
            <View style={[styles.player, k === 0 ? styles.playerFirst : null, won ? styles.playerWon : null, lost ? styles.playerLost : null]}>
              <Pressable onPress={p ? () => onPlayer(p.id) : undefined} disabled={!p} accessibilityRole={p ? 'button' : undefined} accessibilityLabel={p?.nickname} style={styles.playerTap}>
              <WinnerHop on={won}>
                <View style={[styles.face, won ? styles.faceWon : null, !p ? styles.faceEmpty : null]}>
                  {p ? <View style={lost ? styles.faceLost : null}><Avatar avatar={avatarOf(p.avatarKey)} size={30} /></View> : <Text style={styles.faceQ}>؟</Text>}
                </View>
              </WinnerHop>
              <Text style={[styles.playerName, won ? styles.nameWon : null, lost ? styles.nameLost : null, !p ? styles.dim : null]} numberOfLines={1}>
                {p?.nickname ?? (m.status === 'bye' ? fa.tournament.bye : fa.tournament.waiting)}
              </Text>
              </Pressable>
              {won ? <StampIn><View style={styles.badgeWon}><Text style={styles.badgeText}>✓</Text></View></StampIn> : null}
              {lost ? <View style={styles.badgeLost}><Text style={styles.badgeText}>✕</Text></View> : null}
            </View>
          );
          return lost ? <LoserFade key={k}>{row}</LoserFade> : <View key={k}>{row}</View>;
        })}
        <View style={styles.vs} pointerEvents="none"><Text style={styles.vsText}>VS</Text></View>
      </View>
      {m.status === 'playing' ? <LivePulse /> : null}
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  list: { gap: 8, paddingBottom: 24 },
  note: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink, textAlign: 'center', marginTop: 12 },
  pressed: { transform: [{ translateY: 3 }] },
  card: { flexDirection: ROW, alignItems: 'center', gap: 10, padding: 8, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.card, ...lift(4) },
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
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.card },
  statusText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  ribbonRow: { alignItems: 'center', gap: 8, marginTop: 6 },
  ribbon: { height: 58, paddingHorizontal: 30, borderRadius: 14, borderWidth: 4, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', ...lift(6) },
  ribbonText: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  countdown: { paddingHorizontal: 14, paddingVertical: 3, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream },
  countdownText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  mono: { fontFamily: fonts.bold, writingDirection: 'ltr' },
  stats: { flexDirection: ROW, gap: 8, marginTop: 6 },
  stat: { flex: 1, height: 62, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...lift(4) },
  statValue: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  statLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
  chips: { flexDirection: ROW, gap: 6, paddingVertical: 4 },
  roundChip: { paddingHorizontal: 12, height: 32, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream, justifyContent: 'center' },
  roundChipOn: { backgroundColor: '#7E46D6' },
  roundChipText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink },
  roundChipTextOn: { color: '#fff' },
  grid: { flexDirection: ROW, flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '50%', padding: 4 },
  matchOuter: { borderRadius: 12, backgroundColor: colors.paper, ...lift(3) },
  match: { borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, overflow: 'hidden' },
  matchLive: { borderColor: '#7ED957' },
  player: { height: 46, flexDirection: ROW, alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  playerTap: { flex: 1, minWidth: 0, flexDirection: ROW, alignItems: 'center', gap: 6 },
  playerFirst: { borderBottomWidth: 1.5, borderColor: 'rgba(43,18,64,0.15)' },
  playerWon: { backgroundColor: '#D4F5B8' },
  playerLost: { backgroundColor: 'rgba(43,18,64,0.07)' },
  face: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  faceWon: { shadowColor: '#3FA36B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 8, elevation: 6 },
  faceLost: { opacity: 0.4 },
  faceEmpty: { borderRadius: 17, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(43,18,64,0.3)' },
  faceQ: { fontFamily: fonts.display, fontSize: 16, color: 'rgba(43,18,64,0.4)' },
  playerName: { flex: 1, fontFamily: fonts.bold, fontSize: 12, color: colors.ink, textAlign: TEXT_RIGHT },
  nameWon: { fontFamily: fonts.display, fontSize: 13 },
  nameLost: { opacity: 0.5, textDecorationLine: 'line-through' },
  dim: { opacity: 0.5 },
  badgeWon: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#3FA36B', alignItems: 'center', justifyContent: 'center' },
  badgeLost: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(43,18,64,0.5)', backgroundColor: '#E5384F', opacity: 0.8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.display, fontSize: 11, lineHeight: 14, color: '#fff' },
  vs: { position: 'absolute', left: '50%', marginLeft: -11, top: 46 - 9, width: 22, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  vsText: { fontFamily: fonts.display, fontSize: 9, lineHeight: 12, color: colors.ink },
  panel: { gap: 6, padding: 12, borderRadius: 20, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.paper, ...lift(5) },
  label: { fontFamily: fonts.display, fontSize: 16, color: '#7E46D6', textAlign: TEXT_RIGHT, marginTop: 4 },
  text: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 21, color: colors.ink, textAlign: TEXT_RIGHT },
  small: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 19, color: colors.ink, opacity: 0.85, textAlign: TEXT_RIGHT },
  people: { flexDirection: ROW, flexWrap: 'wrap', marginHorizontal: -4 },
  personCell: { width: '33.3333%', padding: 4 },
  person: { alignItems: 'center', gap: 4, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(43,18,64,0.18)', backgroundColor: 'rgba(255,255,255,0.35)' },
  personName: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink, textAlign: 'center', maxWidth: '100%' },
  warnLight: { fontFamily: fonts.bold, fontSize: 12, color: '#FFE48A', textAlign: 'center' },
  cta: { position: 'absolute', left: 16, right: 16, bottom: 22, gap: 6 },
});
