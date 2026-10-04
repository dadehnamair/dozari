import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, toneOf } from '../theme/colors';
import type { IconName } from '../theme/icons';
import { GradientFill } from './GradientFill';
import { Icon } from './Icon';

interface Props {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  /** `round` is the btn-icon of the kit, `square` the one with a badge. */
  shape?: 'round' | 'square';
  badge?: string;
  size?: number;
}

const SHELF = 6;

/** btn-icon / badge of docs/design/Dozari - 07 UI Components. */
export function IconButton({
  icon,
  onPress,
  label,
  color = colors.candy.sky,
  shape = 'round',
  badge,
  size = 56,
}: Props) {
  const tone = toneOf(color);
  const radius = shape === 'round' ? size / 2 : 20;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
      {({ pressed }) => (
        <View style={{ width: size, paddingBottom: SHELF }}>
          <View style={[styles.shelf, { borderRadius: radius }]} />
          <View
            style={[
              styles.face,
              {
                width: size,
                height: size,
                borderRadius: radius,
                transform: [{ translateY: pressed ? SHELF - 1 : 0 }],
              },
            ]}
          >
            <GradientFill from={tone.light} to={tone.base} />
            <View style={styles.topLight} />
            <Icon name={icon} size={size * 0.5} color="#fff" strokeWidth={2.6} />
          </View>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shelf: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: SHELF,
    bottom: 0,
    backgroundColor: colors.ink,
  },
  face: {
    borderWidth: 3,
    borderColor: colors.ink,
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
  badge: {
    position: 'absolute',
    top: -8,
    left: -8,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 5,
    borderRadius: 99,
    backgroundColor: colors.candy.lime,
    borderWidth: 3,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.display, fontSize: 14, lineHeight: 22, color: '#fff' },
});
