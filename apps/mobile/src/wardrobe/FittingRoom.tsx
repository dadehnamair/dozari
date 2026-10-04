import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COSMETIC_SLOTS, toPersianDigits } from '@dozari/shared';
import type { CosmeticSlot, Shop, ShopItem } from '@dozari/shared';
import { Character } from '../components/Character';
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
import { actionFor, cosmeticsOf, inSlot, isTrying, previewWorn, priceOf, shownIn, toggleTry } from './tryOn';
import type { Tried } from './tryOn';

const ROW = Platform.OS === 'web' ? ('row-reverse' as const) : ('row' as const);
const n = (v: number) => toPersianDigits(String(v));

/** The guide's longer explanation of why an item cannot be bought right now (same words as the hujre). */
const whyText = (it: ShopItem): string | null => {
  const w = it.blocked ? fa.shop.why[it.blocked] : undefined;
  return typeof w === 'function' ? w(it.minLevel) : (w ?? null);
};

/**
 * اتاق پرو (D179, design `21 Cosmetic Packs`): the player's own character on a stage, one tab per slot (hat, hair,
 * glasses, clothes, accessories). Tapping an item tries it on for free; the button then wears it, buys it with
 * coins / gems, or opens the real-money payment, depending on what the owner priced it at in the admin panel.
 */
