import { StyleSheet, View } from 'react-native';
import type { AvatarSpec } from '../kit/data';
import { colors } from '../theme/colors';
import { Character } from './Character';
import { Item } from './Item';

/** Round avatar (docs/design/Dozari - 09): a face crop of one of the cast (`skin` picks who) over a candy disc, cream ring and ink outline. */
export function Avatar({ avatar, size = 84, worn }: { avatar: AvatarSpec; size?: number; worn?: readonly { slot: string; iconKey: string | null }[] }) {
  const inner = Math.round(size * 0.76);
  const piece = Math.round(size * 0.42);
  const at = (slot: string) => worn?.find((w) => w.slot === slot && w.iconKey)?.iconKey ?? null;
  const hat = at('hat');
  const outfit = at('outfit');
  const accessory = at('accessory');
  return (
    <View style={{ width: size, height: size }}>
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
      {/* Worn cosmetics (D165): a hat on top, clothing and an accessory at the bottom corners. */}
      {hat ? <View style={[styles.piece, { width: piece, height: piece, top: -piece * 0.42, left: (size - piece) / 2 }]} pointerEvents="none"><Item icon={hat} /></View> : null}
      {outfit ? <View style={[styles.piece, { width: piece, height: piece, bottom: -piece * 0.2, left: -piece * 0.1 }]} pointerEvents="none"><Item icon={outfit} /></View> : null}
      {accessory ? <View style={[styles.piece, { width: piece, height: piece, bottom: -piece * 0.2, right: -piece * 0.1 }]} pointerEvents="none"><Item icon={accessory} /></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  disc: { borderWidth: 4, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderBottomWidth: 6, borderBottomColor: colors.ink },
  piece: { position: 'absolute' },
  glow: { position: 'absolute', top: 2, opacity: 0.8 },
});
