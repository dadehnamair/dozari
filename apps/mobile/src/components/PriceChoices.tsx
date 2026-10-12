import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fa } from '../i18n/fa';
import { priceText } from '../solo/priceRound';
import { colors, fonts } from '../theme/colors';
import { useTheme } from '../theme/themeStore';
import { playSfx } from '../sound/engine';
import { GradientFill } from './GradientFill';

/** Slim candy faces for the four choices: a pale tint on top, the tone below, and a thin shelf. */
const TONES = [
  { from: '#E3F6FF', to: '#8FDCFA', shelf: '#1E9AD0' },
  { from: '#EAFBDD', to: '#B8F08F', shelf: '#5DBB3C' },
  { from: '#FFF3C4', to: '#FFD86A', shelf: '#D98A0B' },
  { from: '#FFE3EE', to: '#FF9DBF', shelf: '#D63A72' },
] as const;
const ADULT = { from: '#FFE9A8', to: '#E8B64A', shelf: '#8A5A16' };

/** The four choices of a price question (rials as decimal strings, ascending), as a 2×2 grid: one tap answers. */
export function PriceChoices({ options, onPick, disabled }: { options: readonly string[]; onPick: (rials: bigint) => void; disabled?: boolean }) {
  const adult = useTheme() === 'adult';
  return (
    <View style={styles.grid} accessibilityLabel={fa.solo.price.question}>
      {options.map((o, i) => {
        const tone = adult ? ADULT : TONES[i % TONES.length]!;
        const label = priceText(o); // already ends in the unit («… هزار تومن»)
        return (
          <Pressable
            key={o}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: !!disabled }}
            disabled={disabled}
            onPress={() => (playSfx('confirm'), onPick(BigInt(o)))}
            style={styles.cellWrap}
          >
            {({ pressed }) => (
              <View style={[styles.shelf, { backgroundColor: tone.shelf }]}>
                <View style={[styles.face, { transform: [{ translateY: pressed ? 3 : 0 }] }]}>
                  <GradientFill from={tone.from} to={tone.to} />
                  <View style={styles.light} />
                  <Text style={styles.label} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{label}</Text>
                </View>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cellWrap: { width: '48%', flexGrow: 1 },
  shelf: { borderRadius: 18, paddingBottom: 4 },
  face: { minHeight: 92, borderRadius: 18, borderWidth: 2, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 8 },
  light: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.6)' },
  /** Plain ink on a light face, with no shadow: the old slab's dark text-shadow smeared the digits. */
  label: { fontFamily: fonts.display, fontSize: 22, lineHeight: 34, color: colors.ink, textAlign: 'center' },
});
