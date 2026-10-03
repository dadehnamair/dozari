import { useCallback, useEffect, useState } from 'react';
import { fetchWorn } from '../shop/api';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { provinceOf, toPersianDigits } from '@dozari/shared';
import type { Friends, Gender, MyBadges, MyProfile, RecentGames } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { ProvinceBadge } from '../components/ProvinceBadge';
import { HubTile } from '../home/HubTile';
import type { IconName } from '../theme/icons';
import { Scene } from '../components/Scene';
import { agoText } from '../inbox/ago';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchMyBadges } from '../badges/api';
import { skillText } from '../badges/text';
import { fetchFriends, fetchMyProfile, fetchRecentGames, saveGender } from './api';
import { avatarOf } from './avatarOf';
import { ProfileEditor } from './ProfileEditor';
import { InviteSheet } from '../invite/InviteSheet';
import { LoansSheet } from '../transfers/LoansSheet';
import { FindSheet } from './FindSheet';
import { CityPicker } from './CityPicker';
import { FriendsPage } from './FriendsPage';
import { BadgesSheet } from '../badges/BadgesSheet';
import { LevelRoadPage } from '../levels/LevelRoadPage';
import { pageTop } from '../theme/safeArea';
import { useHardwareBack } from '../nav/useHardwareBack';
import { TEXT_START } from '../theme/direction';

const ROW = ('row-reverse' as const);
const TAGS = ['#FF4D8D', '#7E46D6', '#3FA36B', '#E8743B', '#3FC1F0'];
const n = (v: number) => toPersianDigits(String(v));

/**
 * screen-profile of `11 More Screens` (D107): the caravan scene, the big avatar with its level hexagon, name and skill
 * rank, the level bar, four stat tiles, earned badges, then shortcuts (friends, find, gifts, invite, badges). The
 * pencil opens the editor (nickname, gender, city, e-mail); settings live on their own page.
 */
