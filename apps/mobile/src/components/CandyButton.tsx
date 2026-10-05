import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, toneOf } from '../theme/colors';
import { GradientFill } from './GradientFill';
import { playSfx } from '../sound/engine';
import type { Sfx } from '../sound/engine';

interface Props {
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
  /** Click sound; `press` is the normal one, `back` for going back, `confirm` for the main action. */
  sfx?: Sfx;
}

const SHELF = 6;
const DISABLED = { light: '#B8AFC4', base: '#8E83A0', border: '#5C4A70', text: '#E8E2EF' };

/** btn-* of docs/design/Dozari - 07 UI Components: ink-outlined candy face, light top edge, ink shelf, presses 5px. */
export function CandyButton({
  label,
  onPress,
  color = colors.candy.pink,
  disabled = false,
  sfx = 'press',
}: Props) {
  const tone = toneOf(color);
  const face = disabled
    ? { from: DISABLED.light, to: DISABLED.base }
    : { from: tone.light, to: tone.base };
  const border = disabled ? DISABLED.border : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => (playSfx(sfx), onPress())}
    >
      {({ pressed }) => (
        <View style={styles.wrap}>
          <View style={[styles.shelf, { backgroundColor: border }]} />
          <View
            style={[
              styles.face,
              { borderColor: border, transform: [{ translateY: pressed ? SHELF - 1 : 0 }] },
            ]}
          >
            <GradientFill from={face.from} to={face.to} mid={{ at: 0.6, color: face.to }} />
            <View style={styles.topLight} />
            {pressed || disabled ? null : <View style={styles.bottomShade} />}
            <Text style={[styles.label, disabled ? styles.labelOff : null]}>{label}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 120, paddingBottom: SHELF },
  shelf: { position: 'absolute', left: 0, right: 0, top: SHELF, bottom: 0, borderRadius: 20 },
  face: {
    height: 54,
    paddingHorizontal: 22,
    borderRadius: 20,
    borderWidth: 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topLight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  bottomShade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  label: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: '#fff',
    textShadowColor: colors.ink,
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 0,
  },
  labelOff: { color: DISABLED.text, textShadowColor: 'transparent' },
});
