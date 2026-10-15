import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { provinceOf, toPersianDigits } from '@dozari/shared';
import type { MyProfile } from '@dozari/shared';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { fonts } from '../theme/colors';
import { TEXT_RIGHT } from '../theme/direction';
import { avatarOf } from './avatarOf';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));

type Worn = { slot: string; iconKey: string | null }[];

/** Gold-framed dark panel of the adult look (docs/design/adult/Dozari Adult - Workshop.dc.html). */
export function GoldCard({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.card, style]}>{children}</View>;
}

/** Round gold-ringed face of the player's character. */
export function AdultAvatar({ me, size, worn }: { me: MyProfile; size: number; worn?: Worn }) {
  const a = avatarOf(me.avatarKey);
  const inner = size - 6;
  return (
    <View style={[s.ring, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[s.ringIn, { borderRadius: inner / 2 }]}>
        <View style={{ width: inner - 6, height: inner - 6 }}><Character who={a.who} skin={a.skin} pose={a.pose} crop="face" worn={worn} /></View>
      </View>
    </View>
  );
}

/** Games · wins · losses · draws in one framed strip. */
export function AdultStats({ me }: { me: MyProfile }) {
  return <StatStrip rows={[[fa.profile.statGames, me.stats.games, '#FFE9A8'], [fa.profile.statWins, me.stats.wins, '#9BE36A'], [fa.profile.statLosses, me.stats.losses, '#F08A80'], [fa.profile.statDraws, me.stats.draws, '#DDE4EF']]} />;
}

/** A framed strip of label · number cells. */
export function StatStrip({ rows }: { rows: readonly (readonly [string, number, string])[] }) {
  return (
    <View style={s.stats}>
      {rows.map(([label, v, c], i) => (
        <View key={label} style={[s.stat, i > 0 ? s.statSep : null]}>
          <Text style={[s.statValue, { color: c }]}>{n(v)}</Text>
          <Text style={s.statLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** The workshop's summary card: avatar with a level pill, name, tribe, XP bar, stats and a gold «my profile» button. */
export function WorkshopProfileCard({ me, worn, onOpen }: { me: MyProfile; worn?: Worn; onOpen: () => void }) {
  const lv = me.level;
  const pct = lv.xpForNext === 0 ? 100 : Math.round((lv.xpInLevel / lv.xpForNext) * 100);
  const province = provinceOf(me.city?.province);
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={fa.settings.profile}>
      <GoldCard style={s.workshopCard}>
        <View style={s.topRow}>
          <View style={s.avatarBox}>
            <AdultAvatar me={me} size={68} worn={worn} />
            <View style={s.levelPill}><Text style={s.levelPillText}>{`${fa.profile.level} ${n(lv.level)}`}</Text></View>
          </View>
          <View style={s.info}>
            <Text style={s.name} numberOfLines={1}>{me.nickname}</Text>
            {me.city ? (
              <View style={s.chip}>
                {province ? <View style={s.chipIcon}><Item icon="map" /></View> : null}
                <Text style={s.chipText} numberOfLines={1}>{`${fa.profile.city}: ${me.city.nameFa}`}</Text>
              </View>
            ) : null}
            <View style={s.bar}><View style={[s.fill, { width: `${pct}%` }]} /></View>
            <Text style={s.xp}>{lv.xpForNext === 0 ? `${n(lv.xp)} ${fa.profile.xp}` : fa.profile.xpToNext(lv.xpInLevel, lv.xpForNext, lv.level + 1)}</Text>
          </View>
        </View>
        <AdultStats me={me} />
        <View style={s.cta}>
          <GradientFill from="#FFF1B8" to="#8A5A16" mid={{ at: 0.38, color: '#E8B64A' }} />
          <Text style={s.ctaText}>{fa.settings.profile}</Text>
          <Svg width={18} height={18} viewBox="0 0 24 24"><Path d="M15 5l-7 7 7 7" fill="none" stroke="#2A1606" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </View>
      </GoldCard>
    </Pressable>
  );
}

/** The profile page's header card: big avatar, name with an edit pill, tribe · level and the stats. */
export function ProfileHeroCard({ me, worn, skillLabel, ageLabel, onEdit, onCity }: { me: MyProfile; worn?: Worn; skillLabel?: string; ageLabel?: string; onEdit: () => void; onCity: () => void }) {
  const lv = me.level;
  const pct = lv.xpForNext === 0 ? 100 : Math.round((lv.xpInLevel / lv.xpForNext) * 100);
  const sub = [me.city ? `${fa.profile.city}: ${me.city.nameFa}` : null, `${fa.profile.level} ${n(lv.level)}`, skillLabel, ageLabel].filter(Boolean).join(' · ');
  return (
    <GoldCard style={s.heroCard}>
      <AdultAvatar me={me} size={96} worn={worn} />
      <View style={s.nameRow}>
        <Text style={s.heroName} numberOfLines={1}>{me.nickname}</Text>
        <Pressable onPress={onEdit} accessibilityRole="button" style={s.edit}><Text style={s.editText}>{fa.profile.edit}</Text></Pressable>
      </View>
      <Pressable onPress={onCity} accessibilityRole="button"><Text style={s.heroSub}>{sub}</Text></Pressable>
      <View style={[s.bar, s.barWide]}><View style={[s.fill, { width: `${pct}%` }]} /></View>
      <Text style={s.xp}>{lv.xpForNext === 0 ? `${n(lv.xp)} ${fa.profile.xp}` : fa.profile.xpToNext(lv.xpInLevel, lv.xpForNext, lv.level + 1)}</Text>
      <AdultStats me={me} />
    </GoldCard>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 3, borderColor: '#E8B64A', backgroundColor: '#17100C', overflow: 'hidden', borderBottomWidth: 5 },
  workshopCard: { padding: 12, gap: 10 },
  heroCard: { padding: 14, gap: 8, alignItems: 'center' },
  topRow: { flexDirection: ROW, alignItems: 'center', gap: 12 },
  avatarBox: { width: 68, height: 74 },
  ring: { padding: 3, backgroundColor: '#E8B64A', borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  ringIn: { flex: 1, width: '100%', overflow: 'hidden', backgroundColor: '#140C06', borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  levelPill: { position: 'absolute', bottom: 0, alignSelf: 'center', minWidth: 52, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: '#E8B64A', borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  levelPillText: { fontFamily: fonts.display, fontSize: 12, lineHeight: 16, color: '#2A1606' },
  info: { flex: 1, minWidth: 0, gap: 5, alignItems: 'flex-start' },
  name: { fontFamily: fonts.display, fontSize: 23, lineHeight: 28, color: '#FFE9A8', textAlign: TEXT_RIGHT, maxWidth: '100%' },
  chip: { flexDirection: ROW, alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99, backgroundColor: '#0E0A08', borderWidth: 1.5, borderColor: '#8A5A16' },
  chipIcon: { width: 14, height: 14 },
  chipText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 16, color: '#E8B64A' },
  bar: { alignSelf: 'stretch', height: 7, borderRadius: 4, backgroundColor: '#0A0604', borderWidth: 1, borderColor: 'rgba(232,182,74,0.4)', overflow: 'hidden', direction: 'ltr' },
  barWide: { width: '100%' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#E8B64A' },
  xp: { fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 14, color: 'rgba(255,233,168,0.7)', textAlign: TEXT_RIGHT },
  stats: { alignSelf: 'stretch', flexDirection: ROW, borderRadius: 14, backgroundColor: 'rgba(10,6,4,0.7)', borderWidth: 1.5, borderColor: 'rgba(232,182,74,0.35)' },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  statSep: { borderStartWidth: 1.5, borderStartColor: 'rgba(232,182,74,0.25)' },
  statValue: { fontFamily: fonts.display, fontSize: 18, lineHeight: 22 },
  statLabel: { fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 14, color: 'rgba(255,233,168,0.65)' },
  cta: { height: 46, borderRadius: 14, borderWidth: 3, borderColor: '#000', overflow: 'hidden', flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: '#2A1606' },
  nameRow: { flexDirection: ROW, alignItems: 'center', gap: 8 },
  heroName: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, color: '#FFE9A8', maxWidth: 220 },
  edit: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 99, borderWidth: 1.5, borderColor: '#B8822A', backgroundColor: '#0E0A08' },
  editText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 18, color: '#E8B64A' },
  heroSub: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 18, color: '#E8B64A', textAlign: 'center' },
});
