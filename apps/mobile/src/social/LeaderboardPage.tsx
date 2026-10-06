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

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));
/** Podium colours by place: light, base, dark (gold, silver, bronze of the design). */
const PODIUM = {
  1: { light: '#FFE48A', base: '#FFC93C', dark: '#A86E00', height: 96 },
  2: { light: '#E6EEF8', base: '#B8C6DA', dark: '#6F7F96', height: 68 },
  3: { light: '#FFC9A3', base: '#E8924B', dark: '#9A5522', height: 50 },
} as const;

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
  cityBtn: { alignSelf: 'center', paddingHorizontal: 18, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.yellow, alignItems: 'center', justifyContent: 'center' },
  cityBtnText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#3C2A8E' },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 420 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingTop: pageTop() },
  head: { flexDirection: ROW, alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 24, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  spacer: { width: 42 },
  tabs: { flexDirection: ROW, marginHorizontal: 30, marginTop: 12, height: 40, padding: 3, gap: 3, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: 'rgba(43,18,64,0.6)' },
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