export function ProfileSheet({ onClose, onGender }: { onClose: () => void; onGender: (g: Gender | null) => void }) {
  useHardwareBack(onClose);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [friends, setFriends] = useState<Friends | null>(null);
  const [badges, setBadges] = useState<MyBadges | null>(null);
  const [games, setGames] = useState<RecentGames['games']>([]);
  const [worn, setWorn] = useState<{ slot: string; iconKey: string | null }[]>([]);
  useEffect(() => {
    fetchWorn().then((r) => setWorn(r.worn), () => undefined);
  }, []);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sub, setSub] = useState<'invite' | 'loans' | 'find' | 'badges' | 'friends' | 'city' | 'levels' | 'recent' | null>(null);
  // Nothing scrolls: on a short phone the header and the tiles tighten instead.
  const compact = useWindowDimensions().height < 720;
  const heroH = compact ? 118 : 140;
  const avatar = compact ? 92 : 108;

  const load = useCallback(() => {
    Promise.all([fetchMyProfile(), fetchFriends()]).then(
      ([m, f]) => (setMe(m), setFriends(f), setFailed(false)),
      () => setFailed(true),
    );
    fetchMyBadges().then(setBadges, () => undefined);
    fetchRecentGames().then((r) => setGames(r.games), () => undefined);
  }, []);
  useEffect(load, [load]);

  const pick = (g: Gender | null) => {
    setMe((m) => (m ? { ...m, gender: g } : m));
    onGender(g);
    saveGender(g).catch(() => setFailed(true));
  };
  const options: [Gender | null, string][] = [['female', fa.profile.female], ['male', fa.profile.male], [null, fa.profile.none]];
  const back = () => (setSub(null), load());

  if (sub === 'city' && me) return <CityPicker current={me.city} onPicked={(city) => (setMe((m) => (m ? { ...m, city } : m)), setSub(null))} onClose={() => setSub(null)} />;
  if (sub === 'friends') return <FriendsPage onClose={back} />;
  if (sub === 'badges') return <BadgesSheet onClose={() => setSub(null)} />;
  if (sub === 'find') return <FindSheet onClose={back} />;
  if (sub === 'loans') return <LoansSheet onClose={() => setSub(null)} />;
  if (sub === 'invite') return <InviteSheet onClose={back} />;
  if (sub === 'levels') return <LevelRoadPage onClose={() => setSub(null)} />;

  const lv = me?.level;
  const pct = lv ? (lv.xpForNext === 0 ? 100 : Math.round((lv.xpInLevel / lv.xpForNext) * 100)) : 0;
  const province = provinceOf(me?.city?.province);
  const incoming = friends?.incoming.length ?? 0;
  const stats = me ? [[fa.profile.statGames, me.stats.games, '#C9A3FF'], [fa.profile.statWins, me.stats.wins, '#B8F08F'], [fa.profile.statLosses, me.stats.losses, '#FF8FB6'], [fa.profile.statDraws, me.stats.draws, '#FFE48A']] as const : [];
  const t = fa.profile.tiles;
  const tiles: { key: string; icon: IconName; label: string; color: string; badge?: string; onPress: () => void }[] = [
    { key: 'levels', icon: 'flag', label: t.levels, color: colors.candy.yellow, onPress: () => setSub('levels') },
    { key: 'friends', icon: 'users', label: t.friends, color: colors.candy.sky, badge: incoming > 0 ? n(incoming) : undefined, onPress: () => setSub('friends') },
    { key: 'badges', icon: 'trophy', label: t.badges, color: colors.candy.grape, onPress: () => setSub('badges') },
    { key: 'recent', icon: 'clock', label: t.recent, color: colors.candy.pink, onPress: () => setSub('recent') },
    { key: 'find', icon: 'search', label: t.find, color: colors.candy.lime, onPress: () => setSub('find') },
    { key: 'loans', icon: 'wallet', label: t.loans, color: colors.candy.orange, onPress: () => setSub('loans') },
    { key: 'invite', icon: 'share', label: t.invite, color: colors.candy.lime, onPress: () => setSub('invite') },
  ];
  const shownBadges = badges ? badges.earned.slice(0, 3) : [];
  const moreBadges = badges ? Math.max(0, badges.earned.length - shownBadges.length) : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { height: heroH }]}>
        <Scene scene="caravan" />
        <View style={styles.heroLine} />
      </View>
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={fa.profile.close} onPress={onClose}>
          {({ pressed }) => (
            <View style={[styles.square, pressed ? styles.pressed : null]}>
              <GradientFill from="#C9A3FF" to="#A66BF0" />
              <Icon name="back" size={22} color="#fff" strokeWidth={3} />
            </View>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={fa.profile.edit} onPress={() => setEditing(true)}>
          {({ pressed }) => (
            <View style={[styles.square, pressed ? styles.pressed : null]}>
              <GradientFill from="#8FDCFA" to="#3FC1F0" />
              <Icon name="edit" size={20} color="#fff" strokeWidth={2.6} />
            </View>
          )}
        </Pressable>
      </View>
      <View style={[styles.column, { paddingTop: heroH - avatar / 2 - 6, gap: compact ? 6 : 9 }]}>
        <View style={styles.avatarWrap}>
          {me ? <Avatar avatar={avatarOf(me.avatarKey)} size={avatar} worn={worn} /> : <View style={{ width: avatar, height: avatar }} />}
          {lv ? (
            <View style={styles.hex} accessibilityLabel={`${fa.profile.level} ${lv.level}`}>
              <Svg width={46} height={52} viewBox="0 0 46 52">
                <Polygon points="23,1 45,8 45,33 23,51 1,33 1,8" fill={colors.ink} />
                <Polygon points="23,7 40,12 40,31 23,45 6,31 6,12" fill="#FFC93C" />
              </Svg>
              <Text style={styles.hexText}>{n(lv.level)}</Text>
            </View>
          ) : null}
        </View>

        {failed ? <Text style={styles.hint}>{fa.profile.error}</Text> : null}
        {me && lv ? (
          <>
            <View style={styles.nameBlock}>
              <Text style={[styles.name, compact ? styles.nameCompact : null]} numberOfLines={1}>{me.nickname}</Text>
              <View style={styles.cityRow}>
                {badges ? <Text style={styles.rank}>{skillText(badges.skill)}</Text> : null}
                {me.city ? (
                  <Pressable onPress={() => setSub('city')} accessibilityRole="button" style={styles.cityRow}>
                    {badges ? <Text style={styles.rank}>·</Text> : null}
                    {province ? <ProvinceBadge province={province} size={22} /> : null}
                    <Text style={styles.rank}>{me.city.nameFa}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.levelBlock}>
              <View style={styles.levelHead}>
                <Text style={styles.levelText}>{fa.profile.level} {n(lv.level)}</Text>
                <Text style={styles.levelXp}>{lv.xpForNext === 0 ? `${n(lv.xp)} ${fa.profile.xp}` : `${n(lv.xpInLevel)} / ${n(lv.xpForNext)}`}</Text>
              </View>
              <View style={styles.track}><View style={[styles.fill, { width: `${pct}%` }]} /></View>
            </View>

            <View style={styles.stats}>
              {stats.map(([label, v, c]) => (
                <View key={label} style={[styles.stat, { backgroundColor: c, height: compact ? 52 : 60 }]}>
                  <Text style={styles.statValue}>{n(v)}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
              ))}
            </View>

            <Pressable onPress={() => setSub('badges')} accessibilityRole="button" style={styles.tagsRow}>
              {shownBadges.length > 0 ? (
                <>
                  {shownBadges.map((b, i) => (
                    <View key={b.id} style={[styles.tag, { backgroundColor: TAGS[i % TAGS.length] }]}><Text style={styles.tagText} numberOfLines={1}>{b.titleFa}</Text></View>
                  ))}
                  {moreBadges > 0 ? <View style={[styles.tag, { backgroundColor: colors.ink }]}><Text style={styles.tagText}>{`+${n(moreBadges)}`}</Text></View> : null}
                </>
              ) : (
                <Text style={styles.hint}>{fa.profile.noBadges}</Text>
              )}
            </Pressable>

            <View style={styles.grid}>
              {tiles.map((x) => <HubTile key={x.key} icon={x.icon} label={x.label} color={x.color} badge={x.badge} onPress={x.onPress} />)}
            </View>
          </>
        ) : null}
      </View>

      {sub === 'recent' ? <RecentGamesSheet games={games} onClose={() => setSub(null)} /> : null}
      {editing && me ? (
        <Pressable style={styles.overlay} onPress={() => setEditing(false)} accessibilityLabel={fa.profile.close}>
          <Pressable style={styles.editor} onPress={() => undefined}>
            <ScrollView contentContainerStyle={styles.editorContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>{fa.profile.edit}</Text>
              <Text style={styles.sectionTitle}>{fa.profile.gender}</Text>
              <Text style={styles.hint}>{fa.profile.genderHint}</Text>
              <View style={styles.pills}>
                {options.map(([g, label]) => (
                  <Pressable key={label} onPress={() => pick(g)} style={[styles.pill, me.gender === g && styles.pillOn]} accessibilityRole="button">
                    <Text style={styles.pillText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <ProfileEditor me={me} onChange={(patch) => setMe((m) => (m ? { ...m, ...patch } : m))} onPickCity={() => (setEditing(false), setSub('city'))} />
              <CandyButton label={fa.profile.close} color={colors.candy.sky} onPress={() => setEditing(false)} />
            </ScrollView>
          </Pressable>
        </Pressable>
      ) : null}
    </View>
  );
}

/** The last games, opened from the «بازی‌ها» tile (they used to stretch the profile page). */
function RecentGamesSheet({ games, onClose }: { games: RecentGames['games']; onClose: () => void }) {
  useHardwareBack(onClose);
  return (
    <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel={fa.profile.close}>
      <Pressable style={styles.editor} onPress={() => undefined}>
        <ScrollView contentContainerStyle={styles.editorContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>{fa.profile.recentGames}</Text>
          {games.length === 0 ? <Text style={styles.hint}>{fa.profile.noGames}</Text> : null}
          {games.map((g, i) => (
            <View key={`${g.at}-${i}`} style={styles.gameRow}>
              <View style={[styles.gameDot, { backgroundColor: g.outcome === 'win' ? '#7ED957' : g.outcome === 'loss' ? '#FF8FB6' : '#FFE48A' }]} />
              <Text style={styles.gameText}>{`${g.mode ? fa.profile.gameMode[g.mode] : fa.profile.gameMode.solo} · ${g.outcome ? fa.profile.gameOutcome[g.outcome] : ''}`}</Text>
              <Text style={styles.gameXp}>{`+${n(g.xp)} ${fa.leaderboard.xp}`}</Text>
              <Text style={styles.gameAgo}>{agoText(g.at, Date.now())}</Text>
            </View>
          ))}
          <CandyButton label={fa.profile.close} color={colors.candy.sky} onPress={onClose} />
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  gameRow: { alignSelf: 'stretch', flexDirection: ROW, alignItems: 'center', gap: 8, paddingVertical: 4 },
  gameDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.ink },
  gameText: { flex: 1, fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: TEXT_START },
  gameXp: { fontFamily: fonts.display, fontSize: 13, color: '#7E46D6' },
  gameAgo: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, opacity: 0.6, minWidth: 54, textAlign: 'left' },
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#FBF1DE' },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  heroLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: colors.ink },
  bar: { position: 'absolute', top: pageTop(), left: 16, right: 16, zIndex: 3, flexDirection: ROW, justifyContent: 'space-between' },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 14, alignItems: 'center' },
  square: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  avatarWrap: { alignItems: 'center' },
  hex: { position: 'absolute', bottom: -4, right: -34, width: 46, height: 52, alignItems: 'center', justifyContent: 'center' },
  hexText: { position: 'absolute', fontFamily: fonts.display, fontSize: 21, color: '#fff', textShadowColor: '#A86E00', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, paddingTop: 4 },
  nameBlock: { alignItems: 'center', gap: 1 },
  name: { fontFamily: fonts.display, fontSize: 28, color: colors.ink, maxWidth: 320 },
  nameCompact: { fontSize: 24 },
  rank: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.65 },
  cityRow: { flexDirection: ROW, alignItems: 'center', gap: 5 },
  levelBlock: { alignSelf: 'stretch', gap: 3 },
  levelHead: { flexDirection: ROW, justifyContent: 'space-between' },
  levelText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  levelXp: { fontFamily: fonts.display, fontSize: 13, color: colors.ink, opacity: 0.6 },
  track: { height: 18, borderRadius: 99, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#E6D3B4', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99, backgroundColor: '#A66BF0' },
  stats: { alignSelf: 'stretch', flexDirection: ROW, gap: 7 },
  stat: { flex: 1, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...lift(3) },
  statValue: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, lineHeight: 26 },
  statLabel: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, opacity: 0.8 },
  tagsRow: { alignSelf: 'stretch', flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 32 },
  grid: { alignSelf: 'stretch', flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', columnGap: 8, rowGap: 10, flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, backgroundColor: 'rgba(20,8,32,0.55)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  editor: { width: '100%', maxWidth: 400, maxHeight: '88%', borderRadius: 22, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFF6E8', overflow: 'hidden' },
  editorContent: { gap: 8, padding: 14 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, textAlign: TEXT_START },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.7, textAlign: TEXT_START },
  pills: { flexDirection: ROW, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.cream },
  pillOn: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  tag: { height: 28, maxWidth: 130, paddingHorizontal: 10, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, justifyContent: 'center', ...lift(3) },
  tagText: { fontFamily: fonts.display, fontSize: 13, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
});
