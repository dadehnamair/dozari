import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { GradientFill } from '../components/GradientFill';
import { SceneBackground } from '../components/SceneBackground';

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
export function BrassSquare({ label, onPress, glyph }: { label: string; onPress: () => void; glyph: 'close' | 'back' }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.square, pressed ? styles.pressed : null]}>
      <Plate radius={13} border="#B8822A" from="#5A3A1C" to="#24160A" ledge={3} height={36} style={styles.squareFace}>
        <Svg width={18} height={18} viewBox="0 0 24 24">
          <Path d={glyph === 'close' ? 'M6 6l12 12M18 6L6 18' : 'M9 5l7 7-7 7'} fill="none" stroke="#FFE9A8" strokeWidth={2.7} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Plate>
    </Pressable>
  );
}


const styles = StyleSheet.create({
  square: { width: 44 },
  squareFace: { alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ translateY: 2 }] },
});

