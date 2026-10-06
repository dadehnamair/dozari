import { Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { solarMonthOf } from '@dozari/shared';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { Item } from '../components/Item';
import { Scene } from '../components/Scene';
import { SlabButton } from '../components/SlabButton';
import { GameTopBar } from '../game/GameTopBar';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import type { CharacterId, CharacterPose } from '../theme/character';
import { nativeTopInset } from '../theme/safeArea';
import type { ArenaTier, TierId } from './arena';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const a = fa.duel.arena;

/** screen-mode of `13 Match Screens`: the 1v1 card, the 2v2 card, «رقابت با دوست», «بزن بریم!». */
export function ModeSelect({ entry, prize, mode, onMode, onGo, onFriend, onBack, tiers = [], tier = 'bronze', onTier }: { entry: number; prize: number; mode: 'duel' | 'team'; onMode: (m: 'duel' | 'team') => void; onGo: () => void; onFriend?: () => void; onBack: () => void; /** Stake tables on offer (bronze first); the chooser shows when there is more than one. */ tiers?: ArenaTier[]; tier?: TierId; onTier?: (t: TierId) => void }) {
  const picked = tiers.find((x) => x.id === tier);
  const tight = useWindowDimensions().height < 700; // nothing scrolls: shrink the cast on short screens
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}><Scene scene="caravan" mood="dusk" /></View>
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <View style={[styles.scroll, tight ? styles.scrollTight : null]}>
        <View style={[styles.column, tight ? styles.columnTight : null]}>
          <GameTopBar title={a.title} backLabel={fa.duel.back} onBack={onBack} />
          <ModeCard tight={tight} title={a.duel} tag={a.oneVsOne} band="sky" picked={mode === 'duel'} onPress={() => onMode('duel')}
            cast={[{ who: 'dozari', pose: 'coin' }, { who: 'pahlevan', pose: 'angry', flip: true }]}
            stats={[{ icon: 'ticket', text: a.entry(picked?.fee ?? entry) }, { icon: 'coinStack', text: a.prize(picked?.prize ?? prize) }]} />
          {mode === 'duel' && tiers.length > 1 && onTier ? (
            <View style={styles.tierRow}>
              {tiers.map((t) => (
                <Pressable key={t.id} accessibilityRole="button" accessibilityState={{ selected: t.id === tier }} onPress={() => onTier(t.id)} style={[styles.tierChip, t.id === tier ? styles.tierChipOn : null]}>
                  <Text style={styles.tierText}>{a.tierChip(a.tierNames[t.id] ?? t.id, t.fee)}</Text>
                  {t.minLevel > 1 && t.id !== 'bronze' ? <Text style={styles.tierSub}>{a.tierLocked(t.minLevel)}</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.note}>{tier === 'bronze' ? a.freeNote : ''}</Text>
          <ModeCard tight={tight} title={a.team} tag={a.twoVsTwo} band="grape" picked={mode === 'team'} onPress={() => onMode('team')}
            cast={[{ who: 'goli', pose: 'cheer', small: true }, { who: 'dozari', pose: 'wave', small: true }, { who: 'pahlevan', pose: 'pointing', flip: true, small: true }, { who: 'baqal', pose: 'thinking', flip: true, small: true }]}
            stats={[{ icon: 'ticket', text: a.teamNote }]} />
          <View style={styles.spacer} />
          {onFriend ? (
            <Pressable accessibilityRole="button" onPress={onFriend} style={styles.friend}>
              <View style={styles.friendIcon}><Item icon="envelope" /></View>
              <Text style={styles.friendText}>{a.friend}</Text>
            </Pressable>
          ) : null}
          <SlabButton label={a.go} sfx="confirm" color={colors.candy.lime} height={62} grow={0} onPress={onGo} />
        </View>
      </View>
    </View>
  );
}

type Cast = { who: CharacterId; pose: CharacterPose; flip?: boolean; small?: boolean };

function ModeCard({ tight = false, title, tag, band, cast, stats, picked = false, disabled = false, onPress }: { tight?: boolean; title: string; tag: string; band: 'sky' | 'grape'; cast: Cast[]; stats: { icon: string; text: string }[]; picked?: boolean; disabled?: boolean; onPress?: () => void }) {
  const half = cast.length / 2;
  const month = solarMonthOf(Date.now());
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title} ${tag}`} accessibilityState={{ disabled, selected: picked }} disabled={disabled} onPress={onPress}>
      {({ pressed }) => (
        <View style={[styles.card, picked ? styles.cardPicked : null, disabled ? styles.cardOff : null, pressed ? styles.pressed : null]}>
          <GradientFill from={colors.cream} to="#F6E2C2" />
          <View style={styles.band}>
            <GradientFill from={band === 'sky' ? '#8FDCFA' : '#C9A3FF'} to={band === 'sky' ? colors.candy.sky : colors.candy.grape} />
            <Text style={styles.bandTitle}>{title}</Text>
            <View style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
          </View>
          <View style={[styles.stage, tight ? styles.stageTight : null]}>
            {cast.map((c, i) => (
              <View key={`${c.who}${i}`} style={[c.small ? styles.castSmall : styles.cast, tight ? (c.small ? styles.castSmallTight : styles.castTight) : null, c.flip ? styles.flip : null]}>
                <Character who={c.who} pose={c.pose} month={c.who === 'dozari' ? month : undefined} />
              </View>
            )).flatMap((el, i) => (i === half - 1 ? [el, <VsBadge key="vs" />] : [el]))}
          </View>
          <View style={styles.stats}>
            {stats.map((s) => (
              <View key={s.text} style={styles.stat}>
                <View style={styles.statIcon}><Item icon={s.icon} /></View>
                <Text style={styles.statText}>{s.text}</Text>
              </View>
            ))}
          </View>
          {picked ? (
            <View style={styles.check}><Text style={styles.checkText}>✓</Text></View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

export function VsBadge({ size = 44 }: { size?: number }) {
  return (
    <View style={[styles.vs, { width: size, height: size, borderRadius: size / 2 }]}>
      <GradientFill from="#FF8FB6" to={colors.candy.pink} />
      <Text style={[styles.vsText, { fontSize: size * 0.45 }]}>VS</Text>
    </View>
  );
}

const shadow = { shadowColor: colors.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 };

const styles = StyleSheet.create({
  tierRow: { flexDirection: ROW, gap: 8, justifyContent: 'center', marginTop: 6 },
  tierChip: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: colors.cream, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  tierChipOn: { backgroundColor: colors.candy.yellow },
  tierText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  tierSub: { fontFamily: fonts.body, fontSize: 11, color: colors.ink },
  root: { flex: 1, backgroundColor: '#3C1A66' },
  shade: { backgroundColor: 'rgba(43,18,64,0.5)' },
  scrollTight: { paddingTop: 8 + nativeTopInset(), paddingBottom: 10 },
  columnTight: { gap: 8 },
  stageTight: { height: 76 },
  castTight: { width: 62, height: 70 },
  castSmallTight: { width: 46, height: 62 },
  scroll: { flexGrow: 1, paddingHorizontal: 14, paddingTop: 14 + nativeTopInset(), paddingBottom: 20, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 480, gap: 14 },
  card: { borderRadius: 24, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', transform: [{ scale: 0.96 }], ...shadow },
  cardPicked: { transform: [{ scale: 1 }], shadowColor: colors.candy.yellow, shadowOffset: { width: 0, height: 0 }, shadowRadius: 18, shadowOpacity: 0.8 },
  cardOff: { opacity: 0.7 },
  pressed: { transform: [{ translateY: 3 }] },
  band: { height: 40, flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderBottomWidth: 3, borderColor: colors.ink, overflow: 'hidden' },
  bandTitle: { fontFamily: fonts.display, fontSize: 22, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  tag: { paddingHorizontal: 10, paddingVertical: 1, borderRadius: 99, backgroundColor: colors.ink },
  tagText: { fontFamily: fonts.display, fontSize: 15, color: colors.candy.yellow },
  stage: { height: 112, flexDirection: ROW, alignItems: 'flex-end', justifyContent: 'center', paddingTop: 6 },
  cast: { width: 90, height: 104 },
  castSmall: { width: 64, height: 88, marginHorizontal: -6 },
  flip: { transform: [{ scaleX: -1 }] },
  stats: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-around', gap: 6, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, borderTopWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(43,18,64,0.25)' },
  stat: { flexDirection: ROW, alignItems: 'center', gap: 4 },
  statIcon: { width: 22, height: 22 },
  statText: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  check: { position: 'absolute', top: 50, left: 10, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.candy.lime, borderWidth: 3, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  checkText: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: '#fff' },
  vs: { alignSelf: 'center', borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], zIndex: 1 },
  vsText: { fontFamily: fonts.display, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  note: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream, textAlign: 'center', marginTop: -6, opacity: 0.85 },
  spacer: { flex: 1, minHeight: 8 },
  friend: { alignSelf: 'center', height: 40, paddingHorizontal: 16, borderRadius: 99, borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(43,18,64,0.6)', flexDirection: ROW, alignItems: 'center', gap: 6 },
  friendIcon: { width: 24, height: 24 },
  friendText: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream },
});
