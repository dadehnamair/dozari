import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { COSMETIC_SLOTS, toPersianDigits } from '@dozari/shared';
import type { CosmeticSlot, Shop, ShopItem } from '@dozari/shared';
import { GradientFill } from '../components/GradientFill';
import { GuideBubble } from '../components/GuideBubble';
import { Icon } from '../components/Icon';
import { Item } from '../components/Item';
import { Scene } from '../components/Scene';
import { fa } from '../i18n/fa';
import { useHardwareBack } from '../nav/useHardwareBack';
import { ApiError } from '../net/http';
import { buyItem, equipItem, fetchShop, payWithMoney } from '../shop/api';
import { pageTop } from '../theme/safeArea';
import { colors, fonts } from '../theme/colors';
import type { CharacterId } from '../theme/character';
import { PackCard } from './PackCard';
import { rarityOf } from './rarity';
import { WardrobeStage } from './WardrobeStage';
import { actionFor, cosmeticsOf, inSlot, isTrying, previewWorn, priceOf, shownIn, toggleTry } from './tryOn';
import type { Tried } from './tryOn';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));
const RANK = { c: 0, r: 1, e: 2, l: 3 } as const;

/** Colour of each pack's bar and navigation chip (from the design; outfit and accessories take the free colours). */
const PACK_COLOR: Record<CosmeticSlot, string> = { hat: '#FF7A3D', hair: '#FF4D8D', glasses: '#3FC1F0', makeup: '#FF8FB6', outfit: '#FFC93C', accessory: '#A66BF0' };

/** The guide's longer explanation of why an item cannot be bought right now (same words as the hujre). */
const whyText = (it: ShopItem): string | null => {
  const w = it.blocked ? fa.shop.why[it.blocked] : undefined;
  return typeof w === 'function' ? w(it.minLevel) : (w ?? null);
};

/**
 * اتاق پرو (D179/D187, design `21 Cosmetic Packs`): the player's character on the sunburst stage, what is worn, a chip per pack, and the packs one under
 * the other with their cards. Tapping a card tries it on for free; the card's own button wears it, buys it (coins / gems, as priced in the admin panel) or,
 * with real money on, opens the payment. The page scrolls inside the list only.
 */
