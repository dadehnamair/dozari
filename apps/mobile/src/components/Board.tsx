import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GROUP_SIZE } from '@dozari/shared';
import type { SoloCard, SoloSolvedGroup } from '@dozari/shared';
import { colors, groupShelf, tile } from '../theme/colors';
import { fa } from '../i18n/fa';
import { cellWidth } from './boardLayout';
import { Item } from './Item';

const GAP = 8;

interface BoardProps {
  solved: readonly SoloSolvedGroup[];
  cards: readonly SoloCard[];
  names: Readonly<Record<string, string>>;
  selected: readonly string[];
  onToggle: (id: string) => void;
  disabled: boolean;
}

/** Solved rows stack on top (in the order found), the remaining cards fill a 4-wide grid below. */
export function Board({ solved, cards, names, selected, onToggle, disabled }: BoardProps) {
  const [width, setWidth] = useState(0);
  const w = cellWidth(width, GAP, GROUP_SIZE);
  return (
    <View style={styles.board} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {solved.map((g) => (
        <View key={g.level} style={[styles.row, { backgroundColor: colors.group[g.level], borderBottomColor: groupShelf[g.level] }]} accessibilityLabel={g.titleFa}>
          <Text style={styles.rowTitle}>{g.titleFa}</Text>
          <Text style={styles.rowItems}>{g.productIds.map((id) => names[id] ?? id).join('، ')}</Text>
          <Text style={styles.rowWhy}>{g.revealed ? `${fa.solo.revealed} · ` : ''}{g.explanationFa}</Text>
        </View>
      ))}
      <View style={styles.grid}>
        {cards.map((c) => {
          const on = selected.includes(c.id);
          return (
            <Pressable
              key={c.id}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => onToggle(c.id)}
              style={[styles.cell, w > 0 && { width: w, height: Math.round(w * 0.85) }, on && styles.cellOn]}
            >
              {c.iconKey ? (
                <View style={styles.icon}>
                  <Item icon={c.iconKey} />
                </View>
              ) : null}
              <Text style={[styles.name, on && styles.nameOn]} numberOfLines={3}>{c.nameFa}</Text>
              {c.unitFa ? <Text style={[styles.unit, on && styles.nameOn]} numberOfLines={1}>{c.unitFa}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { gap: GAP, width: '100%', maxWidth: 520, alignSelf: 'center' },
  row: { borderRadius: 16, borderWidth: 3, borderColor: colors.ink, borderBottomWidth: 6, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', gap: 2 },
  rowTitle: { fontFamily: 'Vazirmatn_700Bold', fontSize: 16, color: colors.ink },
  rowItems: { fontFamily: 'Vazirmatn_400Regular', fontSize: 14, color: colors.ink, textAlign: 'center' },
  rowWhy: { fontFamily: 'Vazirmatn_400Regular', fontSize: 12, color: colors.ink, opacity: 0.75, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    borderRadius: 14,
    borderWidth: 3,
    borderColor: colors.ink,
    borderBottomWidth: 7,
    borderBottomColor: tile.idle.shelf,
    backgroundColor: tile.idle.face,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  cellOn: { backgroundColor: tile.selected.face, borderBottomColor: tile.selected.shelf, transform: [{ translateY: 2 }, { scale: 0.96 }] },
  icon: { width: 34, height: 34 },
  name: { fontFamily: 'Vazirmatn_700Bold', fontSize: 14, color: tile.idle.text, textAlign: 'center' },
  unit: { fontFamily: 'Vazirmatn_400Regular', fontSize: 11, color: colors.ink, opacity: 0.7, textAlign: 'center' },
  nameOn: { color: tile.selected.text },
});
