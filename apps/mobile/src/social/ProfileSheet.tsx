import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { provinceOf, toPersianDigits } from '@dozari/shared';
import type { Friends, Gender, MyBadges, MyProfile } from '@dozari/shared';
import { Avatar } from '../components/Avatar';
import { CandyButton } from '../components/CandyButton';
import { GradientFill } from '../components/GradientFill';
import { Icon } from '../components/Icon';
import { ProvinceBadge } from '../components/ProvinceBadge';
import { Scene } from '../components/Scene';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { fetchMyBadges } from '../badges/api';
import { skillText } from '../badges/text';
import { fetchFriends, fetchMyProfile, saveGender } from './api';
import { avatarOf } from './avatarOf';
import { ProfileEditor } from './ProfileEditor';
import { InviteSheet } from '../invite/InviteSheet';
import { LoansSheet } from '../transfers/LoansSheet';
import { FindSheet } from './FindSheet';
import { CityPicker } from './CityPicker';
import { FriendsPage } from './FriendsPage';
import { BadgesSheet } from '../badges/BadgesSheet';
import { LevelRoadPage } from '../levels/LevelRoadPage';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const TAGS = ['#FF4D8D', '#7E46D6', '#3FA36B', '#E8743B', '#3FC1F0'];
const n = (v: number) => toPersianDigits(String(v));

/**
 * screen-profile of `11 More Screens` (D107): the caravan scene, the big avatar with its level hexagon, name and skill
 * rank, the level bar, four stat tiles, earned badges, then shortcuts (friends, find, gifts, invite, badges). The
 * pencil opens the editor (nickname, gender, city, e-mail); settings live on their own page.
 */