export function FittingRoom({ who, realMoney = false, onClose }: { who: CharacterId; realMoney?: boolean; onClose: () => void }) {
  useHardwareBack(onClose);
  const compact = useWindowDimensions().height <= 700;
  const [shop, setShop] = useState<Shop | null>(null);
  const [failed, setFailed] = useState(false);
  const [tried, setTried] = useState<Tried>({});
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const tops = useRef<Partial<Record<CosmeticSlot, number>>>({});

  const load = useCallback(() => {
    fetchShop().then((s) => (setShop(s), setFailed(false)), () => setFailed(true));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const items = useMemo(() => shop?.items ?? [], [shop]);
  const packs = useMemo(
    () =>
      COSMETIC_SLOTS.map((slot) => ({ slot, items: [...inSlot(items, slot)].sort((a, b) => RANK[rarityOf(a)] - RANK[rarityOf(b)] || priceOf(a) - priceOf(b)) })).filter((p) => p.items.length > 0),
    [items],
  );
  const worn = previewWorn(items, tried);
  const wornNow = cosmeticsOf(items).filter((i) => shownIn(items, tried, i.slot!) === i.id);

  const run = (job: Promise<unknown>, done?: () => void) => {
    setBusy(true);
    job.then(
      () => (done?.(), load()),
      (e) => (setToast(e instanceof ApiError && e.code === 'bale_not_linked' ? fa.shop.linkBale : fa.shop.error), load()),
    ).finally(() => setBusy(false));
  };
  const clearSlot = (s: CosmeticSlot | null) => setTried((t) => { const next = { ...t }; if (s) delete next[s]; return next; });
  const act = (it: ShopItem) => {
    if (busy) return;
    const a = actionFor(it);
    if (a === 'locked') return setToast(whyText(it));
    if (a === 'wear') return run(equipItem(it.id, true), () => clearSlot(it.slot));
    if (a === 'takeOff') return run(equipItem(it.id, false), () => clearSlot(it.slot));
    run(buyItem(it.id).then(() => equipItem(it.id, true)), () => (clearSlot(it.slot), setToast(fa.shop.ownedNow)));
  };
  const pay = (it: ShopItem) =>
    payWithMoney(it.id).then(
      () => setToast(fa.shop.invoiceSent),
      (e) => setToast(e instanceof ApiError && e.code === 'bale_not_linked' ? fa.shop.linkBale : fa.shop.payError),
    );
  const takeOffAll = () => {
    const equipped = cosmeticsOf(items).filter((i) => i.equipped);
    setTried({});
    if (equipped.length > 0) run(Promise.all(equipped.map((i) => equipItem(i.id, false))));
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none"><Scene scene="hojre" /></View>
      <View style={styles.veil} pointerEvents="none"><GradientFill from="rgba(43,18,64,0.6)" to="rgba(43,18,64,0.88)" /></View>
      <View style={styles.column}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel={fa.wardrobe.close} onPress={onClose}>
            {({ pressed }) => (
              <View style={[styles.back, pressed ? styles.pressed : null]}>
                <GradientFill from="#FFE48A" to={colors.candy.yellow} />
                <Icon name="back" size={22} color={colors.ink} strokeWidth={3} />
              </View>
            )}
          </Pressable>
          <View style={styles.plate}>
            <GradientFill from="#FFE48A" to={colors.candy.yellow} />
            <Text style={styles.plateText}>{fa.wardrobe.title}</Text>
          </View>
          {shop ? (
            <View style={styles.pill} accessibilityLabel={`${fa.shop.balance} ${shop.balance}`}>
              <Text style={styles.pillText}>{n(shop.balance)}</Text>
              <View style={styles.pillIcon}><Item icon="coin" /></View>
            </View>
          ) : null}
          {shop && shop.gems > 0 ? (
            <View style={styles.pill} accessibilityLabel={`${fa.home.hub.gems} ${shop.gems}`}>
              <Text style={styles.pillText}>{n(shop.gems)}</Text>
              <View style={styles.pillIcon}><Item icon="gem" /></View>
            </View>
          ) : null}
        </View>

        {failed ? <GuideBubble who="baqal" text={fa.wardrobe.error} /> : null}

        <WardrobeStage who={who} worn={worn} toast={toast} height={compact ? 190 : 250} />

        <View style={styles.wornRow}>
          <Text style={styles.wornLabel}>{fa.wardrobe.worn}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chips}>
            {wornNow.length === 0 ? <Text style={styles.none}>{fa.wardrobe.nothing}</Text> : wornNow.map((i) => (
              <Pressable key={i.id} onPress={() => setTried((t) => toggleTry(items, t, i))} accessibilityRole="button" accessibilityLabel={`${i.titleFa} ×`} style={[styles.chip, { backgroundColor: PACK_COLOR[i.slot!] }]}>
                <Text style={styles.chipText}>{i.titleFa}</Text>
                <Text style={styles.chipX}>×</Text>
              </Pressable>
            ))}
          </ScrollView>
          {isTrying(tried) ? <Pressable onPress={() => setTried({})} accessibilityRole="button" style={styles.small}><Text style={styles.smallText}>{fa.wardrobe.undo}</Text></Pressable> : null}
          {cosmeticsOf(items).some((i) => i.equipped) ? <Pressable onPress={takeOffAll} accessibilityRole="button" style={styles.small}><Text style={styles.smallText}>{fa.wardrobe.default}</Text></Pressable> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.navScroll} contentContainerStyle={styles.nav}>
          {packs.map((p) => (
            <Pressable key={p.slot} onPress={() => scroller.current?.scrollTo({ y: Math.max(0, (tops.current[p.slot] ?? 0) - 4), animated: true })} accessibilityRole="button" style={[styles.navChip, { backgroundColor: PACK_COLOR[p.slot] }]}>
              <Text style={styles.navText}>{fa.wardrobe.slots[p.slot]}</Text>
              <Text style={styles.navCount}>{n(p.items.length)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView ref={scroller} style={styles.list} contentContainerStyle={styles.sections} showsVerticalScrollIndicator persistentScrollbar>
          {shop && packs.length === 0 ? <Text style={styles.empty}>{fa.wardrobe.empty}</Text> : null}
          {packs.map((p) => (
            <View key={p.slot} style={styles.section} onLayout={(e) => void (tops.current[p.slot] = e.nativeEvent.layout.y)}>
              <View style={styles.sectionHead}>
                <View style={[styles.bar, { backgroundColor: PACK_COLOR[p.slot] }]} />
                <View style={styles.titles}>
                  <Text style={styles.sectionTitle}>{fa.wardrobe.pack(fa.wardrobe.slots[p.slot] ?? '')}</Text>
                  <Text style={styles.sectionSub}>{fa.wardrobe.count(p.items.length, p.items.filter((i) => i.owned).length)}</Text>
                </View>
              </View>
              <View style={styles.grid}>
                {p.items.map((it) => (
                  <PackCard key={it.id} item={it} realMoney={realMoney} on={shownIn(items, tried, p.slot) === it.id} onTry={() => setTried((t) => toggleTry(items, t, it))} onAct={() => act(it)} onPay={() => void pay(it)} />
                ))}
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
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 10, paddingTop: pageTop(), paddingBottom: 8, gap: 8 },
  head: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  pill: { flexDirection: ROW, alignItems: 'center', gap: 3, height: 38, paddingHorizontal: 9, borderRadius: 99, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(26,8,44,0.75)' },
  pillText: { fontFamily: fonts.display, fontSize: 15, color: '#fff' },
  pillIcon: { width: 28, height: 28 },
  wornRow: { flexDirection: ROW, alignItems: 'center', gap: 6, minHeight: 34 },
  wornLabel: { fontFamily: fonts.display, fontSize: 15, color: colors.cream },
  chipScroll: { flex: 1 },
  chips: { flexDirection: ROW, gap: 6, alignItems: 'center' },
  none: { fontFamily: fonts.bold, fontSize: 12, color: '#E3CCFF' },
  chip: { flexDirection: ROW, alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  chipX: { fontFamily: fonts.display, fontSize: 14, color: colors.ink, opacity: 0.6 },
  small: { height: 30, paddingHorizontal: 10, borderRadius: 10, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  smallText: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  navScroll: { flexGrow: 0, minHeight: 42 },
  nav: { flexDirection: ROW, gap: 8, alignItems: 'center', paddingBottom: 4 },
  navChip: { flexDirection: ROW, alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 99, borderWidth: 3, borderColor: colors.ink, ...lift(3) },
  navText: { fontFamily: fonts.display, fontSize: 16, color: colors.ink },
  navCount: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink, opacity: 0.7 },
  list: { flex: 1 },
  sections: { gap: 14, paddingBottom: 16, paddingRight: 4 },
  empty: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center', marginTop: 20 },
  section: { borderRadius: 24, borderWidth: 2, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: 'rgba(255,255,255,0.06)', padding: 10, gap: 10 },
  sectionHead: { flexDirection: ROW, alignItems: 'center', gap: 10 },
  bar: { width: 12, height: 38, borderRadius: 6, borderWidth: 3, borderColor: colors.ink },
  titles: { flex: 1 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.cream, textShadowColor: colors.ink, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 1 },
  sectionSub: { fontFamily: fonts.bold, fontSize: 12, color: '#E3CCFF' },
  grid: { flexDirection: ROW, flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
});
