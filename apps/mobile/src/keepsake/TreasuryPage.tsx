import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SHOWCASE_MAX, toPersianDigits } from '@dozari/shared';
import type { KeepsakeGallery, KeepsakeView } from '@dozari/shared';
import { GradientFill } from '../components/GradientFill';
import { GuideBubble } from '../components/GuideBubble';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { fa } from '../i18n/fa';
import { useHardwareBack } from '../nav/useHardwareBack';
import { pageTop } from '../theme/safeArea';
import { colors, fonts } from '../theme/colors';
import { buyPiece, fetchGallery, saveShowcase, upgradeKeepsake } from './api';
import type { PieceResult } from './api';
import { RARITY_COLOR, actionOf, pinnedIds, priceOf, sections, togglePin } from './model';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));
const t = fa.treasury;

/** What the toast after a purchase says: the piece, then completion, the gems and the set. */
function gotText(r: PieceResult): string {
  const parts = [t.got(r.piece)];
  if (r.completed) parts.push(t.completed);
  if (r.gems > 0) parts.push(t.gemsGot(r.gems));
  if (r.setCompleted) parts.push(t.setDone);
  return parts.join(' · ');
}

/**
 * گنجینه: the keepsake collection. Keepsakes sit under their sets; each card shows the piece dots, a button that buys a missing piece (or upgrades the
 * frame once complete) and, when complete, a pin that puts it on the profile showcase. The art inside a frame is the designer's `artKey`; until it
 * exists the product's catalog icon is drawn. Everything is decided by the server (docs/logic/economy-v2.md §Keepsake collection).
 */