export function ProfileSheet({ onClose, onGender }: { onClose: () => void; onGender: (g: Gender | null) => void }) {
  const [me, setMe] = useState<MyProfile | null>(null);
  const [friends, setFriends] = useState<Friends | null>(null);
  const [badges, setBadges] = useState<MyBadges | null>(null);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sub, setSub] = useState<'invite' | 'loans' | 'find' | 'badges' | 'friends' | 'city' | 'levels' | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchMyProfile(), fetchFriends()]).then(
      ([m, f]) => (setMe(m), setFriends(f), setFailed(false)),
      () => setFailed(true),
    );
    fetchMyBadges().then(setBadges, () => undefined);
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

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.hero}>
          <Scene scene="caravan" />
          <View style={styles.heroLine} />
        </View>
        <View style={styles.column}>
          <View style={styles.bar}>
            <Pressable accessibilityRole="button" accessibilityLabel={fa.profile.close} onPress={onClose}>
              {({ pressed }) => (
                <View style={[styles.square, pressed ? styles.pressed : null]}>
                  <GradientFill from="#C9A3FF" to="#A66BF0" />
                  <Icon name="back" size={22} color="#fff" strokeWidth={3} />
                </View>
              )}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={fa.profile.edit} onPress={() => setEditing((v) => !v)}>
              {({ pressed }) => (
                <View style={[styles.square, pressed || editing ? styles.pressed : null]}>
                  <GradientFill from="#8FDCFA" to="#3FC1F0" />
                  <Icon name="settings" size={20} color="#fff" strokeWidth={2.6} />
                </View>
              )}
            </Pressable>
          </View>

          <View style={styles.avatarWrap}>
            {me ? <Avatar avatar={avatarOf(me.avatarKey)} size={124} /> : <View style={styles.avatarGap} />}
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
                <Text style={styles.name}>{me.nickname}</Text>
                {badges ? <Text style={styles.rank}>{skillText(badges.skill)}</Text> : null}
                {me.city ? (
                  <Pressable onPress={() => setSub('city')} accessibilityRole="button" style={styles.cityRow}>
                    {province ? <ProvinceBadge province={province} size={26} /> : null}
                    <Text style={styles.rank}>{me.city.nameFa}</Text>
                  </Pressable>
                ) : null}
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
                  <View key={label} style={[styles.stat, { backgroundColor: c }]}>
                    <Text style={styles.statValue}>{n(v)}</Text>
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                ))}
              </View>

              {editing ? (
                <View style={styles.editor}>
                  <Text style={styles.sectionTitle}>{fa.profile.gender}</Text>
                  <Text style={styles.hint}>{fa.profile.genderHint}</Text>
                  <View style={styles.pills}>
                    {options.map(([g, label]) => (
                      <Pressable key={label} onPress={() => pick(g)} style={[styles.pill, me.gender === g && styles.pillOn]} accessibilityRole="button">
                        <Text style={styles.pillText}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <ProfileEditor me={me} onChange={(patch) => setMe((m) => (m ? { ...m, ...patch } : m))} onPickCity={() => setSub('city')} />
                </View>
              ) : null}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{fa.profile.myBadges}</Text>
                {badges && badges.earned.length > 0 ? (
                  <View style={styles.tags}>
                    {badges.earned.map((b, i) => (
                      <View key={b.id} style={[styles.tag, { backgroundColor: TAGS[i % TAGS.length] }]}><Text style={styles.tagText}>{b.titleFa}</Text></View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.hint}>{fa.profile.noBadges}</Text>
                )}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{fa.profile.shortcuts}</Text>
                <CandyButton label={fa.levels.open} color={colors.candy.yellow} onPress={() => setSub('levels')} />
                <CandyButton label={incoming > 0 ? `${fa.profile.friends} (${n(incoming)})` : fa.profile.friends} color={colors.candy.sky} onPress={() => setSub('friends')} />
                <CandyButton label={fa.badges.open} color={colors.candy.grape} onPress={() => setSub('badges')} />
                <CandyButton label={fa.find.open} color={colors.candy.lime} onPress={() => setSub('find')} />
                <CandyButton label={fa.transfers.loansOpen} color={colors.candy.orange} onPress={() => setSub('loans')} />
                <CandyButton label={fa.invite.open} color={colors.candy.lime} onPress={() => setSub('invite')} />
              </View>
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#FBF1DE' },
  page: { paddingBottom: 30 },
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: 210, overflow: 'hidden' },
  heroLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, backgroundColor: colors.ink },
  column: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 30, alignItems: 'center', gap: 10 },
  bar: { alignSelf: 'stretch', flexDirection: ROW, justifyContent: 'space-between' },
  square: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  avatarWrap: { marginTop: 40, alignItems: 'center' },
  avatarGap: { width: 124, height: 124 },
  hex: { position: 'absolute', bottom: -4, right: -34, width: 46, height: 52, alignItems: 'center', justifyContent: 'center' },
  hexText: { position: 'absolute', fontFamily: fonts.display, fontSize: 21, color: '#fff', textShadowColor: '#A86E00', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1, paddingTop: 4 },
  nameBlock: { alignItems: 'center', gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 30, color: colors.ink },
  rank: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.65 },
  cityRow: { flexDirection: ROW, alignItems: 'center', gap: 6, marginTop: 2 },
  levelBlock: { alignSelf: 'stretch', gap: 4 },
  levelHead: { flexDirection: ROW, justifyContent: 'space-between' },
  levelText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  levelXp: { fontFamily: fonts.display, fontSize: 14, color: colors.ink, opacity: 0.6 },
  track: { height: 20, borderRadius: 99, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#E6D3B4', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 99, backgroundColor: '#A66BF0' },
  stats: { alignSelf: 'stretch', flexDirection: ROW, flexWrap: 'wrap', gap: 9 },
  stat: { width: '48%', height: 70, borderRadius: 16, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', ...lift(4) },
  statValue: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  statLabel: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink, opacity: 0.8 },
  editor: { alignSelf: 'stretch', gap: 6, padding: 12, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FFF6E8' },
  section: { alignSelf: 'stretch', gap: 6 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, textAlign: 'right' },
  hint: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, opacity: 0.7, textAlign: 'right' },
  pills: { flexDirection: ROW, gap: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.cream },
  pillOn: { backgroundColor: '#FFC93C' },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  tags: { flexDirection: ROW, flexWrap: 'wrap', gap: 6 },
  tag: { height: 30, paddingHorizontal: 10, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, justifyContent: 'center', ...lift(3) },
  tagText: { fontFamily: fonts.display, fontSize: 14, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 1 },
});
