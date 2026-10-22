import { FACE_TEXT } from '../theme/skin';
import { useEffect, useState } from 'react';
import { SkeletonRows } from '../components/Skeleton';
import { swr } from '../net/cache';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LEADERBOARD_PERIODS, LEADERBOARD_SCOPES, provinceOf, toPersianDigits } from '@dozari/shared';
import type { Leaderboard, LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { ProvinceBadge } from '../components/ProvinceBadge';
import { GuideBubble } from '../components/GuideBubble';
import { EmptyNote } from '../components/EmptyState';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchLeaderboard } from './api';
import { avatarOf } from './avatarOf';
import { CityPicker } from './CityPicker';
import { PlayerSheet } from './PlayerSheet';
import { pageTop } from '../theme/safeArea';
import { useHardwareBack } from '../nav/useHardwareBack';
import { TEXT_RIGHT } from '../theme/direction';
import { useTheme } from '../theme/themeStore';
import { AdultBackdrop, BrassSquare, Plate } from '../duel/adultKit';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));
/** Podium colours by place: light, base, dark (gold, silver, bronze of the design). */
const PODIUM = {
  1: { light: '#FFE48A', base: '#FFC93C', dark: '#A86E00', height: 96 },
  2: { light: '#E6EEF8', base: '#B8C6DA', dark: '#6F7F96', height: 68 },
  3: { light: '#FFC9A3', base: '#E8924B', dark: '#9A5522', height: 50 },
} as const;

/** Podium metals of the adult look (design «جارچی»): gold, silver, bronze with the block height and the avatar size. */
const PODIUM_ADULT = {
  1: { c: '#E8B64A', from: '#FFF1B8', to: '#B8822A', h: 72, av: 68 },
  2: { c: '#DDE4EF', from: '#FFFFFF', to: '#8C96A6', h: 52, av: 58 },
  3: { c: '#D9A06A', from: '#F6C9A0', to: '#7A4420', h: 38, av: 58 },
} as const;
const GOLD_FACE = { from: '#FFF1B8', to: '#8A5A16' } as const;

/**
 * screen-leaderboard of `11 More Screens` (D108): a purple chequer with a golden glow, a pink title plate, three tabs
 * (everyone, my city, friends), the podium of the top three, the rest as a list on a cream sheet and, pinned at the
 * bottom, the player's own place. Ranked by XP of the chosen window: all time, last 7 days, last 30 days (D123).
 */
