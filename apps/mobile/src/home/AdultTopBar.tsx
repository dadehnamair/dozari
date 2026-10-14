import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Character } from '../components/Character';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { ICON_PATHS } from '../theme/icons';
import { fonts } from '../theme/colors';
import type { CharacterId } from '../theme/character';

const RTL_ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const GOLD = ['#FFF1B8', '#E8B64A', '#B8822A'] as const;

interface Props {
  coins: string | null;
  gems: string | null;
  streak: string | null;
  level: string | null;
  xpFrac: number;
  who: CharacterId;
  /** Number of spins waiting on the wheel (`!` = a free daily spin). */
  spinBadge: string | null;
  labels: { coins: string; gems: string; streak: string; level: string; map: string; wheel: string; streakUnit: string };
  onCoins: () => void;
  onGems: () => void;
  onStreak: () => void;
  onMap: () => void;
  onWheel: () => void;
  onProfile: () => void;
}

/** The adult home's top bar (docs/design/adult/Dozari Adult - Login Home.dc.html): a wallet plate and a map · wheel · level · avatar plate. */
export function AdultTopBar({ coins, gems, streak, level, xpFrac, who, spinBadge, labels, onCoins, onGems, onStreak, onMap, onWheel, onProfile }: Props) {
  return (
    <View style={s.row}>
      <Plate style={s.wallet}>
        <Pressable onPress={onCoins} accessibilityRole="button" accessibilityLabel={labels.coins} style={s.coinRow}>
          <View style={s.coin}><Item icon="coin" /></View>
          <Text style={s.coins} numberOfLines={1}>{coins ?? '۰'}</Text>
          <View style={s.plus}><Svg width={9} height={9} viewBox="0 0 12 12"><Path d="M6 2v8M2 6h8" stroke="#2A1606" strokeWidth={2.2} strokeLinecap="round" /></Svg></View>
        </Pressable>
        <View style={s.rule} />
        <View style={s.subRow}>
          {gems ? (
            <Pressable onPress={onGems} accessibilityRole="button" accessibilityLabel={labels.gems} style={s.sub}>
              <Text style={s.gem}>💎</Text>
              <Text style={s.subText}>{gems}</Text>
            </Pressable>
          ) : null}
          {gems && streak ? <View style={s.dot} /> : null}
          {streak ? (
            <Pressable onPress={onStreak} accessibilityRole="button" accessibilityLabel={`${streak} ${labels.streakUnit}`} style={s.sub}>
              <Svg width={14} height={14} viewBox="0 0 24 24"><Path d={ICON_PATHS.flame} fill="#E0603A" stroke="#000" strokeWidth={2.4} strokeLinejoin="round" /></Svg>
              <Text style={s.subText}>{`${streak} ${labels.streakUnit}`}</Text>
            </Pressable>
          ) : null}
        </View>
      </Plate>
      <Plate style={s.profile}>
        <View style={s.tools}>
          <Pressable onPress={onMap} accessibilityRole="button" accessibilityLabel={labels.map} style={s.tool}><View style={s.map}><Item icon="map" /></View></Pressable>
          <Pressable onPress={onWheel} accessibilityRole="button" accessibilityLabel={labels.wheel} style={s.tool}>
            <Icon name="wheel" size={19} color="#FFE9A8" strokeWidth={2.4} />
            {spinBadge ? <View style={s.spin}><Text style={s.spinText}>{spinBadge}</Text></View> : null}
          </Pressable>
        </View>
        <Pressable onPress={onProfile} accessibilityRole="button" accessibilityLabel={`${labels.level} ${level ?? ''}`} style={s.levelBox}>
          <Text style={s.levelText} numberOfLines={1}>{level ? `${labels.level} ${level}` : labels.level}</Text>
          <View style={s.bar}><View style={[s.fill, { width: `${Math.round(xpFrac * 100)}%` }]} /></View>
        </Pressable>
        <Pressable onPress={onProfile} accessibilityRole="button" style={s.avatarWrap}>
          <View style={s.avatarRing}>
            <View style={s.avatarIn}><Character who={who} crop="face" /></View>
          </View>
          <View style={s.crown}><Svg width={10} height={10} viewBox="0 0 24 24"><Path d={ICON_PATHS.crown} fill="none" stroke="#2A1606" strokeWidth={3} strokeLinejoin="round" /></Svg></View>
        </Pressable>
      </Plate>
    </View>
  );
}

function Plate({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.plate, style]}>{children}</View>;
}

const s = StyleSheet.create({
  row: { flexDirection: RTL_ROW, gap: 10, paddingHorizontal: 0, paddingBottom: 4 },
  plate: { flex: 1, minWidth: 0, height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: '#B8822A', backgroundColor: 'rgba(20,13,8,0.9)', overflow: 'hidden', borderBottomWidth: 3 },
  wallet: { paddingVertical: 5, paddingLeft: 9, paddingRight: 6, justifyContent: 'center', gap: 2 },
  coinRow: { flexDirection: RTL_ROW, alignItems: 'center', gap: 5 },
  coin: { width: 22, height: 22 },
  coins: { flex: 1, fontFamily: fonts.display, fontSize: 18, lineHeight: 22, color: '#FFE9A8', textAlign: 'left' },
  plus: { width: 18, height: 18, borderRadius: 6, borderWidth: 1.5, borderColor: '#000', backgroundColor: GOLD[1], alignItems: 'center', justifyContent: 'center' },
  rule: { height: 1, backgroundColor: 'rgba(232,182,74,0.3)' },
  subRow: { flexDirection: RTL_ROW, alignItems: 'center', gap: 8, paddingHorizontal: 2 },
  sub: { flexDirection: RTL_ROW, alignItems: 'center', gap: 3 },
  gem: { fontSize: 12, lineHeight: 15, includeFontPadding: false },
  subText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 16, color: 'rgba(255,233,168,0.9)' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(232,182,74,0.5)' },
  profile: { flexDirection: RTL_ROW, alignItems: 'center', paddingHorizontal: 6, gap: 7 },
  tools: { gap: 4 },
  tool: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  map: { width: 20, height: 20 },
  spin: { position: 'absolute', top: -5, right: -5, minWidth: 13, height: 13, borderRadius: 7, paddingHorizontal: 2, backgroundColor: '#C4302B', borderWidth: 1.5, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  spinText: { fontFamily: fonts.display, fontSize: 9, lineHeight: 11, color: '#fff' },
  levelBox: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 4 },
  levelText: { fontFamily: fonts.display, fontSize: 13, lineHeight: 16, color: '#FFE9A8' },
  bar: { width: '100%', maxWidth: 58, height: 5, borderRadius: 3, backgroundColor: '#0A0604', borderWidth: 1, borderColor: 'rgba(232,182,74,0.35)', overflow: 'hidden', direction: 'ltr' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: GOLD[1] },
  avatarWrap: { width: 44, height: 44 },
  avatarRing: { width: 44, height: 44, borderRadius: 22, padding: 2, backgroundColor: GOLD[1], borderWidth: 1.5, borderColor: '#000' },
  avatarIn: { flex: 1, borderRadius: 20, overflow: 'hidden', backgroundColor: '#140C06', borderWidth: 1.5, borderColor: '#000' },
  crown: { position: 'absolute', bottom: -3, left: -3, width: 17, height: 17, borderRadius: 9, backgroundColor: GOLD[1], borderWidth: 1.5, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
});
