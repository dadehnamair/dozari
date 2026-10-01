import { StyleSheet, View } from 'react-native';
import type { AvatarSpec } from '../kit/data';
import { colors } from '../theme/colors';
import { Mascot } from './Mascot';

/** Round avatar: mascot face crop over a candy gradient-ish disc, cream ring and ink outline. */
export function Avatar({ avatar, size = 84, month }: { avatar: AvatarSpec; size?: number; month?: number }) {
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
        <Mascot pose={avatar.pose} skin={avatar.skin} crop="face" month={month} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderBottomWidth: 6, borderBottomColor: colors.ink },
  glow: { position: 'absolute', top: 2, opacity: 0.8 },
});
