import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import { solarMonthOf, toPersianDigits } from '@dozari/shared';
import type { MatchPlayerProfile } from '@dozari/shared';
import { Character } from '../components/Character';
import { GradientFill } from '../components/GradientFill';
import { SlabButton } from '../components/SlabButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { characterFor } from './arena';
import { steppedSec } from '../search/scan';

const a = fa.duel.arena;
const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);

/**
 * screen-versus of `13 Match Screens`: blue half for the player, pink half for the rival, a gold VS coin on the seam.
 * While searching the rival is a «؟» and the bottom slab cancels; once found it counts down to the board.
 */
export function Versus({ me, rival, mate, rivals, waitedSec, countdown, onCancel }: { me: { nickname: string; level?: number }; rival: MatchPlayerProfile | null; /** 2v2: the teammate and both rivals (all four seats are shown). */ mate?: MatchPlayerProfile | null; rivals?: readonly MatchPlayerProfile[]; waitedSec: number; countdown: number | null; onCancel: () => void }) {
  const team = mate !== undefined;
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <Pattern id="vsb" width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
            <Rect width={2} height={4} fill="#fff" fillOpacity={0.07} />
          </Pattern>
          <RadialGradient id="vsg1" cx="50%" cy="22%" r="45%">
            <Stop offset="0" stopColor="#8FDCFA" stopOpacity={0.7} />
            <Stop offset="1" stopColor="#8FDCFA" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="vsg2" cx="50%" cy="78%" r="45%">
            <Stop offset="0" stopColor="#FF8FB6" stopOpacity={0.7} />
            <Stop offset="1" stopColor="#FF8FB6" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Polygon points="0,0 100,0 100,44 0,56" fill="#2A8CC8" />
        <Polygon points="0,0 100,0 100,44 0,56" fill="url(#vsg1)" />
        <Polygon points="0,56 100,44 100,100 0,100" fill="#C8306E" />
        <Polygon points="0,56 100,44 100,100 0,100" fill="url(#vsg2)" />
        <Rect width={100} height={100} fill="url(#vsb)" />
        <Line x1={-2} y1={56.2} x2={102} y2={43.8} stroke={colors.ink} strokeWidth={1.4} />
        <Line x1={-2} y1={56.2} x2={102} y2={43.8} stroke={colors.candy.yellow} strokeWidth={0.6} />
      </Svg>

      <View style={styles.top}>
        <View style={styles.chip}><Text style={styles.chipText}>{rival ? a.found : fa.duel.searching}</Text></View>
        <View style={styles.pairRow}>
          <Fighter who="dozari" pose="coin" name={me.nickname || a.you} level={me.level} side="me" small={team} />
          {team && mate ? <Fighter who={characterFor(mate.avatarKey || mate.nickname)} pose="wave" name={mate.nickname} level={mate.level} side="me" small party={mate.birthday} /> : null}
        </View>
      </View>

      <View style={styles.coinWrap} pointerEvents="none">
        <View style={styles.coin}>
          <GradientFill from="#FFF4B0" to="#D98A0B" mid={{ at: 0.55, color: colors.candy.yellow }} />
          <Text style={styles.coinText}>VS</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        {team && rivals && rivals.length > 0 ? (
          <View style={styles.pairRow}>
            {rivals.map((r) => <Fighter key={r.userId ?? r.nickname} who={characterFor(r.avatarKey || r.nickname)} pose="angry" name={r.nickname} level={r.level} side="rival" small party={r.birthday} />)}
          </View>
        ) : rival ? (
          <Fighter who={characterFor(rival.avatarKey || rival.nickname)} pose="angry" name={rival.nickname} level={rival.level} side="rival" party={rival.birthday} />
        ) : (
          <View style={styles.mystery}><Text style={styles.mysteryText}>{a.unknown}</Text></View>
        )}
      </View>

      <View style={styles.footer}>
        {rival ? (
          <View style={styles.count}>
            <Text style={styles.countLabel}>{a.startsIn}</Text>
            <View style={styles.countBall}>
              <GradientFill from="#FFE48A" to={colors.candy.yellow} />
              <Text style={styles.countNum}>{toPersianDigits(String(countdown ?? 0))}</Text>
            </View>
            <Text style={styles.countLabel}>{a.secondsMore}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.waited}>{fa.duel.waited(steppedSec(waitedSec))}</Text>
            <SlabButton label={fa.duel.cancel} sfx="back" color={colors.candy.orange} height={58} fontSize={22} grow={0} onPress={onCancel} />
          </>
        )}
      </View>
    </View>
  );
}

function Fighter({ who, pose, name, level, side, small = false, party = false }: { who: 'dozari' | ReturnType<typeof characterFor>; pose: 'coin' | 'angry' | 'wave'; name: string; level?: number; side: 'me' | 'rival'; small?: boolean; party?: boolean }) {
  return (
    <View style={styles.fighter}>
      <View style={[styles.body, small ? styles.bodySmall : null, side === 'rival' ? styles.flip : null]}>
        <Character who={who} pose={pose} month={who === 'dozari' ? solarMonthOf(Date.now()) : undefined} />
      </View>
      <View style={styles.plate}>
        {level ? <View style={[styles.lv, { backgroundColor: side === 'me' ? colors.candy.sky : colors.candy.pink }]}><Text style={styles.lvText}>{a.level(level)}</Text></View> : null}
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {party ? <Text accessibilityLabel={fa.birthday.badge}>🎂</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, overflow: 'hidden' },
  top: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingTop: 24, paddingBottom: 70, gap: 10 },
  bottom: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 60 },
  chip: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 99, backgroundColor: 'rgba(43,18,64,0.7)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  chipText: { fontFamily: fonts.display, fontSize: 16, color: colors.cream },
  coinWrap: { position: 'absolute', left: 0, right: 0, top: '50%', marginTop: -52, alignItems: 'center' },
  coin: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: colors.ink, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 1, shadowRadius: 0, elevation: 6 },
  coinText: { fontFamily: fonts.display, fontSize: 44, lineHeight: 60, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 1 },
  fighter: { alignItems: 'center', gap: 4 },
  body: { width: 120, height: 139 },
  bodySmall: { width: 86, height: 100 },
  pairRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  plate: { flexDirection: ROW, alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12, backgroundColor: colors.cream, borderWidth: 3, borderColor: colors.ink, shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4, maxWidth: 160 },
  lv: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  lvText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 20, color: '#fff' },
  name: { fontFamily: fonts.display, fontSize: 17, color: colors.ink, flexShrink: 1 },
  mystery: { width: 110, height: 110, borderRadius: 55, borderWidth: 4, borderColor: colors.ink, backgroundColor: 'rgba(43,18,64,0.35)', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  mysteryText: { fontFamily: fonts.display, fontSize: 60, lineHeight: 84, color: colors.cream },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingBottom: 28, gap: 8, alignItems: 'stretch', width: '100%', maxWidth: 480, alignSelf: 'center' },
  waited: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center' },
  count: { height: 62, borderRadius: 20, backgroundColor: 'rgba(43,18,64,0.75)', borderWidth: 3, borderColor: colors.ink, flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 12 },
  countLabel: { fontFamily: fonts.bold, fontSize: 14, color: colors.cream },
  countBall: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  countNum: { fontFamily: fonts.display, fontSize: 26, lineHeight: 36, color: colors.ink },
});
