import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Character } from '../components/Character';
import { Item } from '../components/Item';
import { Scene } from '../components/Scene';
import { SlabButton } from '../components/SlabButton';
import { fa } from '../i18n/fa';
import { colors, fonts } from '../theme/colors';
import { nativeTopInset } from '../theme/safeArea';
import { TEXT_RIGHT } from '../theme/direction';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const t = fa.tutorial;
/** Icons of the sample board, same order as `fa.tutorial.words`. */
const TILE_ICONS = ['pomegranate', 'samovar', 'marbles', 'coin', 'teapot', 'pistachio', 'top', 'gem', 'kite', 'sohan', 'watermelon', 'crown', 'dice', 'bread', 'pashmak', 'goldBar'] as const;
/** The food group the guide points at. */
const FOOD = [0, 5, 10, 13];

/**
 * screen-tutorial of `docs/design/Dozari - 19 Social Daily Onboarding` (D99): «آجان» walks through a sample board in four
 * steps — the board, a group lit up, picking and submitting it, the group solved. Skippable; reachable again from the profile.
 */
export function Tutorial({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  /** Tiles the player has tapped on the «pick the food group» step. */
  const [picked, setPicked] = useState<number[]>([]);
  /** Shown instead of the step text for a moment after a wrong tap. */
  const [oops, setOops] = useState(false);
  useEffect(() => {
    if (!oops) return;
    const timer = setTimeout(() => setOops(false), 2200);
    return () => clearTimeout(timer);
  }, [oops]);
  const step = t.steps[i]!;
  const tapTile = (k: number) => {
    if (i !== 1) return;
    if (!FOOD.includes(k)) return setOops(true);
    const next = picked.includes(k) ? picked : [...picked, k];
    setPicked(next);
    setOops(false);
    if (next.length === FOOD.length) setTimeout(() => setI(2), 350);
  };
  const last = i === t.steps.length - 1;
  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}><Scene scene="hojre" /></View>
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          <View style={styles.top}>
            <View style={styles.dots}>
              {t.steps.map((s, k) => <View key={s.title} style={[styles.dot, k === i ? styles.dotOn : null, k <= i ? styles.dotDone : null]} />)}
            </View>
            <Pressable onPress={onDone} style={styles.skip} accessibilityRole="button"><Text style={styles.skipText}>{t.skip}</Text></Pressable>
          </View>

          <View style={styles.bubbleSlot}>
            <View style={styles.bubble}>
              <View style={styles.bubbleHead}>
                <View style={styles.tag}><Text style={styles.tagText}>{t.guide}</Text></View>
                <Text style={styles.title}>{oops ? t.oopsTitle : step.title}</Text>
              </View>
              <Text style={styles.text}>{oops ? t.oops : step.text}</Text>
            </View>
          </View>

          <View style={styles.grid}>
            {TILE_ICONS.map((icon, k) => {
              const lit = i >= 1 && FOOD.includes(k);
              const solved = i === 3 && lit;
              const isPicked = lit && (i === 2 || picked.includes(k));
              return (
                <View key={icon} style={styles.cell}>
                  <Pressable onPress={() => tapTile(k)} disabled={i !== 1} accessibilityRole="button" accessibilityLabel={t.words[k]}
                    style={[styles.tile, lit && !isPicked ? styles.tileLit : null, i >= 1 && !lit && i !== 1 ? styles.tileDim : null, isPicked ? styles.tilePicked : null, solved ? styles.tileSolved : null]}>
                    <View style={styles.tileIcon}><Item icon={icon} /></View>
                    <Text style={styles.tileText} numberOfLines={1}>{t.words[k]}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={styles.submitSlot}>
            {i === 2 ? <Pressable onPress={() => setI(3)} style={styles.submit} accessibilityRole="button"><Text style={styles.submitText}>{t.submit}</Text></Pressable> : null}
          </View>

          <View style={styles.spacer} />
          <View style={styles.footer}>
            <View style={styles.cta}>
              {step.cta ? <SlabButton label={step.cta} color={colors.candy.yellow} height={58} fontSize={22} grow={0} onPress={() => (last ? onDone() : setI(i + 1))} /> : null}
            </View>
            <View style={styles.guide}><Character who="ajan" pose={step.pose} /></View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.deeper },
  shade: { backgroundColor: 'rgba(26,8,44,0.55)' },
  scroll: { flexGrow: 1, paddingHorizontal: 12, paddingTop: 20 + nativeTopInset(), paddingBottom: 24, alignItems: 'center' },
  column: { flex: 1, width: '100%', maxWidth: 480 },
  top: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  dots: { flexDirection: ROW, gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 99, borderWidth: 2, borderColor: colors.ink, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotDone: { backgroundColor: colors.candy.yellow },
  dotOn: { width: 28 },
  skip: { height: 34, paddingHorizontal: 14, borderRadius: 99, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(26,8,44,0.6)', justifyContent: 'center' },
  skipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.cream },
  grid: { flexDirection: ROW, flexWrap: 'wrap', marginHorizontal: -3 },
  cell: { width: '25%', padding: 3 },
  tile: { height: 66, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', gap: 1, shadowColor: '#D9B98C', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 },
  tileLit: { transform: [{ scale: 1.04 }], shadowColor: colors.candy.yellow, shadowOffset: { width: 0, height: 0 }, shadowRadius: 12, shadowOpacity: 0.9 },
  tileDim: { opacity: 0.35 },
  tilePicked: { backgroundColor: '#C9A3FF' },
  tileSolved: { backgroundColor: '#FFE48A' },
  tileIcon: { width: 32, height: 32 },
  tileText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink },
  submitSlot: { height: 72, alignItems: 'center', justifyContent: 'center' },
  submit: { height: 52, paddingHorizontal: 34, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.lime, justifyContent: 'center', ...lift(5) },
  submitText: { fontFamily: fonts.display, fontSize: 22, color: '#fff', textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  bubbleSlot: { marginBottom: 18 },
  spacer: { flex: 1, minHeight: 8 },
  bubble: { padding: 12, paddingHorizontal: 14, borderRadius: 20, borderBottomLeftRadius: 6, backgroundColor: '#fff', borderWidth: 3, borderColor: colors.ink, gap: 4, ...lift(5) },
  bubbleHead: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  tag: { paddingHorizontal: 8, borderRadius: 99, backgroundColor: '#3F72D0', borderWidth: 2, borderColor: colors.ink },
  tagText: { fontFamily: fonts.display, fontSize: 12, lineHeight: 20, color: '#fff' },
  title: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  text: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 21, color: colors.ink, textAlign: TEXT_RIGHT },
  footer: { flexDirection: ROW, alignItems: 'flex-end', gap: 8, marginTop: 4 },
  guide: { width: 132, height: 153, marginBottom: -6 },
  cta: { flex: 1, paddingBottom: 6 },
});