export function LeaderboardPage({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [scope, setScope] = useState<LeaderboardScope>('all');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all');
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [pickCity, setPickCity] = useState(false);
  const [nonce, setNonce] = useState(0);
  const t = fa.leaderboard;
  const adult = useTheme() === 'adult';

  // The last board seen for this tab shows at once (with placeholders only the very first time) and is refreshed behind it.
  useEffect(() => {
    setBoard(null);
    setFailed(false);
    return swr(`board.${scope}.${period}`, () => fetchLeaderboard(scope, period), (b) => setBoard(b), () => setFailed(true));
  }, [scope, period, nonce]);

  if (pickCity) return <CityPicker current={null} onPicked={() => (setPickCity(false), setNonce((v) => v + 1))} onClose={() => setPickCity(false)} />;
  if (open) return <PlayerSheet playerId={open} onClose={() => setOpen(null)} />;
  const entries = board?.entries ?? [];
  const top = entries.slice(0, 3);
  const rest = entries.slice(3);
  // Visual order of the podium: 2nd, 1st, 3rd.
  const stage = [top[1], top[0], top[2]].filter((e): e is LeaderboardEntry => e !== undefined);
  const inList = board?.me ? entries.some((e) => e.isMe) : false;

  if (adult) {
    // Adult look: «صرافی و گاوصندوق» vault scene, brass back square + dark title plank, two tab strips, metal podium, dark sheet (docs/design/adult/Dozari Adult - Leaderboard (standalone).html).
    const tabStrip = <K extends string>(keys: readonly K[], cur: K, set: (k: K) => void, label: (k: K) => string) => (
      <View style={styles.stripAdult}>
        {keys.map((k) => (
          <Pressable key={k} onPress={() => set(k)} accessibilityRole="tab" accessibilityState={{ selected: cur === k }} style={[styles.tabAdult, cur === k ? styles.tabOnAdult : null]}>
            {cur === k ? <GradientFill from={GOLD_FACE.from} to={GOLD_FACE.to} mid={{ at: 0.45, color: '#E8B64A' }} /> : null}
            <Text style={[styles.tabTextAdult, cur === k ? styles.tabTextOnAdult : null]}>{label(k)}</Text>
          </Pressable>
        ))}
      </View>
    );
    return (
      <View style={styles.root}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none"><AdultBackdrop /></View>
        <View style={styles.column}>
          <View style={styles.head}>
            <BrassSquare label={t.close} onPress={onClose} glyph="back" />
            <View style={styles.flex1}>
              <Plate radius={13} border="#E8B64A" from="#2A1E16" to="#17100C" ledge={3} height={42} style={styles.plateAdult}><Text style={styles.plateTextAdult}>{t.title}</Text></Plate>
            </View>
          </View>
          <View style={styles.stripsAdult}>
            {tabStrip(LEADERBOARD_SCOPES, scope, setScope, (k) => t.tabs[k])}
            {tabStrip(LEADERBOARD_PERIODS, period, setPeriod, (k) => t.periods[k])}
          </View>
          <View style={styles.stageAdult}>
            {stage.map((e) => {
              const p = PODIUM_ADULT[e.rank as 1 | 2 | 3];
              return (
                <Pressable key={e.id} onPress={() => setOpen(e.id)} accessibilityRole="button" accessibilityLabel={e.nickname} style={styles.spot}>
                  <View style={styles.avRingAdult}>
                    <View style={[styles.avAdult, { width: p.av, height: p.av, borderRadius: p.av / 2, borderColor: p.c }]}><Avatar avatar={avatarOf(e.avatarKey)} size={p.av} /></View>
                  </View>
                  <Text style={styles.spotNameAdult} numberOfLines={1}>{e.isMe ? t.you : e.nickname}</Text>
                  <Text style={[styles.spotXpAdult, { color: p.c }]}>{n(e.xp)}</Text>
                  <View style={[styles.blockAdult, { height: p.h }]}>
                    <GradientFill from={p.from} to={p.to} mid={{ at: 0.5, color: p.c }} />
                    <Text style={styles.blockRankAdult}>{n(e.rank)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.sheetAdult}>
            <GradientFill from="#17100C" to="#0E0A08" />
            <ScrollView contentContainerStyle={styles.rowsAdult} showsVerticalScrollIndicator={false}>
              {board && entries.length === 0 ? null : <GuideBubble who="mashti" text={fa.leaderboard.pahlevanHello} />}
              {board === null && !failed ? <SkeletonRows rows={7} /> : null}
              {failed ? <Text style={styles.noteAdult}>{t.error}</Text> : null}
              {board && entries.length === 0 ? <EmptyNote skin={3} pose="thinking" text={scope === 'city' && board.hasCity ? t.emptyCity : t.empty[scope]} /> : null}
              {board && scope === 'city' && !board.hasCity ? (
                <Pressable onPress={() => setPickCity(true)} accessibilityRole="button" style={styles.cityBtnAdult}><Text style={styles.cityBtnTextAdult}>{t.pickCity}</Text></Pressable>
              ) : null}
              {rest.map((e) => (
                <Pressable key={e.id} onPress={() => setOpen(e.id)} accessibilityRole="button" style={[styles.rowAdult, e.isMe ? styles.rowMeAdult : null]}>
                  <GradientFill from="#2A1E16" to="#1E150F" />
                  <Text style={styles.rankAdult}>{n(e.rank)}</Text>
                  <View style={styles.rowAvAdult}><Avatar avatar={avatarOf(e.avatarKey)} size={34} /></View>
                  <Text style={styles.rowTextAdult} numberOfLines={1}>{e.isMe ? t.you : e.nickname}</Text>
                  <Text style={styles.rowScoreAdult}>{n(e.xp)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {board?.me && !inList ? (
              <View style={styles.mineAdultBox}>
                <Plate radius={14} border="#000" ring={0} from={GOLD_FACE.from} to={GOLD_FACE.to} ledge={4} height={50} style={styles.mineAdult}>
                  <Text style={styles.mineTextAdult}>{n(board.me.rank)}</Text>
                  <Text style={[styles.mineTextAdult, styles.flex1]}>{t.you}</Text>
                  <Text style={styles.mineTextAdult}>{n(board.me.xp)}</Text>
                </Plate>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.glow} pointerEvents="none"><GradientFill from="rgba(255,201,60,0.38)" to="rgba(60,42,142,0)" /></View>
      <View style={styles.column}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={t.close} onPress={onClose}>
            {({ pressed }) => (
              <View style={[styles.back, pressed ? styles.pressed : null]}>
                <GradientFill from="#C9A3FF" to="#A66BF0" />
                <Icon name="back" size={22} color="#fff" strokeWidth={3} />
              </View>
            )}
          </Pressable>
          <View style={styles.plate}>
            <GradientFill from="#FF8FB6" to="#FF4D8D" />
            <Text style={styles.plateText}>{t.title}</Text>
          </View>
          <View style={styles.spacer} />
        </View>

        <View style={styles.tabs}>
          {LEADERBOARD_SCOPES.map((k) => (
            <Pressable key={k} onPress={() => setScope(k)} accessibilityRole="tab" accessibilityState={{ selected: scope === k }} style={[styles.tab, scope === k ? styles.tabOn : null]}>
              <Text style={[styles.tabText, scope === k ? styles.tabTextOn : null]}>{t.tabs[k]}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.tabs}>
          {LEADERBOARD_PERIODS.map((k) => (
            <Pressable key={k} onPress={() => setPeriod(k)} accessibilityRole="tab" accessibilityState={{ selected: period === k }} style={[styles.tab, period === k ? styles.tabOn : null]}>
              <Text style={[styles.tabText, period === k ? styles.tabTextOn : null]}>{t.periods[k]}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.stage}>
          {stage.map((e) => {
            const p = PODIUM[e.rank as 1 | 2 | 3];
            const prov = provinceOf(e.province);
            return (
              <Pressable key={e.id} onPress={() => setOpen(e.id)} accessibilityRole="button" accessibilityLabel={e.nickname} style={styles.spot}>
                <Avatar avatar={avatarOf(e.avatarKey)} size={e.rank === 1 ? 74 : 60} />
                <View style={styles.nameRow}>
                  {prov ? <ProvinceBadge province={prov} size={16} /> : null}
                  <Text style={[styles.spotName, e.isMe ? styles.me : null]} numberOfLines={1}>{e.isMe ? t.you : e.nickname}</Text>
                </View>
                <Text style={styles.spotXp}>{n(e.xp)}</Text>
                <View style={[styles.block, { height: p.height, borderColor: colors.ink }]}>
                  <GradientFill from={p.light} to={p.base} />
                  <Text style={[styles.blockRank, { textShadowColor: p.dark }]}>{n(e.rank)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.rows}>
            {board && entries.length === 0 ? null : <GuideBubble who="pahlevan" text={fa.leaderboard.pahlevanHello} />}
            {board === null && !failed ? <SkeletonRows rows={7} /> : null}
            {failed ? <Text style={styles.note}>{t.error}</Text> : null}
            {board && entries.length === 0 ? <EmptyNote skin={3} pose="thinking" text={scope === 'city' && board.hasCity ? t.emptyCity : t.empty[scope]} /> : null}
            {board && scope === 'city' && !board.hasCity ? (
              <Pressable onPress={() => setPickCity(true)} accessibilityRole="button" style={styles.cityBtn}><Text style={styles.cityBtnText}>{t.pickCity}</Text></Pressable>
            ) : null}
            {rest.map((e) => (
              <Pressable key={e.id} onPress={() => setOpen(e.id)} accessibilityRole="button" style={[styles.row, e.isMe ? styles.rowMe : null]}>
                <Text style={styles.rank}>{n(e.rank)}</Text>
                <Avatar avatar={avatarOf(e.avatarKey)} size={34} />
                <View style={styles.rowName}>
                  {provinceOf(e.province) ? <ProvinceBadge province={provinceOf(e.province)!} size={18} /> : null}
                  <Text style={styles.rowText} numberOfLines={1}>{e.isMe ? t.you : e.nickname}</Text>
                </View>
                <Text style={styles.score}>{n(e.xp)}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {board?.me && !inList ? (
            <View style={styles.mine}>
              <GradientFill from="#FFE48A" to={colors.candy.yellow} />
              <Text style={styles.mineRank}>{n(board.me.rank)}</Text>
              <Text style={styles.mineName}>{t.you}</Text>
              <Text style={styles.mineScore}>{n(board.me.xp)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  plateAdult: { alignItems: 'center', justifyContent: 'center' },
  plateTextAdult: { fontFamily: fonts.display, fontSize: 26, lineHeight: 38, color: '#FFE9A8', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  stripsAdult: { gap: 6, marginHorizontal: 12, marginTop: 12 },
  stripAdult: { flexDirection: ROW, gap: 4, padding: 4, borderRadius: 14, backgroundColor: '#0E0A08', borderWidth: 2, borderColor: '#8A5A16' },
  tabAdult: { flex: 1, height: 30, borderRadius: 10, borderWidth: 2, borderColor: 'transparent', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tabOnAdult: { borderColor: '#000' },
  tabTextAdult: { fontFamily: fonts.display, fontSize: 15, lineHeight: 24, color: 'rgba(255,233,168,0.7)' },
  tabTextOnAdult: { color: '#2A1606' },
  stageAdult: { flexDirection: ROW, alignItems: 'flex-end', gap: 6, paddingHorizontal: 10, minHeight: 190, paddingTop: 6 },
  avRingAdult: { borderRadius: 40, backgroundColor: '#000', padding: 2 },
  avAdult: { borderWidth: 3, overflow: 'hidden', backgroundColor: '#17100C' },
  spotNameAdult: { fontFamily: fonts.display, fontSize: 16, lineHeight: 22, color: '#FFE9A8', textShadowColor: '#000', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0, maxWidth: 100, marginTop: 3 },
  spotXpAdult: { fontFamily: fonts.display, fontSize: 14, lineHeight: 20, marginBottom: 3 },
  blockAdult: { width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12, borderWidth: 2, borderBottomWidth: 0, borderColor: '#000', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  blockRankAdult: { fontFamily: fonts.display, fontSize: 34, lineHeight: 48, color: '#2A1606' },
  sheetAdult: { flex: 1, borderTopWidth: 2, borderColor: '#E8B64A', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', paddingTop: 10, paddingHorizontal: 10 },
  rowsAdult: { gap: 6, paddingBottom: 84 },
  noteAdult: { fontFamily: fonts.bold, fontSize: 13, color: '#FFE9A8', textAlign: 'center', marginTop: 10 },
  cityBtnAdult: { alignSelf: 'center', paddingHorizontal: 18, height: 38, borderRadius: 12, borderWidth: 2, borderColor: '#000', backgroundColor: '#E8B64A', alignItems: 'center', justifyContent: 'center' },
  cityBtnTextAdult: { fontFamily: fonts.display, fontSize: 16, color: '#2A1606' },
  rowAdult: { height: 46, flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 12, borderWidth: 1.5, borderColor: '#5A3A1C', overflow: 'hidden' },
  rowMeAdult: { borderColor: '#E8B64A' },
  rankAdult: { width: 24, fontFamily: fonts.display, fontSize: 16, lineHeight: 24, color: '#E8B64A', textAlign: 'center' },
  rowAvAdult: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', borderWidth: 1.5, borderColor: '#B8822A', backgroundColor: '#17100C' },
  rowTextAdult: { flex: 1, minWidth: 0, fontFamily: fonts.display, fontSize: 16, lineHeight: 24, color: '#FFE9A8', textAlign: TEXT_RIGHT },
  rowScoreAdult: { fontFamily: fonts.display, fontSize: 16, lineHeight: 24, color: '#FFE9A8' },
  mineAdultBox: { position: 'absolute', left: 10, right: 10, bottom: 14 },
  mineAdult: { flexDirection: ROW, alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  mineTextAdult: { fontFamily: fonts.display, fontSize: 19, lineHeight: 30, color: '#2A1606', textAlign: TEXT_RIGHT },
  cityBtn: { alignSelf: 'center', paddingHorizontal: 18, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  cityBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#3C2A8E' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: pageTop() },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 24, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, ...FACE_TEXT },
  spacer: { width: 42 },
  tabs: { flexDirection: ROW, marginHorizontal: 30, marginTop: 12, height: 40, padding: 3, gap: 3, borderRadius: 99, borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(43,18,64,0.6)' },
  tab: { flex: 1, borderRadius: 99, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.candy.yellow, borderWidth: 2, borderColor: colors.ink },
  tabText: { fontFamily: fonts.display, fontSize: 15, color: '#E3CCFF' },
  tabTextOn: { color: colors.ink },
  stage: { flexDirection: ROW, alignItems: 'flex-end', gap: 6, paddingHorizontal: 10, minHeight: 232, paddingTop: 6 },
  spot: { flex: 1, alignItems: 'center' },
  nameRow: { flexDirection: ROW, alignItems: 'center', gap: 3, marginTop: 4 },
  spotName: { fontFamily: fonts.display, fontSize: 15, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, maxWidth: 90 },
  me: { color: '#FFE48A' },
  spotXp: { fontFamily: fonts.bold, fontSize: 12, color: '#FFE48A', marginBottom: 4 },
  block: { width: '100%', borderTopLeftRadius: 14, borderTopRightRadius: 14, borderWidth: 3, borderBottomWidth: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  blockRank: { fontFamily: fonts.display, fontSize: 40, color: '#fff', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 1 },
  sheet: { flex: 1, backgroundColor: colors.paper, borderTopWidth: 4, borderColor: colors.ink, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 12, paddingHorizontal: 12 },
  rows: { gap: 6, paddingBottom: 90 },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center', marginTop: 10 },
  row: { height: 46, flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(43,18,64,0.25)', backgroundColor: colors.cream },
  rowMe: { backgroundColor: '#FFF1B8', borderColor: colors.ink },
  rank: { width: 26, fontFamily: fonts.display, fontSize: 18, color: colors.ink, opacity: 0.7, textAlign: 'center' },
  rowName: { flex: 1, flexDirection: ROW, alignItems: 'center', gap: 4 },
  rowText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  score: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  mine: { position: 'absolute', left: 10, right: 10, bottom: 18, height: 52, flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 10, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', ...lift(5) },
  mineRank: { width: 30, fontFamily: fonts.display, fontSize: 20, color: colors.ink, textAlign: 'center' },
  mineName: { flex: 1, fontFamily: fonts.display, fontSize: 15, color: colors.ink, textAlign: TEXT_RIGHT },
  mineScore: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
});
