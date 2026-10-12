import { StyleSheet, View } from 'react-native';
import { fa } from '../i18n/fa';
import { priceText } from '../solo/priceRound';
import { colors } from '../theme/colors';
import { SlabButton } from './SlabButton';

const TONES = [colors.candy.sky, colors.candy.lime, colors.candy.yellow, colors.candy.pink] as const;

/** The four choices of a price question (rials as decimal strings, ascending): one tap answers. */
export function PriceChoices({ options, onPick, disabled }: { options: readonly string[]; onPick: (rials: bigint) => void; disabled?: boolean }) {
  return (
    <View style={styles.column} accessibilityLabel={fa.solo.price.question}>
      {options.map((o, i) => (
        <SlabButton key={o} label={`${priceText(o)} ${fa.solo.price.unit}`} sfx="confirm" color={TONES[i % TONES.length]!} height={52} fontSize={20} onPress={() => onPick(BigInt(o))} disabled={disabled} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignSelf: 'stretch', gap: 8 },
});
