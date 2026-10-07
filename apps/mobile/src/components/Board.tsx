import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GROUP_SIZE } from '@dozari/shared';
import type { SoloCard, SoloSolvedGroup } from '@dozari/shared';
import { colors, groupShelf, tile } from '../theme/colors';
import { fa } from '../i18n/fa';
import { NAME_FLOOR, cardMetrics, cellWidth } from './boardLayout';
import { playSfx } from '../sound/engine';
import { Item } from './Item';

const GAP = 8;

interface BoardProps {
  solved: readonly SoloSolvedGroup[];
  cards: readonly SoloCard[];
  names: Readonly<Record<string, string>>;
  selected: readonly string[];
  onToggle: (id: string) => void;
  disabled: boolean;
  /** Cards a paid hint pointed at; drawn with a gold frame. */
  hinted?: readonly string[];
  /** Cards softly lit by the idle nudge (a gentle pulse, not the hard frame of a paid hint). */
  nudged?: readonly string[];
  /** Opponent's turn: cards are drawn desaturated so the turn reads at a glance. */
  muted?: boolean;
}

/** Solved rows stack on top (in the order found), the remaining cards fill a 4-wide grid below. */
export function Board({ solved, cards, names, selected, onToggle, disabled, hinted = [], nudged = [], muted = false }: BoardProps) {
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
          const m = cardMetrics(w);
          return (
            <Pressable
              key={c.id}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              onPress={() => (playSfx(on ? 'deselect' : 'select'), onToggle(c.id))}
              style={[styles.cell, w > 0 && { width: w, height: m.height }, on && styles.cellOn, hinted.includes(c.id) && styles.cellHint, nudged.includes(c.id) && !on && styles.cellNudge, muted && (on ? styles.cellMutedOn : styles.cellMuted)]}
            >
              {c.iconKey ? (
                <View style={{ width: m.icon, height: m.icon }}>
                  <Item icon={c.iconKey} />
                </View>
              ) : null}
              <Text style={[styles.name, { fontSize: m.nameSize }, on && styles.nameOn]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={NAME_FLOOR / m.nameSize}>{c.nameFa}</Text>
              {c.unitFa ? <Text style={[styles.unit, { fontSize: m.unitSize }, on && styles.nameOn]} numberOfLines={1}>{c.unitFa}</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** A selection shown while it is the other side's turn keeps its purple face and white text (the grey look would put white on grey). */
  cellMutedOn: { opacity: 0.85 },
  cellMuted: { backgroundColor: '#D9D9DE', borderBottomColor: '#B5B5BC', opacity: 0.7 },
  cellNudge: { backgroundColor: '#FFF3C4', borderColor: 'rgba(255,201,60,0.8)', borderWidth: 3 },
  cellHint: { borderColor: '#FFC93C', borderWidth: 4 },
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
    padding: 4,
    overflow: 'hidden',
  },
  cellOn: { backgroundColor: tile.selected.face, borderColor: '#E8D5FF', borderBottomColor: tile.selected.shelf, transform: [{ translateY: 2 }, { scale: 0.96 }] },
  name: { fontFamily: 'Vazirmatn_700Bold', fontSize: 14, color: tile.idle.text, textAlign: 'center' },
  unit: { fontFamily: 'Vazirmatn_400Regular', fontSize: 11, color: colors.ink, opacity: 0.7, textAlign: 'center' },
  nameOn: { color: tile.selected.text },
});
