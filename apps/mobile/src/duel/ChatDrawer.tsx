import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TauntCategory } from '@dozari/shared';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { EDGE_RIGHT, roundLeftEdge } from '../theme/direction';

const WIDTH = 224;
const BG = ['#FFFFFF', '#FFE48A', '#BFEAFB', '#FFD0E0', '#D8F5C2', '#E6D6FF'];

/**
 * The «کل‌کل» drawer of screen-match (`13 Match Screens v2`): a cream sheet that slides in from the right edge over a dim scrim,
 * a tab per canned-taunt category, and bubbles that pop in one after another. Tapping a taunt sends it and closes the drawer.
 */
export function ChatDrawer({ open, onClose, categories, tab, onTab, onSend }: { open: boolean; onClose: () => void; categories: readonly TauntCategory[]; tab: number; onTab: (i: number) => void; onSend: (tauntId: string, text: string) => void }) {
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: open ? 1 : 0, duration: open ? 420 : 260, easing: open ? Easing.out(Easing.back(1.1)) : Easing.in(Easing.quad), useNativeDriver: true }).start();
  }, [open, slide]);
  const items = categories[Math.min(tab, categories.length - 1)]?.taunts ?? [];
  return (
    <>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, styles.scrim, { opacity: slide }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={fa.duel.chat.close} />
      </Animated.View>
      <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[styles.sheet, roundLeftEdge(24), { [EDGE_RIGHT]: 0, transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [WIDTH + 12, 0] }) }] }]}>
        <View style={styles.head}>
          <View style={styles.tabs}>
            {categories.slice(0, 3).map((c, i) => (
              <Pressable key={c.id} accessibilityRole="button" accessibilityState={{ selected: i === tab }} onPress={() => onTab(i)} style={[styles.tab, i === tab ? styles.tabOn : null]}>
                <Text style={styles.tabText} numberOfLines={1}>{c.nameFa}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={fa.duel.chat.close} onPress={onClose} style={styles.x}><Text style={styles.xText}>✕</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {items.map((t, i) => <Bubble key={t.id} text={t.text} tone={BG[i % BG.length]!} index={i} open={open} onPress={() => onSend(t.id, t.text)} />)}
        </ScrollView>
        <Text style={styles.note}>{fa.duel.chat.note}</Text>
      </Animated.View>
    </>
  );
}

/** One canned taunt: slides in from the left a beat after its neighbour when the drawer opens. */
function Bubble({ text, tone, index, open, onPress }: { text: string; tone: string; index: number; open: boolean; onPress: () => void }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!open) return v.setValue(0);
    const run = Animated.timing(v, { toValue: 1, duration: 380, delay: 80 + index * 40, easing: Easing.out(Easing.back(1.3)), useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [open, index, v]);
  return (
    <Animated.View style={{ opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) }] }}>
      <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.bubble, { backgroundColor: tone }, pressed ? styles.pressed : null]}>
        <Text style={styles.bubbleText}>{text}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: 'rgba(20,8,34,0.45)', zIndex: 20 },
  sheet: { position: 'absolute', top: 150, bottom: 100, width: WIDTH, zIndex: 21, backgroundColor: colors.cream, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, paddingBottom: 8, backgroundColor: colors.candy.yellow, borderBottomWidth: 3, borderBottomColor: colors.ink },
  tabs: { flex: 1, flexDirection: 'row', gap: 4, padding: 3, borderRadius: 12, backgroundColor: 'rgba(43,18,64,0.15)' },
  tab: { flex: 1, height: 30, borderRadius: 9, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabOn: { backgroundColor: colors.cream, borderColor: colors.ink },
  tabText: { fontFamily: fonts.display, fontSize: 15, lineHeight: 22, color: colors.ink },
  x: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  xText: { fontFamily: fonts.display, fontSize: 14, lineHeight: 20, color: colors.ink },
  list: { padding: 10, gap: 7 },
  bubble: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, borderBottomRightRadius: 4, borderWidth: 2.5, borderColor: colors.ink, borderBottomWidth: 5 },
  pressed: { transform: [{ translateY: 2 }] },
  bubbleText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 20, color: colors.ink },
  note: { paddingVertical: 7, paddingHorizontal: 10, borderTopWidth: 2, borderTopColor: 'rgba(43,18,64,0.2)', borderStyle: 'dashed', fontFamily: fonts.bold, fontSize: 10.5, color: 'rgba(43,18,64,0.6)', textAlign: 'center' },
});