export function FittingRoom({ who, realMoney = false, onClose }: { who: CharacterId; realMoney?: boolean; onClose: () => void }) {
  useHardwareBack(onClose);
  const [shop, setShop] = useState<Shop | null>(null);
  const [failed, setFailed] = useState(false);
  const [slot, setSlot] = useState<CosmeticSlot>(COSMETIC_SLOTS[0]);
  const [tried, setTried] = useState<Tried>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchShop().then((s) => (setShop(s), setFailed(false)), () => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const items = useMemo(() => shop?.items ?? [], [shop]);
  const slotItems = inSlot(items, slot);
  const selected = cosmeticsOf(items).find((i) => i.id === selectedId) ?? null;
  const worn = previewWorn(items, tried);
  const wornNow = cosmeticsOf(items).filter((i) => shownIn(items, tried, i.slot!) === i.id);

  const tap = (it: ShopItem) => {
    setTried((t) => toggleTry(items, t, it));
    setSelectedId(it.id);
    setNote(null);
  };
  const run = (job: Promise<unknown>, done?: () => void) => {
    setBusy(true);
    job.then(
      () => (done?.(), load()),
      (e) => (setNote(e instanceof ApiError && e.code === 'bale_not_linked' ? fa.shop.linkBale : fa.shop.error), load()),
    ).finally(() => setBusy(false));
  };
  const clearSlot = (s: CosmeticSlot | null) => setTried((t) => { const next = { ...t }; if (s) delete next[s]; return next; });

  const act = (it: ShopItem) => {
    const a = actionFor(it);
    if (a === 'locked') return setNote(whyText(it));
    if (a === 'wear') return run(equipItem(it.id, true), () => clearSlot(it.slot));
    if (a === 'takeOff') return run(equipItem(it.id, false), () => clearSlot(it.slot));
    run(buyItem(it.id).then(() => equipItem(it.id, true)), () => (clearSlot(it.slot), setNote(fa.shop.ownedNow)));
  };
  const pay = (it: ShopItem) =>
    payWithMoney(it.id).then(
      () => setNote(fa.shop.invoiceSent),
      (e) => setNote(e instanceof ApiError && e.code === 'bale_not_linked' ? fa.shop.linkBale : fa.shop.payError),
    );
  const takeOffAll = () => {
    const equipped = cosmeticsOf(items).filter((i) => i.equipped);
    setTried({});
    if (equipped.length > 0) run(Promise.all(equipped.map((i) => equipItem(i.id, false))));
  };

  const label = (it: ShopItem): string => {
    const a = actionFor(it);
    if (a === 'takeOff') return fa.shop.takeOff;
    if (a === 'wear') return fa.shop.wear;
    if (a === 'free') return `${fa.shop.free} · ${fa.shop.wear}`;
    return n(priceOf(it));
  };

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none"><Scene scene="hojre" /></View>
      <View style={styles.veil} pointerEvents="none"><GradientFill from="rgba(43,18,64,0.55)" to="rgba(43,18,64,0.85)" /></View>
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

        <View style={styles.stage}>
          <GradientFill from="#FFE48A" to="#FF7A3D" />
          <View style={styles.model}><Character who={who} pose="wave" worn={worn} /></View>
          {isTrying(tried) ? (
            <Pressable onPress={() => (setTried({}), setNote(null))} accessibilityRole="button" style={styles.undo}>
              <Text style={styles.undoText}>{fa.wardrobe.undo}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.wornRow}>
          <Text style={styles.wornLabel}>{fa.wardrobe.worn}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {wornNow.length === 0 ? <Text style={styles.none}>{fa.wardrobe.nothing}</Text> : wornNow.map((i) => (
              <Pressable key={i.id} onPress={() => (setTried((t) => toggleTry(items, t, i)), setSelectedId(i.id))} accessibilityRole="button" accessibilityLabel={`${i.titleFa} ×`} style={styles.chip}>
                <Text style={styles.chipText}>{i.titleFa}</Text>
                <Text style={styles.chipX}>×</Text>
              </Pressable>
            ))}
          </ScrollView>
          {cosmeticsOf(items).some((i) => i.equipped) ? (
            <Pressable onPress={takeOffAll} accessibilityRole="button" style={styles.reset}><Text style={styles.resetText}>{fa.wardrobe.takeOffAll}</Text></Pressable>
          ) : null}
        </View>

        <View style={styles.tabs}>
          {COSMETIC_SLOTS.map((s) => (
            <Pressable key={s} onPress={() => (setSlot(s), setNote(null))} accessibilityRole="tab" accessibilityState={{ selected: slot === s }} style={styles.tabCell}>
              <View style={[styles.tab, slot === s ? styles.tabOn : null]}>
                <Text style={styles.tabText} numberOfLines={1}>{fa.wardrobe.slots[s]}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.shelf}>
          {slotItems.length === 0 ? (
            <Text style={styles.empty}>{shop ? fa.wardrobe.empty : ''}</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
              {slotItems.map((it) => {
                const on = shownIn(items, tried, slot) === it.id;
                const locked = !it.owned && it.blocked !== null;
                return (
                  <Pressable key={it.id} onPress={() => tap(it)} accessibilityRole="button" accessibilityLabel={it.titleFa} accessibilityState={{ selected: on }} style={[styles.card, on ? styles.cardOn : null]}>
                    <View style={styles.art}>
                      <Item icon={it.iconKey ?? 'magnifier'} />
                      {locked ? <View style={styles.lock}><View style={styles.lockIcon}><Item icon="lock" /></View></View> : null}
                    </View>
                    <Text style={styles.name} numberOfLines={1}>{it.titleFa}</Text>
                    <Text style={styles.sub} numberOfLines={1}>{it.owned ? (it.equipped ? fa.shop.worn : fa.shop.owned) : locked && it.blocked === 'LEVEL' ? fa.shop.needLevel(it.minLevel) : priceOf(it) === 0 ? fa.shop.free : `${n(priceOf(it))} ${it.currency === 'gems' ? fa.home.hub.gems : fa.shop.price}`}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.bar}>
          {note ? <Text style={styles.note}>{note}</Text> : <Text style={styles.note}>{selected ? selected.titleFa : fa.wardrobe.pick}</Text>}
          {selected ? (
            <View style={styles.actions}>
              <Pressable disabled={busy} onPress={() => act(selected)} accessibilityRole="button" style={({ pressed }) => [styles.act, actionFor(selected) === 'locked' ? styles.actOff : null, pressed ? styles.pressed : null]}>
                {actionFor(selected) === 'buy' ? <View style={styles.buyIcon}><Item icon={selected.currency === 'gems' ? 'gem' : 'coin'} /></View> : null}
                <Text style={styles.actText}>{actionFor(selected) === 'locked' ? fa.shop.buy : label(selected)}</Text>
              </Pressable>
              {realMoney && selected.priceToman > 0 && !selected.owned ? (
                <Pressable onPress={() => void pay(selected)} accessibilityRole="button" accessibilityLabel={`${fa.shop.payMoney} ${selected.titleFa}`} style={({ pressed }) => [styles.act, styles.money, pressed ? styles.pressed : null]}>
                  <Text style={styles.actText}>{fa.shop.toman(selected.priceToman)}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const lift = (h: number) => ({ shadowColor: colors.ink, shadowOffset: { width: 0, height: h }, shadowOpacity: 1, shadowRadius: 0, elevation: h });

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: '#3C1A66' },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  column: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 10, paddingTop: pageTop(), paddingBottom: 12, gap: 8 },
  head: { flexDirection: ROW, alignItems: 'center', gap: 6 },
  back: { width: 42, height: 42, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  pressed: { transform: [{ translateY: 3 }] },
  plate: { flex: 1, height: 44, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', ...lift(4) },
  plateText: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  pill: { flexDirection: ROW, alignItems: 'center', gap: 3, height: 38, paddingHorizontal: 9, borderRadius: 99, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', backgroundColor: 'rgba(26,8,44,0.75)' },
  pillText: { fontFamily: fonts.display, fontSize: 15, color: '#fff' },
  pillIcon: { width: 28, height: 28 },
  stage: { flex: 1, minHeight: 130, borderRadius: 22, borderWidth: 3, borderColor: colors.ink, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', ...lift(4) },
  model: { width: '70%', maxWidth: 240, height: '96%' },
  undo: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 12, height: 30, borderRadius: 10, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  undoText: { fontFamily: fonts.display, fontSize: 14, color: colors.ink },
  wornRow: { flexDirection: ROW, alignItems: 'center', gap: 8, minHeight: 34 },
  wornLabel: { fontFamily: fonts.display, fontSize: 15, color: colors.cream },
  chips: { flexDirection: ROW, gap: 6, alignItems: 'center' },
  none: { fontFamily: fonts.bold, fontSize: 12, color: '#E3CCFF' },
  chip: { flexDirection: ROW, alignItems: 'center', gap: 6, height: 30, paddingHorizontal: 10, borderRadius: 99, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: colors.candy.lime },
  chipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
  chipX: { fontFamily: fonts.display, fontSize: 14, color: colors.ink, opacity: 0.6 },
  reset: { height: 30, paddingHorizontal: 10, borderRadius: 10, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  resetText: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  tabs: { flexDirection: ROW, gap: 4 },
  tabCell: { flex: 1, minWidth: 0 },
  tab: { height: 40, borderRadius: 12, borderWidth: 2.5, borderColor: colors.ink, backgroundColor: '#FFF6E8', alignItems: 'center', justifyContent: 'center', ...lift(3) },
  tabOn: { backgroundColor: colors.candy.yellow, transform: [{ translateY: 2 }], shadowOffset: { width: 0, height: 1 } },
  tabText: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  shelf: { height: 128, justifyContent: 'center' },
  empty: { fontFamily: fonts.bold, fontSize: 13, color: colors.cream, textAlign: 'center' },
  cards: { flexDirection: ROW, gap: 8, paddingHorizontal: 2, paddingBottom: 6, alignItems: 'center' },
  card: { width: 96, height: 118, borderRadius: 18, borderWidth: 3, borderColor: colors.ink, backgroundColor: '#FBEBD2', alignItems: 'center', padding: 4, gap: 2, ...lift(4) },
  cardOn: { backgroundColor: '#FFE48A', borderColor: colors.candy.pink },
  art: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  lock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 12, backgroundColor: 'rgba(43,18,64,0.55)', alignItems: 'center', justifyContent: 'center' },
  lockIcon: { width: 32, height: 32 },
  name: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  sub: { fontFamily: fonts.bold, fontSize: 10, color: '#7E46D6' },
  bar: { gap: 6 },
  note: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.cream, textAlign: 'center' },
  actions: { flexDirection: ROW, gap: 8 },
  act: { flex: 1, height: 46, borderRadius: 14, borderWidth: 3, borderColor: colors.ink, backgroundColor: colors.candy.lime, flexDirection: ROW, alignItems: 'center', justifyContent: 'center', gap: 6, ...lift(4) },
  actOff: { opacity: 0.55 },
  money: { backgroundColor: colors.candy.sky },
  actText: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  buyIcon: { width: 24, height: 24 },
});