export function TreasuryPage({ onClose }: { onClose: () => void }) {
  useHardwareBack(onClose);
  const [g, setG] = useState<KeepsakeGallery | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchGallery().then(
      (v) => (setG(v), setFailed(false)),
      () => setFailed(true),
    );
  }, []);
  useEffect(load, [load]);
  const secs = useMemo(() => (g ? sections(g, t.loose) : []), [g]);
  const pins = useMemo(() => (g ? pinnedIds(g.items) : []), [g]);

  const act = async (k: KeepsakeView) => {
    if (busy) return;
    setBusy(k.id);
    setNote(null);
    try {
      const a = actionOf(k);
      if (a === 'max') return;
      const out = a === 'buy' ? await buyPiece(k.id) : await upgradeKeepsake(k.id);
      if (!out.ok) setNote(t.errors[out.error] ?? t.errors.generic ?? '');
      else if (a === 'buy') setNote(gotText(out.value as PieceResult));
      load();
    } catch {
      setNote(t.errors.generic ?? '');
    } finally {
      setBusy(null);
    }
  };

  const pin = async (k: KeepsakeView) => {
    const next = togglePin(pins, k.id);
    if (next.length === pins.length && !pins.includes(k.id)) return setNote(t.pinFull);
    try {
      await saveShowcase(next);
      load();
    } catch {
      setNote(t.errors.generic ?? '');
    }
  };

  return (
    <View style={styles.root}>
      <GradientFill from="#5B2A99" to="#2A0F4A" />
      <View style={styles.column}>
        <View style={styles.head}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={t.close}>
            {({ pressed }) => (
              <View style={[styles.back, pressed ? styles.pressed : null]}>
                <GradientFill from="#FFE48A" to={colors.candy.yellow} />
                <Icon name="back" size={22} color={colors.ink} strokeWidth={3} />
              </View>
            )}
          </Pressable>
          <View style={styles.plate}>
            <GradientFill from="#FFE48A" to={colors.candy.yellow} />
            <Text style={styles.plateText}>{t.title}</Text>
          </View>
          {g ? (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{n(g.balance)}</Text>
              <View style={styles.pillIcon}><Item icon="coin" /></View>
            </View>
          ) : null}
        </View>

        {failed ? <GuideBubble who="baqal" text={t.error} /> : null}
        {g ? (
          <View style={styles.progress}>
            <View style={styles.bar}><View style={[styles.barFill, { width: `${g.percent}%` }]} /></View>
            <Text style={styles.progressText}>{t.percent(g.percent)}</Text>
          </View>
        ) : null}
        {note ? <Text style={styles.note} accessibilityLiveRegion="polite">{note}</Text> : null}

        <ScrollView style={styles.list} contentContainerStyle={styles.sections} showsVerticalScrollIndicator>
          {g && g.items.length === 0 ? <Text style={styles.empty}>{t.empty}</Text> : null}
          {secs.map((s) => (
            <View key={s.key}>
              <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{s.title}</Text>
                <Text style={styles.sectionSub}>{t.setProgress(s.completed, s.total)}</Text>
              </View>
              <View style={styles.grid}>
                {s.items.map((k) => {
                  const a = actionOf(k);
                  const price = priceOf(k);
                  const pinned = k.showcaseSlot !== null;
                  return (
                    <View key={k.id} style={[styles.card, { borderColor: RARITY_COLOR[k.rarity] }]}>
                      <Pressable onPress={() => setOpen(open === k.id ? null : k.id)} accessibilityRole="button" accessibilityLabel={k.titleFa}>
                        <View style={[styles.art, { backgroundColor: RARITY_COLOR[k.rarity] }, !k.complete ? styles.artDim : null]}>
                          <View style={styles.artIcon}><Item icon={k.iconKey ?? 'coin'} /></View>
                          {k.complete ? <View style={styles.levelTag}><Text style={styles.levelText}>{t.frame(k.level)}</Text></View> : null}
                        </View>
                        <Text style={styles.name} numberOfLines={2}>{k.titleFa}</Text>
                        <Text style={styles.sub}>{t.rarity[k.rarity] ?? ''}{k.eraYear ? ` · ${n(k.eraYear)}` : ''}</Text>
                      </Pressable>
                      <View style={styles.dots} accessibilityLabel={t.pieces(k.owned.length, k.pieces)}>
                        {Array.from({ length: k.pieces }, (_, i) => (
                          <View key={i} style={[styles.dot, k.owned.includes(i + 1) ? styles.dotOn : null]} />
                        ))}
                      </View>
                      {open === k.id ? <Text style={styles.story}>{k.eraYear ? `${t.era(k.eraYear)}\n` : ''}{k.storyFa}</Text> : null}
                      {a === 'max' ? (
                        <Text style={styles.maxed}>{t.maxed}</Text>
                      ) : (
                        <Pressable disabled={busy !== null} onPress={() => void act(k)} accessibilityRole="button" accessibilityLabel={a === 'buy' ? t.buy(price ?? 0) : t.upgrade(price ?? 0)} style={({ pressed }) => [styles.buy, busy === k.id ? styles.buyBusy : null, pressed ? styles.pressed : null]}>
                          <View style={styles.buyIcon}><Item icon="coin" /></View>
                          <Text style={styles.buyText}>{a === 'buy' ? t.buy(price ?? 0) : t.upgrade(price ?? 0)}</Text>
                        </Pressable>
                      )}
                      {k.complete ? (
                        <Pressable onPress={() => void pin(k)} accessibilityRole="button" accessibilityState={{ selected: pinned }} style={[styles.pin, pinned ? styles.pinOn : null]}>
                          <Text style={styles.pinText}>{pinned ? t.unpin : pins.length >= SHOWCASE_MAX ? t.pinFull : t.pin}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#3C1A66' },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 10, paddingTop: pageTop(), paddingBottom: 8, gap: 8 },
  head: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  pill: { flexDirection: ROW, alignItems: 'center', gap: 3, height: 38, paddingHorizontal: 9, borderRadius: 99, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(26,8,44,0.75)' },
  pillText: { fontFamily: fonts.display, fontSize: 15, color: '#fff' },
  pillIcon: { width: 28, height: 28 },
  progress: { gap: 4 },
  bar: { height: 14, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: 'rgba(26,8,44,0.6)', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.candy.lime },
  progressText: { fontFamily: fonts.bold, fontSize: 12, color: '#E3CCFF', textAlign: 'center' },
  note: { fontFamily: fonts.bold, fontSize: 13, color: colors.candy.yellow, textAlign: 'center' },
  list: { flex: 1 },
  sections: { paddingBottom: 24, paddingHorizontal: 2 },
  empty: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center', marginTop: 20 },
  sectionHead: { flexDirection: ROW, alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, paddingBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.cream, textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  sectionSub: { fontFamily: fonts.bold, fontSize: 12, color: '#E3CCFF' },
  grid: { flexDirection: ROW, flexWrap: 'wrap', gap: 8 },
  card: { width: '48%', borderRadius: 18, borderWidth: 3, backgroundColor: colors.cream, padding: 8, gap: 6, ...lift(4) },
  art: { height: 92, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  artDim: { opacity: 0.55 },
  artIcon: { width: 64, height: 64 },
  levelTag: { position: 'absolute', bottom: 3, right: 3, paddingHorizontal: 6, height: 18, borderRadius: 9, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  levelText: { fontFamily: fonts.bold, fontSize: 10, color: colors.candy.yellow },
  name: { fontFamily: fonts.display, fontSize: 15, color: colors.ink, textAlign: 'center', minHeight: 36 },
  sub: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, opacity: 0.7, textAlign: 'center' },
  dots: { flexDirection: ROW, gap: 4, justifyContent: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: colors.ink, backgroundColor: '#fff' },
  dotOn: { backgroundColor: colors.candy.lime },
  story: { fontFamily: fonts.body, fontSize: 12, lineHeight: 19, color: colors.ink, textAlign: 'center' },
  buy: { flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: 40, borderRadius: 12, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.lime, ...lift(3) },
  buyBusy: { opacity: 0.6 },
  buyIcon: { width: 22, height: 22 },
  buyText: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  maxed: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink, textAlign: 'center', paddingVertical: 8 },
  pin: { minHeight: 34, borderRadius: 10, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  pinOn: { backgroundColor: colors.candy.yellow },
  pinText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
});
