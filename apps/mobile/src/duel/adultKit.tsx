import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Icon } from '../components/Icon';
import { GradientFill } from '../components/GradientFill';
import { SceneBackground } from '../components/SceneBackground';
import { fonts } from '../theme/colors';

/** Shared pieces of the adult «صرافی و گاوصندوق» question screens (docs/design/adult/Dozari Adult - Quiz Duel). */

/** Vault-room scene under a dark veil, like the design's phones. */
export function AdultBackdrop({ children }: { children?: React.ReactNode }) {
  return (
    <SceneBackground scene="sarafi">
      <GradientFill from="rgba(14,10,8,0.55)" to="rgba(14,10,8,0.95)" mid={{ at: 0.3, color: 'rgba(14,10,8,0.86)' }} />
      {children}
    </SceneBackground>
  );
}

/**
 * A plate: a gradient face with a coloured frame, a black ring around it and a black ledge under it (the design's
 * `0 0 0 2px #000, 0 Npx 0 #000` shadow, drawn with views so it looks the same on every platform).
 */
export function Plate({ radius, border, from = '#2A1E16', to = '#17100C', ledge = 4, frame = 2, height, glow, style, children }: { radius: number; border: string; from?: string; to?: string; ledge?: number; frame?: number; height?: number; /** Soft glow colour (iOS/web); the frame colour carries it elsewhere. */ glow?: string; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  return (
    <View style={[{ backgroundColor: '#000', borderRadius: radius + 2, padding: 2, paddingBottom: 2 + ledge }, glow ? { shadowColor: glow, shadowOpacity: 0.55, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } } : null]}>
      <View style={[{ borderRadius: radius, borderWidth: frame, borderColor: border, overflow: 'hidden', height }, style]}>
        <GradientFill from={from} to={to} />
        {children}
      </View>
    </View>
  );
}

/** Brass square button (back / leave) from the design header. */
export function BrassSquare({ label, onPress, glyph }: { label: string; onPress: () => void; glyph: 'close' | 'back' | 'pause' }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.square, pressed ? styles.pressed : null]}>
      <Plate radius={13} border="#B8822A" from="#5A3A1C" to="#24160A" ledge={3} height={36} style={styles.squareFace}>
        <Icon name={glyph} size={20} color="#FFE9A8" strokeWidth={2.8} />
      </Plate>
    </Pressable>
  );
}


const TONES = {
  gold: { from: '#FFF1B8', to: '#B8822A', text: '#2A1606' },
  copper: { from: '#FFD2B0', to: '#B0552A', text: '#2A1206' },
  dark: { from: '#5A3A1C', to: '#24160A', text: '#FFE9A8' },
} as const;

/** Brass / copper / dark-bronze button with the black ring and ledge (design: «سؤال بعدی», «شروع دوئل»). */
export function BrassButton({ label, onPress, tone = 'gold', height = 48, disabled, children }: { label: string; onPress: () => void; tone?: keyof typeof TONES; height?: number; disabled?: boolean; children?: React.ReactNode }) {
  const c = TONES[tone];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [{ opacity: disabled ? 0.55 : 1 }, pressed ? styles.pressed : null]}>
      <Plate radius={15} border="#000" frame={3} from={c.from} to={c.to} height={height} style={styles.buttonFace}>
        <Text style={[styles.buttonText, { color: c.text }]}>{label}</Text>
        {children}
      </Plate>
    </Pressable>
  );
}

export type AnswerState = 'idle' | 'picked' | 'right' | 'wrong' | 'dim';
const ANSWER = {
  idle: { bd: '#8A5A16', from: '#3A2A1C', to: '#1E1610', fg: '#FFE9A8', tag: '#E8B64A', tagFg: '#2A1606', op: 1 },
  picked: { bd: '#FFD2B0', from: '#5A2E18', to: '#2A140A', fg: '#FFE9A8', tag: '#E0895A', tagFg: '#2A1606', op: 1 },
  right: { bd: '#9FE870', from: '#3E7A22', to: '#22480F', fg: '#F1FFE6', tag: '#9FE870', tagFg: '#0E2A06', op: 1 },
  wrong: { bd: '#E0533F', from: '#6A1E16', to: '#3A0E0A', fg: '#FFD9D2', tag: '#C4302B', tagFg: '#FFFFFF', op: 1 },
  dim: { bd: '#3A2A1C', from: '#17100C', to: '#17100C', fg: 'rgba(255,233,168,0.4)', tag: '#2A1E16', tagFg: 'rgba(255,233,168,0.4)', op: 0.75 },
} as const;

/** One answer row of the quiz screens: letter tag (✓ / ✕ once judged), text, optional «تو» / «حریف» pills. */
export function AnswerRow({ letter, text, state, height = 60, mine, theirs, mineLabel, theirsLabel, onPress, disabled }: { letter: string; text: string; state: AnswerState; height?: number; mine?: boolean; theirs?: boolean; mineLabel?: string; theirsLabel?: string; onPress?: () => void; disabled?: boolean }) {
  const c = ANSWER[state];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={text} disabled={disabled || !onPress} onPress={onPress} style={{ opacity: c.op }}>
      <Plate radius={14} border={c.bd} from={c.from} to={c.to} ledge={state === 'idle' ? 3 : 0} glow={state === 'right' ? '#7ED957' : state === 'picked' ? '#E0895A' : undefined} height={height} style={styles.answer}>
        <View style={[styles.tag, { backgroundColor: c.tag }]}>
          <Text style={[styles.tagText, { color: c.tagFg }]}>{state === 'right' ? '✓' : state === 'wrong' ? '✕' : letter}</Text>
        </View>
        <Text style={[styles.answerText, { color: c.fg }]}>{text}</Text>
        {theirs && theirsLabel ? <Text style={[styles.pill, styles.pillRival]}>{theirsLabel}</Text> : null}
        {mine && mineLabel ? <Text style={[styles.pill, styles.pillMine]}>{mineLabel}</Text> : null}
      </Plate>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttonFace: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 30 },
  answer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8 },
  tag: { width: 30, height: 30, borderRadius: 9, borderWidth: 2, borderColor: '#000', alignItems: 'center', justifyContent: 'center' },
  tagText: { fontFamily: fonts.display, fontSize: 15, lineHeight: 24 },
  answerText: { flex: 1, fontFamily: fonts.bold, fontSize: 16, textAlign: 'right' },
  pill: { height: 22, paddingHorizontal: 8, borderRadius: 99, borderWidth: 1.5, borderColor: '#000', fontFamily: fonts.display, fontSize: 12, lineHeight: 19, overflow: 'hidden' },
  pillRival: { backgroundColor: '#E0895A', color: '#2A1206' },
  pillMine: { backgroundColor: '#E8B64A', color: '#2A1606' },
  square: { width: 44 },
  squareFace: { alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ translateY: 2 }] },
});

