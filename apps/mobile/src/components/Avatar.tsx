import { StyleSheet, View } from 'react-native';
import type { AvatarSpec } from '../kit/data';
import { colors } from '../theme/colors';
import { Character } from './Character';

/** Round avatar (docs/design/Dozari - 09): a face crop of one of the cast (`skin` picks who) over a candy disc, cream ring and ink outline. */
export function Avatar({ avatar, size = 84 }: { avatar: AvatarSpec; size?: number }) {
  const inner = Math.round(size * 0.76);
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatar.base, borderColor: colors.cream },
      ]}
    >
      <View style={[styles.glow, { backgroundColor: avatar.light, width: size * 0.7, height: size * 0.45, borderRadius: size }]} />
      <View style={{ width: inner, height: inner }}>
        <Character pose={avatar.pose} skin={avatar.skin} crop="face" wobble={size >= 70 && undefined} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderBottomWidth: 6, borderBottomColor: colors.ink },
  glow: { position: 'absolute', top: 2, opacity: 0.8 },
});
