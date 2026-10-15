import { Platform, StyleSheet, View } from 'react-native';
import { BrassButton } from '../duel/adultKit';
import { bootTheme } from '../theme/bootTheme';
import { colors } from '../theme/colors';
import { SlabButton } from './SlabButton';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const CANDY = { dark: colors.candy.sky, copper: colors.candy.orange, gold: colors.candy.lime } as const;

export type GameAction = { label: string; /** dark = secondary (back / shuffle), copper = undo-ish, gold = the main action. */ tone: 'dark' | 'copper' | 'gold'; onPress: () => void; disabled?: boolean; grow?: number; sfx?: 'confirm' | 'back'; fontSize?: number };

/** A row of game buttons: slab buttons in the play look, brass / copper / bronze plates in the adult look (docs/design/adult/Dozari Adult - Quiz Duel). */
export function GameActions({ items, height = 58 }: { items: GameAction[]; height?: number }) {
  if (bootTheme() === 'adult') {
    return (
      <View style={styles.adult}>
        {items.map((it, i) => (
          <View key={i} style={{ flex: it.grow ?? 1 }}><BrassButton label={it.label} tone={it.tone} height={height - 6} disabled={it.disabled} onPress={it.onPress} /></View>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {items.map((it, i) => (
        <SlabButton key={i} label={it.label} sfx={it.sfx} color={CANDY[it.tone]} height={height} fontSize={it.fontSize ?? 20} grow={it.grow} onPress={it.onPress} disabled={it.disabled} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: ROW, gap: 9 },
  adult: { direction: 'rtl', flexDirection: 'row', gap: 9 },
});
